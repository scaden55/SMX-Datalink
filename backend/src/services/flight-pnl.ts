import { getDb } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { RevenueModelService } from './revenue-model.js';
import { FlightCostEngine } from './flight-cost-engine.js';
import { SupplyDemandEngine } from './supply-demand-engine.js';
import { FinanceService } from './finance.js';
import type { FlightPnL, FlightCostBreakdown } from '@acars/shared';

const TAG = 'FlightPnL';

// ── DB row helpers ─────────────────────────────────────────

interface FleetLookupRow {
  id: number;
  mtow_lbs: number | null;
}

interface RevenueModelConfigRow {
  pilot_pay_per_hour: number;
}

// ── Params ─────────────────────────────────────────────────

export interface CalculateAndRecordParams {
  pirepId: number;
  pilotId: number;
  aircraftRegistration: string | null;
  depIcao: string;
  arrIcao: string;
  distanceNm: number;
  blockHours: number;
  cargoLbs: number;
  fuelUsedLbs: number;
}

// ── Service ────────────────────────────────────────────────

export class FlightPnLService {
  private revenueModel = new RevenueModelService();
  private costEngine = new FlightCostEngine();
  private supplyDemand = new SupplyDemandEngine();
  private financeService = new FinanceService();

  /**
   * Orchestrate revenue + costs + supply/demand into a single per-flight P&L.
   * Inserts into finance_flight_pnl and creates finance ledger entries.
   */
  calculateAndRecord(params: CalculateAndRecordParams): FlightPnL {
    const {
      pirepId,
      pilotId,
      aircraftRegistration,
      depIcao,
      arrIcao,
      distanceNm,
      blockHours,
      cargoLbs,
      fuelUsedLbs,
    } = params;

    const db = getDb();

    // 1. Revenue model calculation
    const breakdown = this.revenueModel.calculate({
      cargoLbs,
      distanceNm,
      aircraftRegistration,
      blockHours,
    });

    // 2. Supply/demand lane rate
    const baseYield = breakdown.revenue.total / Math.max(cargoLbs, 1);
    const laneResult = this.supplyDemand.calculateLaneRate(
      depIcao,
      arrIcao,
      baseYield,
      breakdown.distanceFactor,
    );

    // 3. Apply lane rate modifier to cargo revenue
    const adjustedRevenue = breakdown.revenue.total * laneResult.modifier;

    // 4. Sim settings for multipliers
    const simSettings = this.costEngine.getSimSettings();

    // 5. Look up aircraft ID from fleet table
    let aircraftId = 0;
    if (aircraftRegistration) {
      const fleetRow = db
        .prepare('SELECT id, mtow_lbs FROM fleet WHERE registration = ?')
        .get(aircraftRegistration) as FleetLookupRow | undefined;
      if (fleetRow) {
        aircraftId = fleetRow.id;
      }
    }

    // 6. Get pilot pay rate from revenue model config
    const configRow = db
      .prepare('SELECT pilot_pay_per_hour FROM revenue_model_config WHERE id = 1')
      .get() as RevenueModelConfigRow | undefined;
    const pilotPayRate = configRow?.pilot_pay_per_hour ?? 85;

    // 7. Calculate flight costs
    let costs: FlightCostBreakdown;
    if (aircraftId > 0) {
      costs = this.costEngine.calculateFlightCosts({
        depIcao,
        arrIcao,
        distanceNm,
        blockHours,
        fuelUsedLbs,
        aircraftId,
        pilotPayRate,
      });
    } else {
      // No aircraft in fleet — estimate costs without maintenance reserve accrual
      logger.warn(TAG, `No fleet aircraft found for reg=${aircraftRegistration}, using estimated costs`);
      const depRates = this.costEngine.getAirportTierRates(depIcao);
      const arrRates = this.costEngine.getAirportTierRates(arrIcao);
      const defaultMtow = 150_000;
      const fuelCost = fuelUsedLbs * depRates.fuelPricePerLb * simSettings.fuelPriceFactor;
      const fuelServiceFee = fuelCost * depRates.fuelServicePct;
      const crewCost = blockHours * pilotPayRate;
      const landingFees = (defaultMtow / 1000) * (depRates.landingPer1000lbs + arrRates.landingPer1000lbs);
      // Handling rates are flat fees per movement, not per-1000lbs
      const handlingDepFees = depRates.handlingPer1000lbs;
      const handlingArrFees = arrRates.handlingPer1000lbs;
      const navFees = distanceNm * depRates.navPerNm;
      const authorityFees = depRates.authorityFee + arrRates.authorityFee;
      const maintenanceReserve = 0;
      const totalDoc = (fuelCost + fuelServiceFee + crewCost + landingFees + handlingDepFees + handlingArrFees + navFees + authorityFees) * simSettings.costMultiplier;

      // Look up handler names
      const depHandlerRow = db.prepare('SELECT handler FROM airports WHERE icao = ?').get(depIcao) as { handler: string | null } | undefined;
      const arrHandlerRow = db.prepare('SELECT handler FROM airports WHERE icao = ?').get(arrIcao) as { handler: string | null } | undefined;

      costs = {
        fuelCost, fuelServiceFee, crewCost, landingFees,
        handlingDepFees, handlingArrFees, navFees, authorityFees,
        maintenanceReserve, totalDoc,
        depHandler: depHandlerRow?.handler ?? null,
        arrHandler: arrHandlerRow?.handler ?? null,
      };
    }

    // 8. Fuel surcharge: 15% pass-through of fuel cost
    const fuelSurchargeRev = costs.fuelCost * 0.15;

    // 9. Total revenue with multiplier
    const totalRevenue = (adjustedRevenue + fuelSurchargeRev) * simSettings.revenueMultiplier;

    // 10. Margin calculations
    const operatingMargin = totalRevenue - costs.totalDoc;
    const marginPct = totalRevenue > 0
      ? (operatingMargin / totalRevenue) * 100
      : 0;

    // 11. INSERT into finance_flight_pnl
    const handlingFeesTotal = costs.handlingDepFees + costs.handlingArrFees;
    const grossProfit = totalRevenue - (costs.fuelCost + costs.fuelServiceFee + costs.crewCost + costs.landingFees + handlingFeesTotal + costs.navFees + costs.authorityFees);
    const totalVariableCost = costs.fuelCost + costs.fuelServiceFee + costs.crewCost + costs.landingFees + handlingFeesTotal + costs.navFees + costs.authorityFees;
    const totalFixedAlloc = costs.maintenanceReserve;

    db.prepare(`
      INSERT INTO finance_flight_pnl (
        logbook_id, aircraft_id,
        cargo_revenue, pax_revenue, charter_premium, fuel_surcharge, total_revenue,
        fuel_cost, landing_fee, handling_fee, nav_fee, parking_fee, crew_cost, total_variable_cost,
        fuel_service_fee, authority_fees, dep_handler, arr_handler,
        maint_reserve, lease_alloc, insurance_alloc, depreciation_alloc, total_fixed_alloc,
        gross_profit, net_profit, margin_pct,
        block_hours, distance_nm, payload_lbs, load_factor,
        fuel_price_snapshot, lane_rate_snapshot, demand_multiplier
      ) VALUES (
        ?, ?,
        ?, 0, 0, ?, ?,
        ?, ?, ?, ?, 0, ?, ?,
        ?, ?, ?, ?,
        ?, 0, 0, 0, ?,
        ?, ?, ?,
        ?, ?, ?, 0,
        ?, ?, ?
      )
    `).run(
      pirepId, aircraftId > 0 ? aircraftId : null,
      adjustedRevenue, fuelSurchargeRev, totalRevenue,
      costs.fuelCost, costs.landingFees, handlingFeesTotal, costs.navFees, costs.crewCost, totalVariableCost,
      costs.fuelServiceFee, costs.authorityFees, costs.depHandler, costs.arrHandler,
      costs.maintenanceReserve, totalFixedAlloc,
      grossProfit, operatingMargin, marginPct,
      blockHours, distanceNm, cargoLbs,
      simSettings.fuelPriceFactor, laneResult.rate, laneResult.modifier,
    );

    // 12. Create finance ledger entries
    // Pilot pay
    this.financeService.create({
      pilotId,
      type: 'pay',
      amount: breakdown.pilotPay,
      description: `Flight pay: ${depIcao}-${arrIcao}`,
      pirepId,
    }, pilotId);

    // Cargo revenue (airline-level income)
    if (totalRevenue > 0) {
      this.financeService.create({
        pilotId: null,
        type: 'income',
        amount: totalRevenue,
        description: `Cargo revenue: ${depIcao}-${arrIcao} (${cargoLbs.toLocaleString()} lbs)`,
        pirepId,
        category: 'cargo',
      }, 0);
    }

    // Direct operating costs (airline-level expense)
    if (costs.totalDoc > 0) {
      this.financeService.create({
        pilotId: null,
        type: 'expense',
        amount: costs.totalDoc,
        description: `Direct operating costs: ${depIcao}-${arrIcao}`,
        pirepId,
        category: 'doc',
      }, 0);
    }

    const pnl: FlightPnL = {
      pirepId,
      aircraftId: aircraftId > 0 ? aircraftId : null,
      pilotId,
      depIcao,
      arrIcao,
      distanceNm,
      blockHours,
      cargoLbs,
      cargoRevenue: adjustedRevenue,
      fuelSurchargeRev,
      laneRateModifier: laneResult.modifier,
      totalRevenue,
      costs,
      operatingMargin,
      marginPct: Math.round(marginPct * 100) / 100,
      costMultiplier: simSettings.costMultiplier,
      revenueMultiplier: simSettings.revenueMultiplier,
    };

    logger.info(TAG, `P&L recorded for PIREP #${pirepId}: rev=$${totalRevenue.toFixed(2)} doc=$${costs.totalDoc.toFixed(2)} margin=${marginPct.toFixed(1)}%`);

    return pnl;
  }
}

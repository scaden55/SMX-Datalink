/**
 * Finance Engine Store — Persistence layer.
 *
 * All database I/O for the finance engine goes through this class.
 * Pure calculation modules never touch the DB directly.
 */

import { getDb } from '../../db/index.js';
import type {
  FinanceAircraftProfileRow,
  FinanceStationFeesRow,
  FinanceRateConfigRow,
  FinanceLaneRateRow,
  FinanceCommodityRateRow,
  FinanceMaintThresholdRow,
  FinanceRatedManifestRow,
  FinanceRatedShipmentRow,
  FinanceFlightPnLRow,
  FinanceFlightPnLJoinRow,
  FinancePeriodPnLRow,
  FinanceEventRow,
} from '../../types/db-rows.js';
import type {
  FinanceRateConfig,
  StationFees,
  FinanceAircraftProfile,
  MaintThreshold,
  RatedManifest,
  RatedShipment,
  FlightPnL,
  PeriodPnL,
  OperationalEvent,
  CommodityCode,
  LaneRate,
  CommodityRate,
  PeriodType,
  FinanceCheckType,
} from '@acars/shared';

// ─────────────────────────────────────────────────────────────
// Row → Domain mappers
// ─────────────────────────────────────────────────────────────

function mapProfileRow(r: FinanceAircraftProfileRow): FinanceAircraftProfile {
  return {
    id: r.id,
    aircraftId: r.aircraft_id,
    registration: r.registration,
    icaoType: r.icao_type,
    mtowLbs: r.mtow_lbs ?? 0,
    cargoCapacityLbs: r.cargo_capacity_lbs ?? 0,
    leaseType: r.lease_type as 'dry' | 'wet',
    leaseMonthly: r.lease_monthly,
    insuranceHullValue: r.insurance_hull_value,
    insuranceHullPct: r.insurance_hull_pct,
    insuranceLiability: r.insurance_liability,
    insuranceWarRisk: r.insurance_war_risk,
    baseFuelGph: r.base_fuel_gph,
    payloadFuelSensitivity: r.payload_fuel_sensitivity,
    maintReservePerFh: r.maint_reserve_per_fh,
    crewPerDiem: r.crew_per_diem,
    crewHotelRate: r.crew_hotel_rate,
  };
}

function mapStationRow(r: FinanceStationFeesRow): StationFees {
  return {
    id: r.id,
    icao: r.icao,
    landingRate: r.landing_rate,
    parkingRate: r.parking_rate,
    groundHandling: r.ground_handling,
    fuelPriceGal: r.fuel_price_gal,
    navFeePerNm: r.nav_fee_per_nm,
    deiceFee: r.deice_fee,
    uldHandling: r.uld_handling,
  };
}

function mapRateConfigRow(r: FinanceRateConfigRow): FinanceRateConfig {
  return {
    fuelSurchargePct: r.fuel_surcharge_pct,
    securityFee: r.security_fee,
    charterMultiplier: r.charter_multiplier,
    defaultLaneRate: r.default_lane_rate,
    valuationChargePct: r.valuation_charge_pct,
    defaultFuelPrice: r.default_fuel_price,
  };
}

function mapMaintThresholdRow(r: FinanceMaintThresholdRow): MaintThreshold {
  return {
    id: r.id,
    checkType: r.check_type as FinanceCheckType,
    intervalHours: r.interval_hours,
    intervalYears: r.interval_years,
    costMin: r.cost_min,
    costMax: r.cost_max,
    downtimeDaysMin: r.downtime_days_min,
    downtimeDaysMax: r.downtime_days_max,
  };
}

// ─────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────

export class FinanceEngineStore {

  // ── Rate Config (single row) ───────────────────────────────

  getRateConfig(): FinanceRateConfig {
    const row = getDb().prepare('SELECT * FROM finance_rate_config WHERE id = 1').get() as FinanceRateConfigRow | undefined;
    if (!row) throw new Error('finance_rate_config row missing — migration not applied?');
    return mapRateConfigRow(row);
  }

  updateRateConfig(data: Partial<FinanceRateConfig>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.fuelSurchargePct !== undefined) { fields.push('fuel_surcharge_pct = ?'); values.push(data.fuelSurchargePct); }
    if (data.securityFee !== undefined) { fields.push('security_fee = ?'); values.push(data.securityFee); }
    if (data.charterMultiplier !== undefined) { fields.push('charter_multiplier = ?'); values.push(data.charterMultiplier); }
    if (data.defaultLaneRate !== undefined) { fields.push('default_lane_rate = ?'); values.push(data.defaultLaneRate); }
    if (data.valuationChargePct !== undefined) { fields.push('valuation_charge_pct = ?'); values.push(data.valuationChargePct); }
    if (data.defaultFuelPrice !== undefined) { fields.push('default_fuel_price = ?'); values.push(data.defaultFuelPrice); }

    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE finance_rate_config SET ${fields.join(', ')} WHERE id = 1`).run(...values);
  }

  // ── Lane Rates ─────────────────────────────────────────────

  getLaneRates(): LaneRate[] {
    const rows = getDb().prepare('SELECT * FROM finance_lane_rates ORDER BY origin_icao, dest_icao').all() as FinanceLaneRateRow[];
    return rows.map(r => ({
      id: r.id,
      originIcao: r.origin_icao,
      destIcao: r.dest_icao,
      ratePerLb: r.rate_per_lb,
    }));
  }

  getLaneRate(origin: string, dest: string): number | null {
    const row = getDb().prepare('SELECT rate_per_lb FROM finance_lane_rates WHERE origin_icao = ? AND dest_icao = ?').get(origin, dest) as { rate_per_lb: number } | undefined;
    return row?.rate_per_lb ?? null;
  }

  createLaneRate(origin: string, dest: string, ratePerLb: number): number {
    const result = getDb().prepare(
      'INSERT INTO finance_lane_rates (origin_icao, dest_icao, rate_per_lb) VALUES (?, ?, ?)'
    ).run(origin, dest, ratePerLb);
    return result.lastInsertRowid as number;
  }

  updateLaneRate(id: number, ratePerLb: number): void {
    getDb().prepare('UPDATE finance_lane_rates SET rate_per_lb = ? WHERE id = ?').run(ratePerLb, id);
  }

  deleteLaneRate(id: number): void {
    getDb().prepare('DELETE FROM finance_lane_rates WHERE id = ?').run(id);
  }

  // ── Commodity Rates ────────────────────────────────────────

  getCommodityRates(category?: string): CommodityRate[] {
    let sql = 'SELECT * FROM finance_commodity_rates';
    const params: string[] = [];
    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }
    sql += ' ORDER BY category, commodity_name';
    const rows = getDb().prepare(sql).all(...params) as FinanceCommodityRateRow[];
    return rows.map(r => ({
      id: r.id,
      category: r.category as CommodityRate['category'],
      commodityCode: r.commodity_code,
      commodityName: r.commodity_name,
      ratePerLb: r.rate_per_lb,
      hazmat: !!r.hazmat,
      tempControlled: !!r.temp_controlled,
    }));
  }

  /** Map commodity_code → rate_per_lb for the rating engine */
  getCommodityRateMap(): Map<CommodityCode, number> {
    const rows = getDb().prepare('SELECT commodity_code, rate_per_lb FROM finance_commodity_rates').all() as Pick<FinanceCommodityRateRow, 'commodity_code' | 'rate_per_lb'>[];
    const map = new Map<CommodityCode, number>();
    for (const r of rows) {
      map.set(r.commodity_code, r.rate_per_lb);
    }
    return map;
  }

  /** Map category → average rate_per_lb for fallback when no exact commodity match */
  getCategoryRateMap(): Map<string, number> {
    const rows = getDb().prepare(
      'SELECT category, AVG(rate_per_lb) as avg_rate FROM finance_commodity_rates GROUP BY category'
    ).all() as { category: string; avg_rate: number }[];
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.category, r.avg_rate);
    }
    return map;
  }

  updateCommodityRate(code: string, ratePerLb: number): void {
    getDb().prepare(
      "UPDATE finance_commodity_rates SET rate_per_lb = ?, updated_at = datetime('now') WHERE commodity_code = ?"
    ).run(ratePerLb, code);
  }

  createCommodityRate(data: { category: string; commodityCode: string; commodityName: string; ratePerLb: number; hazmat: boolean; tempControlled: boolean }): number {
    const result = getDb().prepare(
      `INSERT INTO finance_commodity_rates (category, commodity_code, commodity_name, rate_per_lb, hazmat, temp_controlled)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(data.category, data.commodityCode, data.commodityName, data.ratePerLb, data.hazmat ? 1 : 0, data.tempControlled ? 1 : 0);
    return Number(result.lastInsertRowid);
  }

  deleteCommodityRate(id: number): void {
    getDb().prepare('DELETE FROM finance_commodity_rates WHERE id = ?').run(id);
  }

  // ── Aircraft Profiles ──────────────────────────────────────

  getAircraftProfiles(): FinanceAircraftProfile[] {
    const rows = getDb().prepare(`
      SELECT p.*, f.registration, f.icao_type, f.mtow_lbs, f.cargo_capacity_lbs
      FROM finance_aircraft_profiles p
      JOIN fleet f ON f.id = p.aircraft_id
      ORDER BY f.registration
    `).all() as FinanceAircraftProfileRow[];
    return rows.map(mapProfileRow);
  }

  getAircraftProfile(aircraftId: number): FinanceAircraftProfile | null {
    const row = getDb().prepare(`
      SELECT p.*, f.registration, f.icao_type, f.mtow_lbs, f.cargo_capacity_lbs
      FROM finance_aircraft_profiles p
      JOIN fleet f ON f.id = p.aircraft_id
      WHERE p.aircraft_id = ?
    `).get(aircraftId) as FinanceAircraftProfileRow | undefined;
    return row ? mapProfileRow(row) : null;
  }

  getAircraftProfileById(id: number): FinanceAircraftProfile | null {
    const row = getDb().prepare(`
      SELECT p.*, f.registration, f.icao_type, f.mtow_lbs, f.cargo_capacity_lbs
      FROM finance_aircraft_profiles p
      JOIN fleet f ON f.id = p.aircraft_id
      WHERE p.id = ?
    `).get(id) as FinanceAircraftProfileRow | undefined;
    return row ? mapProfileRow(row) : null;
  }

  createAircraftProfile(data: {
    aircraftId: number;
    leaseType?: string;
    leaseMonthly?: number;
    insuranceHullValue?: number;
    insuranceHullPct?: number;
    insuranceLiability?: number;
    insuranceWarRisk?: number;
    baseFuelGph?: number;
    payloadFuelSensitivity?: number;
    maintReservePerFh?: number;
    crewPerDiem?: number;
    crewHotelRate?: number;
  }): number {
    const result = getDb().prepare(`
      INSERT INTO finance_aircraft_profiles (
        aircraft_id, lease_type, lease_monthly,
        insurance_hull_value, insurance_hull_pct, insurance_liability, insurance_war_risk,
        base_fuel_gph, payload_fuel_sensitivity, maint_reserve_per_fh,
        crew_per_diem, crew_hotel_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.aircraftId,
      data.leaseType ?? 'dry',
      data.leaseMonthly ?? 0,
      data.insuranceHullValue ?? 0,
      data.insuranceHullPct ?? 0.015,
      data.insuranceLiability ?? 0,
      data.insuranceWarRisk ?? 0,
      data.baseFuelGph ?? 800,
      data.payloadFuelSensitivity ?? 0.5,
      data.maintReservePerFh ?? 150,
      data.crewPerDiem ?? 4.50,
      data.crewHotelRate ?? 150,
    );
    return result.lastInsertRowid as number;
  }

  updateAircraftProfile(id: number, data: Partial<{
    leaseType: string;
    leaseMonthly: number;
    insuranceHullValue: number;
    insuranceHullPct: number;
    insuranceLiability: number;
    insuranceWarRisk: number;
    baseFuelGph: number;
    payloadFuelSensitivity: number;
    maintReservePerFh: number;
    crewPerDiem: number;
    crewHotelRate: number;
  }>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.leaseType !== undefined) { fields.push('lease_type = ?'); values.push(data.leaseType); }
    if (data.leaseMonthly !== undefined) { fields.push('lease_monthly = ?'); values.push(data.leaseMonthly); }
    if (data.insuranceHullValue !== undefined) { fields.push('insurance_hull_value = ?'); values.push(data.insuranceHullValue); }
    if (data.insuranceHullPct !== undefined) { fields.push('insurance_hull_pct = ?'); values.push(data.insuranceHullPct); }
    if (data.insuranceLiability !== undefined) { fields.push('insurance_liability = ?'); values.push(data.insuranceLiability); }
    if (data.insuranceWarRisk !== undefined) { fields.push('insurance_war_risk = ?'); values.push(data.insuranceWarRisk); }
    if (data.baseFuelGph !== undefined) { fields.push('base_fuel_gph = ?'); values.push(data.baseFuelGph); }
    if (data.payloadFuelSensitivity !== undefined) { fields.push('payload_fuel_sensitivity = ?'); values.push(data.payloadFuelSensitivity); }
    if (data.maintReservePerFh !== undefined) { fields.push('maint_reserve_per_fh = ?'); values.push(data.maintReservePerFh); }
    if (data.crewPerDiem !== undefined) { fields.push('crew_per_diem = ?'); values.push(data.crewPerDiem); }
    if (data.crewHotelRate !== undefined) { fields.push('crew_hotel_rate = ?'); values.push(data.crewHotelRate); }

    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(id);
    getDb().prepare(`UPDATE finance_aircraft_profiles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteAircraftProfile(id: number): void {
    getDb().prepare('DELETE FROM finance_aircraft_profiles WHERE id = ?').run(id);
  }

  // ── Station Fees ───────────────────────────────────────────

  getStationFees(): StationFees[] {
    const rows = getDb().prepare('SELECT * FROM finance_station_fees ORDER BY icao').all() as FinanceStationFeesRow[];
    return rows.map(mapStationRow);
  }

  getStationFee(icao: string): StationFees | null {
    const row = getDb().prepare('SELECT * FROM finance_station_fees WHERE icao = ?').get(icao) as FinanceStationFeesRow | undefined;
    return row ? mapStationRow(row) : null;
  }

  createStationFee(data: {
    icao: string;
    landingRate?: number;
    parkingRate?: number;
    groundHandling?: number;
    fuelPriceGal?: number;
    navFeePerNm?: number;
    deiceFee?: number;
    uldHandling?: number;
  }): number {
    const result = getDb().prepare(`
      INSERT INTO finance_station_fees (icao, landing_rate, parking_rate, ground_handling, fuel_price_gal, nav_fee_per_nm, deice_fee, uld_handling)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.icao,
      data.landingRate ?? 5.50,
      data.parkingRate ?? 25.00,
      data.groundHandling ?? 350.00,
      data.fuelPriceGal ?? 5.50,
      data.navFeePerNm ?? 0.12,
      data.deiceFee ?? 0,
      data.uldHandling ?? 15.00,
    );
    return result.lastInsertRowid as number;
  }

  updateStationFee(id: number, data: Partial<{
    landingRate: number;
    parkingRate: number;
    groundHandling: number;
    fuelPriceGal: number;
    navFeePerNm: number;
    deiceFee: number;
    uldHandling: number;
  }>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.landingRate !== undefined) { fields.push('landing_rate = ?'); values.push(data.landingRate); }
    if (data.parkingRate !== undefined) { fields.push('parking_rate = ?'); values.push(data.parkingRate); }
    if (data.groundHandling !== undefined) { fields.push('ground_handling = ?'); values.push(data.groundHandling); }
    if (data.fuelPriceGal !== undefined) { fields.push('fuel_price_gal = ?'); values.push(data.fuelPriceGal); }
    if (data.navFeePerNm !== undefined) { fields.push('nav_fee_per_nm = ?'); values.push(data.navFeePerNm); }
    if (data.deiceFee !== undefined) { fields.push('deice_fee = ?'); values.push(data.deiceFee); }
    if (data.uldHandling !== undefined) { fields.push('uld_handling = ?'); values.push(data.uldHandling); }

    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(id);
    getDb().prepare(`UPDATE finance_station_fees SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteStationFee(id: number): void {
    getDb().prepare('DELETE FROM finance_station_fees WHERE id = ?').run(id);
  }

  // ── Maintenance Thresholds ─────────────────────────────────

  getMaintThresholds(): MaintThreshold[] {
    const rows = getDb().prepare('SELECT * FROM finance_maint_thresholds ORDER BY check_type').all() as FinanceMaintThresholdRow[];
    return rows.map(mapMaintThresholdRow);
  }

  updateMaintThreshold(id: number, data: Partial<{
    intervalHours: number | null;
    intervalYears: number | null;
    costMin: number;
    costMax: number;
    downtimeDaysMin: number;
    downtimeDaysMax: number;
  }>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.intervalHours !== undefined) { fields.push('interval_hours = ?'); values.push(data.intervalHours); }
    if (data.intervalYears !== undefined) { fields.push('interval_years = ?'); values.push(data.intervalYears); }
    if (data.costMin !== undefined) { fields.push('cost_min = ?'); values.push(data.costMin); }
    if (data.costMax !== undefined) { fields.push('cost_max = ?'); values.push(data.costMax); }
    if (data.downtimeDaysMin !== undefined) { fields.push('downtime_days_min = ?'); values.push(data.downtimeDaysMin); }
    if (data.downtimeDaysMax !== undefined) { fields.push('downtime_days_max = ?'); values.push(data.downtimeDaysMax); }

    if (fields.length === 0) return;
    values.push(id);
    getDb().prepare(`UPDATE finance_maint_thresholds SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  // ── Rated Manifests ────────────────────────────────────────

  saveRatedManifest(manifest: RatedManifest): number {
    const db = getDb();

    const upsert = db.prepare(`
      INSERT INTO finance_rated_manifests (
        cargo_manifest_id, logbook_id, total_revenue, total_base_charge,
        total_surcharges, total_fuel_surcharge, total_security_fees,
        charter_multiplier, yield_per_lb, load_factor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cargo_manifest_id) DO UPDATE SET
        logbook_id = excluded.logbook_id,
        total_revenue = excluded.total_revenue,
        total_base_charge = excluded.total_base_charge,
        total_surcharges = excluded.total_surcharges,
        total_fuel_surcharge = excluded.total_fuel_surcharge,
        total_security_fees = excluded.total_security_fees,
        charter_multiplier = excluded.charter_multiplier,
        yield_per_lb = excluded.yield_per_lb,
        load_factor = excluded.load_factor,
        rated_at = datetime('now')
    `);

    const insertShipment = db.prepare(`
      INSERT INTO finance_rated_shipments (
        rated_manifest_id, awb_number, uld_id, category_code,
        actual_weight, chargeable_weight, base_charge, commodity_surcharge,
        fuel_surcharge, security_fee, valuation_charge, total_charge
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const deleteShipments = db.prepare('DELETE FROM finance_rated_shipments WHERE rated_manifest_id = ?');

    const txn = db.transaction(() => {
      const result = upsert.run(
        manifest.cargoManifestId,
        manifest.logbookId,
        manifest.totalRevenue,
        manifest.totalBaseCharge,
        manifest.totalSurcharges,
        manifest.totalFuelSurcharge,
        manifest.totalSecurityFees,
        manifest.charterMultiplier,
        manifest.yieldPerLb,
        manifest.loadFactor,
      );

      const manifestId = result.lastInsertRowid as number;

      // Clear old shipments and re-insert
      deleteShipments.run(manifestId);

      for (const s of manifest.shipments) {
        insertShipment.run(
          manifestId,
          s.awbNumber,
          s.uldId ?? null,
          s.commodityCode,
          s.actualWeight,
          s.chargeableWeight,
          s.baseCharge,
          s.commoditySurcharge,
          s.fuelSurcharge,
          s.securityFee,
          s.valuationCharge,
          s.totalCharge,
        );
      }

      return manifestId;
    });

    return txn();
  }

  getRatedManifests(page = 1, pageSize = 50): { items: FinanceRatedManifestRow[]; total: number } {
    const total = (getDb().prepare('SELECT COUNT(*) as count FROM finance_rated_manifests').get() as { count: number }).count;
    const items = getDb().prepare(
      'SELECT * FROM finance_rated_manifests ORDER BY rated_at DESC LIMIT ? OFFSET ?'
    ).all(pageSize, (page - 1) * pageSize) as FinanceRatedManifestRow[];
    return { items, total };
  }

  getRatedManifest(id: number): { manifest: FinanceRatedManifestRow; shipments: FinanceRatedShipmentRow[] } | null {
    const manifest = getDb().prepare('SELECT * FROM finance_rated_manifests WHERE id = ?').get(id) as FinanceRatedManifestRow | undefined;
    if (!manifest) return null;
    const shipments = getDb().prepare('SELECT * FROM finance_rated_shipments WHERE rated_manifest_id = ? ORDER BY awb_number').all(id) as FinanceRatedShipmentRow[];
    return { manifest, shipments };
  }

  getRatedManifestByCargoId(cargoManifestId: number): FinanceRatedManifestRow | null {
    return (getDb().prepare('SELECT * FROM finance_rated_manifests WHERE cargo_manifest_id = ?').get(cargoManifestId) as FinanceRatedManifestRow | undefined) ?? null;
  }

  // ── Operational Events ─────────────────────────────────────

  saveEvent(event: OperationalEvent, logbookId?: number | null): number {
    const result = getDb().prepare(`
      INSERT INTO finance_events (logbook_id, event_type, title, description, financial_impact)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      logbookId ?? null,
      event.eventType,
      event.title,
      event.description,
      event.financialImpact,
    );
    return result.lastInsertRowid as number;
  }

  getEvents(page = 1, pageSize = 50): { items: FinanceEventRow[]; total: number } {
    const total = (getDb().prepare('SELECT COUNT(*) as count FROM finance_events').get() as { count: number }).count;
    const items = getDb().prepare(
      'SELECT * FROM finance_events ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(pageSize, (page - 1) * pageSize) as FinanceEventRow[];
    return { items, total };
  }

  getEventByLogbookId(logbookId: number): FinanceEventRow | null {
    return (getDb().prepare('SELECT * FROM finance_events WHERE logbook_id = ?').get(logbookId) as FinanceEventRow | undefined) ?? null;
  }

  // ── Flight P&L ─────────────────────────────────────────────

  saveFlightPnL(pnl: FlightPnL, eventId?: number | null): void {
    getDb().prepare(`
      INSERT INTO finance_flight_pnl (
        logbook_id, rated_manifest_id, cargo_revenue,
        fuel_cost, landing_fee, parking_fee, handling_fee, nav_fee, deice_fee, uld_fee, crew_cost,
        total_variable_cost, maint_reserve, lease_alloc, insurance_alloc, total_fixed_alloc,
        gross_profit, margin_pct, load_factor, break_even_lf,
        revenue_per_bh, cost_per_bh, block_hours, payload_lbs, event_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(logbook_id) DO UPDATE SET
        rated_manifest_id = excluded.rated_manifest_id,
        cargo_revenue = excluded.cargo_revenue,
        fuel_cost = excluded.fuel_cost,
        landing_fee = excluded.landing_fee,
        parking_fee = excluded.parking_fee,
        handling_fee = excluded.handling_fee,
        nav_fee = excluded.nav_fee,
        deice_fee = excluded.deice_fee,
        uld_fee = excluded.uld_fee,
        crew_cost = excluded.crew_cost,
        total_variable_cost = excluded.total_variable_cost,
        maint_reserve = excluded.maint_reserve,
        lease_alloc = excluded.lease_alloc,
        insurance_alloc = excluded.insurance_alloc,
        total_fixed_alloc = excluded.total_fixed_alloc,
        gross_profit = excluded.gross_profit,
        margin_pct = excluded.margin_pct,
        load_factor = excluded.load_factor,
        break_even_lf = excluded.break_even_lf,
        revenue_per_bh = excluded.revenue_per_bh,
        cost_per_bh = excluded.cost_per_bh,
        block_hours = excluded.block_hours,
        payload_lbs = excluded.payload_lbs,
        event_id = excluded.event_id,
        computed_at = datetime('now')
    `).run(
      pnl.logbookId,
      pnl.ratedManifestId,
      pnl.cargoRevenue,
      pnl.fuelCost,
      pnl.landingFee,
      pnl.parkingFee,
      pnl.handlingFee,
      pnl.navFee,
      pnl.deiceFee,
      pnl.uldFee,
      pnl.crewCost,
      pnl.totalVariableCost,
      pnl.maintReserve,
      pnl.leaseAlloc,
      pnl.insuranceAlloc,
      pnl.totalFixedAlloc,
      pnl.grossProfit,
      pnl.marginPct,
      pnl.loadFactor,
      pnl.breakEvenLf,
      pnl.revenuePerBh,
      pnl.costPerBh,
      pnl.blockHours,
      pnl.payloadLbs,
      eventId ?? null,
    );
  }

  getFlightPnLList(page = 1, pageSize = 50): { items: FinanceFlightPnLJoinRow[]; total: number } {
    const total = (getDb().prepare('SELECT COUNT(*) as count FROM finance_flight_pnl').get() as { count: number }).count;
    const items = getDb().prepare(`
      SELECT p.*, l.flight_number, l.dep_icao, l.arr_icao
      FROM finance_flight_pnl p
      JOIN logbook l ON l.id = p.logbook_id
      ORDER BY p.computed_at DESC
      LIMIT ? OFFSET ?
    `).all(pageSize, (page - 1) * pageSize) as FinanceFlightPnLJoinRow[];
    return { items, total };
  }

  getFlightPnL(logbookId: number): FinanceFlightPnLJoinRow | null {
    return (getDb().prepare(`
      SELECT p.*, l.flight_number, l.dep_icao, l.arr_icao
      FROM finance_flight_pnl p
      JOIN logbook l ON l.id = p.logbook_id
      WHERE p.logbook_id = ?
    `).get(logbookId) as FinanceFlightPnLJoinRow | undefined) ?? null;
  }

  // ── Period P&L ─────────────────────────────────────────────

  savePeriodPnL(pnl: PeriodPnL): void {
    getDb().prepare(`
      INSERT INTO finance_period_pnl (
        period_type, period_key, total_revenue, total_variable_cost, total_fixed_cost,
        ebitda, ebitdar, casm, rasm, avg_yield, total_flights, total_block_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(period_type, period_key) DO UPDATE SET
        total_revenue = excluded.total_revenue,
        total_variable_cost = excluded.total_variable_cost,
        total_fixed_cost = excluded.total_fixed_cost,
        ebitda = excluded.ebitda,
        ebitdar = excluded.ebitdar,
        casm = excluded.casm,
        rasm = excluded.rasm,
        avg_yield = excluded.avg_yield,
        total_flights = excluded.total_flights,
        total_block_hours = excluded.total_block_hours,
        computed_at = datetime('now')
    `).run(
      pnl.periodType,
      pnl.periodKey,
      pnl.totalRevenue,
      pnl.totalVariableCost,
      pnl.totalFixedCost,
      pnl.ebitda,
      pnl.ebitdar,
      pnl.casm,
      pnl.rasm,
      pnl.avgYield,
      pnl.totalFlights,
      pnl.totalBlockHours,
    );
  }

  getPeriodPnLList(periodType?: PeriodType): FinancePeriodPnLRow[] {
    if (periodType) {
      return getDb().prepare(
        'SELECT * FROM finance_period_pnl WHERE period_type = ? ORDER BY period_key DESC'
      ).all(periodType) as FinancePeriodPnLRow[];
    }
    return getDb().prepare(
      'SELECT * FROM finance_period_pnl ORDER BY period_type, period_key DESC'
    ).all() as FinancePeriodPnLRow[];
  }

  // ── Helpers for computation ────────────────────────────────

  /** Count flights for an aircraft in the current month (for fixed cost allocation). */
  getMonthlyFlightCount(aircraftId: number): number {
    const row = getDb().prepare(`
      SELECT COUNT(*) as count FROM logbook l
      JOIN fleet f ON f.registration = l.aircraft_registration
      WHERE f.id = ?
        AND l.actual_dep >= date('now', 'start of month')
    `).get(aircraftId) as { count: number };
    return row.count;
  }

  /** Get all flight P&L records for a given period (for period aggregation). */
  getFlightPnLsForPeriod(periodType: PeriodType, periodKey: string): FlightPnL[] {
    let dateFilter: string;
    if (periodType === 'monthly') {
      // periodKey = '2026-03'
      dateFilter = `p.computed_at >= '${periodKey}-01' AND p.computed_at < date('${periodKey}-01', '+1 month')`;
    } else if (periodType === 'quarterly') {
      // periodKey = '2026-Q1'
      const [year, q] = periodKey.split('-Q');
      const startMonth = (parseInt(q) - 1) * 3 + 1;
      const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      dateFilter = `p.computed_at >= '${start}' AND p.computed_at < date('${start}', '+3 months')`;
    } else {
      // annual, periodKey = '2026'
      dateFilter = `p.computed_at >= '${periodKey}-01-01' AND p.computed_at < date('${periodKey}-01-01', '+1 year')`;
    }

    const rows = getDb().prepare(`
      SELECT p.*, l.flight_number, l.dep_icao, l.arr_icao
      FROM finance_flight_pnl p
      JOIN logbook l ON l.id = p.logbook_id
      WHERE ${dateFilter}
      ORDER BY p.computed_at
    `).all() as FinanceFlightPnLJoinRow[];

    return rows.map(r => ({
      logbookId: r.logbook_id,
      flightNumber: r.flight_number,
      depIcao: r.dep_icao,
      arrIcao: r.arr_icao,
      ratedManifestId: r.rated_manifest_id,
      cargoRevenue: r.cargo_revenue,
      fuelCost: r.fuel_cost,
      landingFee: r.landing_fee,
      parkingFee: r.parking_fee,
      handlingFee: r.handling_fee,
      navFee: r.nav_fee,
      deiceFee: r.deice_fee,
      uldFee: r.uld_fee,
      crewCost: r.crew_cost,
      totalVariableCost: r.total_variable_cost,
      maintReserve: r.maint_reserve,
      leaseAlloc: r.lease_alloc,
      insuranceAlloc: r.insurance_alloc,
      totalFixedAlloc: r.total_fixed_alloc,
      grossProfit: r.gross_profit,
      marginPct: r.margin_pct,
      loadFactor: r.load_factor,
      breakEvenLf: r.break_even_lf,
      revenuePerBh: r.revenue_per_bh,
      costPerBh: r.cost_per_bh,
      blockHours: r.block_hours,
      payloadLbs: r.payload_lbs,
      event: null,
    }));
  }
}

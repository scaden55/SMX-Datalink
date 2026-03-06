// ─── Finance Engine Types ────────────────────────────────────────
// Pure interfaces for the cargo airline finance engine.
// Shared between backend calculation modules and admin UI.

// ─── Commodity Code Mapping ──────────────────────────────────────

/** Commodity code string (e.g. 'DGR-LITH', 'PHR-VAX') */
export type CommodityCode = string;

/** Cargo category codes matching cargo-categories.ts */
export type CommodityCategoryCode =
  | 'general_freight'
  | 'pharmaceuticals'
  | 'seafood'
  | 'electronics'
  | 'industrial_machinery'
  | 'automotive'
  | 'textiles'
  | 'dangerous_goods'
  | 'live_animals'
  | 'ecommerce';

/** Display labels for commodity categories */
export const COMMODITY_CATEGORY_LABELS: Record<CommodityCategoryCode, string> = {
  general_freight: 'General Freight',
  pharmaceuticals: 'Pharmaceuticals',
  seafood: 'Seafood & Perishables',
  electronics: 'Electronics',
  industrial_machinery: 'Industrial Machinery',
  automotive: 'Automotive Parts',
  textiles: 'Textiles & Garments',
  dangerous_goods: 'Dangerous Goods',
  live_animals: 'Live Animals',
  ecommerce: 'E-Commerce',
};

// ─── Rate Configuration ──────────────────────────────────────────

export interface FinanceRateConfig {
  fuelSurchargePct: number;
  securityFee: number;
  charterMultiplier: number;
  defaultLaneRate: number;
  valuationChargePct: number;
  defaultFuelPrice: number;
}

export interface LaneRate {
  id: number;
  originIcao: string;
  destIcao: string;
  ratePerLb: number;
}

export interface CommodityRate {
  id: number;
  category: CommodityCategoryCode;
  commodityCode: CommodityCode;
  commodityName: string;
  ratePerLb: number;
  hazmat: boolean;
  tempControlled: boolean;
}

// ─── Aircraft Financial Profile ──────────────────────────────────

export type LeaseType = 'dry' | 'wet';

export interface FinanceAircraftProfile {
  id: number;
  aircraftId: number;
  registration: string;
  icaoType: string;
  mtowLbs: number;
  cargoCapacityLbs: number;
  leaseType: LeaseType;
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
}

export interface CreateAircraftProfileRequest {
  aircraftId: number;
  leaseType?: LeaseType;
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
}

export interface UpdateAircraftProfileRequest extends Partial<Omit<CreateAircraftProfileRequest, 'aircraftId'>> {}

// ─── Station Fees ────────────────────────────────────────────────

export interface StationFees {
  id: number;
  icao: string;
  landingRate: number;
  parkingRate: number;
  groundHandling: number;
  fuelPriceGal: number;
  navFeePerNm: number;
  deiceFee: number;
  uldHandling: number;
}

export interface CreateStationFeesRequest {
  icao: string;
  landingRate?: number;
  parkingRate?: number;
  groundHandling?: number;
  fuelPriceGal?: number;
  navFeePerNm?: number;
  deiceFee?: number;
  uldHandling?: number;
}

export interface UpdateStationFeesRequest extends Partial<Omit<CreateStationFeesRequest, 'icao'>> {}

// ─── Maintenance Thresholds ──────────────────────────────────────

export type FinanceCheckType = 'A' | 'C' | 'D' | 'ESV';

export interface MaintThreshold {
  id: number;
  checkType: FinanceCheckType;
  intervalHours: number | null;
  intervalYears: number | null;
  costMin: number;
  costMax: number;
  downtimeDaysMin: number;
  downtimeDaysMax: number;
}

export interface MaintCheckAlert {
  checkType: FinanceCheckType;
  currentHours: number;
  thresholdHours: number;
  hoursSinceCheck: number;
  hoursRemaining: number;
  pctUsed: number;
  costRange: { min: number; max: number };
  downtimeRange: { minDays: number; maxDays: number };
  status: 'ok' | 'approaching' | 'due' | 'overdue';
}

// ─── Rating Output ───────────────────────────────────────────────

export interface RatedShipment {
  awbNumber: string;
  uldId: string | null;
  commodityCode: CommodityCode;
  actualWeight: number;
  chargeableWeight: number;
  baseCharge: number;
  commoditySurcharge: number;
  fuelSurcharge: number;
  securityFee: number;
  valuationCharge: number;
  totalCharge: number;
}

export interface RatedManifest {
  id?: number;
  cargoManifestId: number;
  logbookId?: number | null;
  shipments: RatedShipment[];
  totalRevenue: number;
  totalBaseCharge: number;
  totalSurcharges: number;
  totalFuelSurcharge: number;
  totalSecurityFees: number;
  charterMultiplier: number;
  yieldPerLb: number;
  loadFactor: number;
  ratedAt?: string;
}

export interface RatedManifestSummary {
  id: number;
  cargoManifestId: number;
  logbookId: number | null;
  totalRevenue: number;
  yieldPerLb: number;
  loadFactor: number;
  shipmentCount: number;
  ratedAt: string;
}

// ─── Flight Cost Breakdown ───────────────────────────────────────

export interface FlightCostBreakdown {
  fuelCost: number;
  landingFee: number;
  parkingFee: number;
  handlingFee: number;
  navFee: number;
  deiceFee: number;
  uldFee: number;
  crewCost: number;
  totalVariableCost: number;
}

// ─── Fixed Cost Allocation ───────────────────────────────────────

export interface FixedCostAllocation {
  maintReserve: number;
  leaseAlloc: number;
  insuranceAlloc: number;
  totalFixedAlloc: number;
}

// ─── P&L ─────────────────────────────────────────────────────────

export interface FlightPnL {
  id?: number;
  logbookId: number;
  flightNumber?: string;
  depIcao?: string;
  arrIcao?: string;
  ratedManifestId: number | null;
  cargoRevenue: number;
  fuelCost: number;
  landingFee: number;
  parkingFee: number;
  handlingFee: number;
  navFee: number;
  deiceFee: number;
  uldFee: number;
  crewCost: number;
  totalVariableCost: number;
  maintReserve: number;
  leaseAlloc: number;
  insuranceAlloc: number;
  totalFixedAlloc: number;
  grossProfit: number;
  marginPct: number;
  loadFactor: number;
  breakEvenLf: number;
  revenuePerBh: number;
  costPerBh: number;
  blockHours: number;
  payloadLbs: number;
  event: OperationalEvent | null;
  computedAt?: string;
}

export type PeriodType = 'monthly' | 'quarterly' | 'annual';

export interface PeriodPnL {
  id?: number;
  periodType: PeriodType;
  periodKey: string;
  totalRevenue: number;
  totalVariableCost: number;
  totalFixedCost: number;
  ebitda: number;
  ebitdar: number;
  casm: number;
  rasm: number;
  avgYield: number;
  totalFlights: number;
  totalBlockHours: number;
  computedAt?: string;
}

// ─── Operational Events ──────────────────────────────────────────

export type OpEventType =
  | 'crew_delay'
  | 'customs_hold'
  | 'weather_divert'
  | 'cargo_claim'
  | 'aog'
  | 'dgr_rejection';

export interface OperationalEvent {
  id?: number;
  logbookId?: number;
  eventType: OpEventType;
  title: string;
  description: string;
  financialImpact: number;
  createdAt?: string;
}

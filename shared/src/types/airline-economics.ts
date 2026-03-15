// ── Airport Economics ─────────────────────────────────────
export type AirportFeeTier = 'international_hub' | 'major_hub' | 'regional' | 'small';

export interface AirportFeeTierRates {
  tier: AirportFeeTier;
  landingPer1000lbs: number;
  handlingPer1000lbs: number;
  parkingPerHour: number;
  navPerNm: number;
  fuelPricePerLb: number;
  fuelServicePct: number;
  authorityFee: number;
}

// ── Fleet Financing ───────────────────────────────────────
export type AcquisitionType = 'purchased' | 'loan' | 'dry_lease' | 'wet_lease' | 'acmi';

export interface FleetFinancials {
  acquisitionType: AcquisitionType;
  acquisitionCost: number | null;
  downPayment: number | null;
  loanBalance: number | null;
  interestRate: number | null;
  loanTermMonths: number | null;
  leaseMonthly: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  insuranceMonthly: number;
  bookValue: number | null;
  usefulLifeYears: number | null;
  depreciationMonthly: number | null;
}

// ── Per-Flight P&L ────────────────────────────────────────
export interface FlightCostBreakdown {
  fuelCost: number;
  fuelServiceFee: number;
  crewCost: number;
  landingFees: number;
  handlingDepFees: number;
  handlingArrFees: number;
  navFees: number;
  authorityFees: number;
  maintenanceReserve: number;
  totalDoc: number;
  depHandler: string | null;
  arrHandler: string | null;
}

export interface FlightPnL {
  pirepId: number;
  aircraftId: number | null;
  pilotId: number;
  depIcao: string;
  arrIcao: string;
  distanceNm: number;
  blockHours: number;
  cargoLbs: number;
  cargoRevenue: number;
  fuelSurchargeRev: number;
  laneRateModifier: number;
  totalRevenue: number;
  costs: FlightCostBreakdown;
  operatingMargin: number;
  marginPct: number;
  costMultiplier: number;
  revenueMultiplier: number;
}

// ── Supply/Demand ─────────────────────────────────────────
export interface LaneRate {
  originIcao: string;
  destIcao: string;
  ratePerLb: number;
  demandScore: number;
  supplyScore: number;
  updatedAt: string;
}

// ── Period P&L ────────────────────────────────────────────
export interface PeriodPnL {
  periodKey: string;
  totalRevenue: number;
  cargoRevenue: number;
  fuelSurchargeRev: number;
  totalDoc: number;
  fuelCost: number;
  crewCost: number;
  landingFees: number;
  handlingFees: number;
  navFees: number;
  fuelServiceFee: number;
  authorityFees: number;
  maintenanceReserve: number;
  totalFixed: number;
  leasePayments: number;
  loanPayments: number;
  insurance: number;
  depreciation: number;
  hangarParking: number;
  maintenanceShortfall: number;
  operatingIncome: number;
  ratm: number | null;
  catm: number | null;
  operatingMarginPct: number | null;
  fleetUtilizationPct: number | null;
  breakEvenLf: number | null;
  flightsCount: number;
  totalBlockHours: number;
}

// ── Difficulty Settings ───────────────────────────────────
export type DemandVolatility = 'low' | 'medium' | 'high';
export type FuelVariability = 'fixed' | 'moderate' | 'volatile';

export interface SimSettings {
  costMultiplier: number;
  revenueMultiplier: number;
  demandVolatility: DemandVolatility;
  maintenanceCostFactor: number;
  fuelPriceVariability: FuelVariability;
  fuelPriceFactor: number;
}

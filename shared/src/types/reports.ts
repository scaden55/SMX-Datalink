// ── Report Response Types ────────────────────────────────────────

export interface ReportSummary {
  totalFlights: number;
  totalHoursMin: number;
  totalDistanceNm: number;
  totalFuelLbs: number;
  totalPax: number;
  totalCargoLbs: number;
  avgScore: number | null;
  avgLandingRate: number | null;
}

export interface RevenueBreakdown {
  cargoRevenue: number;
  passengerRevenue: number;
  totalRevenue: number;
}

export interface ExpenseBreakdown {
  fuelCost: number;
  crewCost: number;
  landingFees: number;
  maintenanceCost: number;
  totalExpenses: number;
}

export interface FinancialSummary {
  revenue: RevenueBreakdown;
  expenses: ExpenseBreakdown;
  netProfit: number;
  profitMargin: number; // percentage, e.g. 18.5
}

export interface AircraftFinancials {
  aircraftType: string;
  flights: number;
  hoursMin: number;
  financials: FinancialSummary;
}

export interface TopAirportPair {
  depIcao: string;
  arrIcao: string;
  depName: string | null;
  arrName: string | null;
  flights: number;
}

export interface PilotBreakdown {
  callsign: string;
  pilotName: string;
  flights: number;
  hoursMin: number;
  avgScore: number | null;
}

export interface DailyVolume {
  date: string;   // "YYYY-MM-DD" for month mode, "YYYY-MM" for all-time
  flights: number;
}

export interface ReportResponse {
  period: string;  // "YYYY-MM" or "all-time"
  summary: ReportSummary;
  financials: FinancialSummary;
  financialsByAircraft: AircraftFinancials[];
  topRoutes: TopAirportPair[];
  byPilot: PilotBreakdown[];
  volume: DailyVolume[];
}

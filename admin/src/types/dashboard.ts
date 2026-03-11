// ── Financial KPIs (existing endpoint, extended) ─────────────
export interface MonthData {
  label: string;
  income: number;
  expenses: number;
}

export interface FinancialKPIs {
  balance: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    months: MonthData[];
  };
  revenue: {
    totalRtm: number;
    totalFlights: number;
    yieldByRoute: { route: string; flights: number; revenue: number; rtm: number; yieldPerRtm: number }[];
    fleetAvgLoadFactor: number;
    charterRevenue: number;
    charterFlights: number;
    fuelSurchargeRecovery: number;
  };
  costs: {
    fuelPerBlockHour: number;
    costPerRtm: number;
    crewPerBlockHour: number;
    maintByTail: { tail: string; cycles: number; costPerCycle: number }[];
  };
  profitability: {
    ratm: number;
    catm: number;
    ratmCatmSpread: number;
    ratmTrend: number[];
    catmTrend: number[];
    marginByRoute: { route: string; flights: number; revenue: number; profit: number; marginPct: number }[];
    marginByType: { type: string; flights: number; revenue: number; contribution: number; marginPct: number }[];
  };
  network: {
    revenueByStation: { station: string; departures: number; revenuePerDeparture: number }[];
    hubLoadFactor: number;
    outstationLoadFactor: number;
    hubs: string[];
    yieldTrend: { label: string; yield: number }[];
  };
}

// ── Maintenance Summary (new endpoint) ───────────────────────
export interface MaintenanceSummary {
  fleetStatus: {
    airworthy: number;
    melDispatch: number;
    inCheck: number;
    aog: number;
  };
  criticalMel: {
    registration: string;
    category: string;
    title: string;
    expiryDate: string;
    hoursRemaining: number;
  }[];
  nextChecks: {
    registration: string;
    checkType: string;
    hoursRemaining: number;
    intervalHours: number;
    pctRemaining: number;
  }[];
}

// ── Flight Activity (new endpoint) ───────────────────────────
export interface FlightActivity {
  scheduled: {
    flightNumber: string;
    callsign: string;
    depIcao: string;
    arrIcao: string;
    depTime: string;
  }[];
  completed: {
    flightNumber: string;
    callsign: string;
    depIcao: string;
    arrIcao: string;
    completedAt: string;
  }[];
}

export interface Airport {
  id: number;
  icao: string;
  name: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
}

export type FleetStatus = 'active' | 'stored' | 'retired' | 'maintenance';

export interface FleetAircraft {
  id: number;
  icaoType: string;
  name: string;
  registration: string;
  airline: string;
  rangeNm: number;
  cruiseSpeed: number;
  paxCapacity: number;
  cargoCapacityLbs: number;
  isActive: boolean;
  status: FleetStatus;
  baseIcao: string | null;
  locationIcao: string | null;
  remarks: string | null;
  updatedAt: string | null;
  // Weight specs (lbs)
  oewLbs: number | null;
  mzfwLbs: number | null;
  mtowLbs: number | null;
  mlwLbs: number | null;
  maxFuelLbs: number | null;
  // Airframe details
  engines: string | null;
  ceilingFt: number | null;
  iataType: string | null;
  configuration: string | null;
  isCargo: boolean;
  // Equipment codes
  equipCode: string | null;
  transponderCode: string | null;
  pbn: string | null;
  cat: string | null;
  selcal: string | null;
  hexCode: string | null;
}

export interface CreateFleetAircraftRequest {
  icaoType: string;
  name: string;
  registration: string;
  airline?: string;
  rangeNm: number;
  cruiseSpeed: number;
  paxCapacity: number;
  cargoCapacityLbs: number;
  status?: FleetStatus;
  baseIcao?: string;
  locationIcao?: string;
  remarks?: string;
  // Extended specs (optional)
  oewLbs?: number;
  mzfwLbs?: number;
  mtowLbs?: number;
  mlwLbs?: number;
  maxFuelLbs?: number;
  engines?: string;
  ceilingFt?: number;
  iataType?: string;
  configuration?: string;
  isCargo?: boolean;
  equipCode?: string;
  transponderCode?: string;
  pbn?: string;
  cat?: string;
  selcal?: string;
  hexCode?: string;
}

export interface UpdateFleetAircraftRequest {
  icaoType?: string;
  name?: string;
  registration?: string;
  airline?: string;
  rangeNm?: number;
  cruiseSpeed?: number;
  paxCapacity?: number;
  cargoCapacityLbs?: number;
  status?: FleetStatus;
  baseIcao?: string | null;
  locationIcao?: string | null;
  remarks?: string | null;
  // Extended specs
  oewLbs?: number | null;
  mzfwLbs?: number | null;
  mtowLbs?: number | null;
  mlwLbs?: number | null;
  maxFuelLbs?: number | null;
  engines?: string | null;
  ceilingFt?: number | null;
  iataType?: string | null;
  configuration?: string | null;
  isCargo?: boolean;
  equipCode?: string | null;
  transponderCode?: string | null;
  pbn?: string | null;
  cat?: string | null;
  selcal?: string | null;
  hexCode?: string | null;
}

export interface FleetListResponse {
  fleet: FleetAircraft[];
  total: number;
}

// ── SimBrief Aircraft Search ─────────────────────────────────────

export interface SimBriefAircraftType {
  aircraftIcao: string;
  aircraftName: string;
  engines: string;
  passengers: number;
  mtowLbs: number;
  speed: number;
  ceilingFt: number;
  fuelflowLbs: number;
  isCargo: boolean;
  oewLbs: number;
  mzfwLbs: number;
  mlwLbs: number;
  maxFuelLbs: number;
  maxPax: number;
  cat: string;
  equipCode: string;
  transponderCode: string;
  pbn: string;
}

export interface SimBriefAircraftSearchResponse {
  aircraft: SimBriefAircraftType[];
  cachedAt: string;
}

export type CharterType = 'reposition' | 'cargo' | 'passenger';

export interface ScheduledFlight {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  depTime: string;
  arrTime: string;
  distanceNm: number;
  flightTimeMin: number;
  daysOfWeek: string;
  isActive: boolean;
  charterType: CharterType | null;
}

export interface CreateCharterRequest {
  charterType: CharterType;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  depTime: string;
}

export interface CreateCharterResponse {
  schedule: ScheduleListItem;
  bid: BidWithDetails;
}

export interface Bid {
  id: number;
  userId: number;
  scheduleId: number;
  createdAt: string;
}

export interface BidWithDetails extends Bid {
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  depName: string;
  arrName: string;
  aircraftType: string;
  depTime: string;
  arrTime: string;
  distanceNm: number;
  flightTimeMin: number;
  daysOfWeek: string;
  charterType: CharterType | null;
}

export interface ScheduleListItem extends ScheduledFlight {
  depName: string;
  arrName: string;
  bidCount: number;
  hasBid: boolean;
}

export interface ScheduleListResponse {
  schedules: ScheduleListItem[];
  total: number;
}

export interface BidResponse {
  bid: BidWithDetails;
}

export interface MyBidsResponse {
  bids: BidWithDetails[];
  total: number;
}

export interface ActiveBidEntry extends BidWithDetails {
  pilotCallsign: string;
  pilotName: string;
}

export interface AllBidsResponse {
  bids: ActiveBidEntry[];
  total: number;
}

export interface DashboardStats {
  totalSchedules: number;
  totalPilots: number;
  totalFleet: number;
  totalHubs: number;
  activeFlights: number;
  pilotsOnline: number;
  flightsThisMonth: number;
  totalHours: number;
}

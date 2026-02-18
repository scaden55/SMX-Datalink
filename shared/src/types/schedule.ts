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
  charterType?: CharterType | null;
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
}

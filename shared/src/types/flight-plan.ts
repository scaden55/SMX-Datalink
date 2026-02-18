export interface Waypoint {
  ident: string;
  type: 'airport' | 'vor' | 'ndb' | 'intersection' | 'gps';
  latitude: number;
  longitude: number;
  altitude: number | null; // planned altitude, null if not specified
  isActive: boolean;
  distanceFromPrevious: number; // nautical miles
  ete: number | null; // seconds
  eta: string | null; // ISO timestamp
  passed: boolean;
}

export interface FlightPlan {
  id: string;
  origin: string; // ICAO
  destination: string; // ICAO
  alternates: string[]; // ICAO codes
  cruiseAltitude: number; // feet
  route: string; // ICAO route string
  waypoints: Waypoint[];
  totalDistance: number; // nautical miles
  activeWaypointIndex: number;
}

export interface FlightPlanProgress {
  distanceFlown: number; // nm
  distanceRemaining: number; // nm
  eteDestination: number | null; // seconds
  etaDestination: string | null; // ISO timestamp
  fuelAtDestination: number | null; // pounds
  topOfDescent: number | null; // distance from destination in nm
}

export const FlightPhase = {
  PREFLIGHT: 'PREFLIGHT',
  TAXI_OUT: 'TAXI_OUT',
  TAKEOFF: 'TAKEOFF',
  CLIMB: 'CLIMB',
  CRUISE: 'CRUISE',
  DESCENT: 'DESCENT',
  APPROACH: 'APPROACH',
  LANDING: 'LANDING',
  TAXI_IN: 'TAXI_IN',
  PARKED: 'PARKED',
} as const;

export type FlightPhase = (typeof FlightPhase)[keyof typeof FlightPhase];

/** Thresholds for flight phase detection */
export const PhaseThresholds = {
  GROUND_SPEED_TAXI: 5, // knots — above this = taxiing
  GROUND_SPEED_TAKEOFF: 40, // knots — above this during ground roll = takeoff
  LIFTOFF_VERTICAL_SPEED: 200, // fpm — positive VS + not on ground = airborne
  CLIMB_VS: 300, // fpm — sustained positive VS = climb
  CRUISE_VS_BAND: 200, // fpm — VS within ±200 = cruise
  DESCENT_VS: -300, // fpm — sustained negative VS = descent
  APPROACH_ALTITUDE_AGL: 3000, // feet AGL — below this during descent = approach
  LANDING_GEAR_DOWN_ALT: 5000, // feet AGL — gear down below this = landing config
  TOUCHDOWN_VS: -50, // fpm — negative VS + on ground = touchdown
  TAXI_IN_SPEED: 30, // knots — below this after landing = taxi in
} as const;

export interface AircraftPosition {
  latitude: number;
  longitude: number;
  altitude: number; // feet MSL
  heading: number; // degrees true
  airspeedIndicated: number; // knots
  airspeedTrue: number; // knots
  groundSpeed: number; // knots
  verticalSpeed: number; // feet per minute
  pitch: number; // degrees
  bank: number; // degrees
  altitudeAgl: number;   // feet above ground level (radar altimeter)
  totalWeight: number;   // current gross weight in pounds
  gForce: number;        // current G-load (1.0 = level flight)
}

export interface AutopilotState {
  master: boolean;
  altitudeHold: boolean;
  altitudeTarget: number; // feet
  headingHold: boolean;
  headingTarget: number; // degrees
  speedHold: boolean;
  speedTarget: number; // knots
  verticalSpeedHold: boolean;
  verticalSpeedTarget: number; // fpm
  approachHold: boolean;
  navHold: boolean;
}

export interface TransponderState {
  code: number; // squawk code (0000-7777 octal)
  ident: boolean;
}

export interface ComRadio {
  activeFrequency: number; // MHz
  standbyFrequency: number; // MHz
}

export interface NavRadio {
  activeFrequency: number; // MHz
  standbyFrequency: number; // MHz
}

export interface AircraftData {
  position: AircraftPosition;
  autopilot: AutopilotState;
  transponder: TransponderState;
  com1: ComRadio;
  com2: ComRadio;
  nav1: NavRadio;
  nav2: NavRadio;
  title: string;
  atcId: string; // tail number
  atcType: string;
  atcModel: string;
}

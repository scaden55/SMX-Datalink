import { SimConnectDataType } from 'node-simconnect';

export interface SimVarDefinition {
  name: string;
  units: string | null;
  dataType: SimConnectDataType;
}

/** Position & attitude SimVars */
export const POSITION_VARS: SimVarDefinition[] = [
  { name: 'PLANE LATITUDE', units: 'degrees', dataType: SimConnectDataType.FLOAT64 },
  { name: 'PLANE LONGITUDE', units: 'degrees', dataType: SimConnectDataType.FLOAT64 },
  { name: 'PLANE ALTITUDE', units: 'feet', dataType: SimConnectDataType.FLOAT64 },
  { name: 'PLANE HEADING DEGREES TRUE', units: 'degrees', dataType: SimConnectDataType.FLOAT64 },
  { name: 'AIRSPEED INDICATED', units: 'knots', dataType: SimConnectDataType.FLOAT64 },
  { name: 'AIRSPEED TRUE', units: 'knots', dataType: SimConnectDataType.FLOAT64 },
  { name: 'GROUND VELOCITY', units: 'knots', dataType: SimConnectDataType.FLOAT64 },
  { name: 'VERTICAL SPEED', units: 'feet per minute', dataType: SimConnectDataType.FLOAT64 },
  { name: 'PLANE PITCH DEGREES', units: 'degrees', dataType: SimConnectDataType.FLOAT64 },
  { name: 'PLANE BANK DEGREES', units: 'degrees', dataType: SimConnectDataType.FLOAT64 },
];

/** Engine SimVars (per-engine, indexed with :1, :2, etc.) */
export const ENGINE_VARS: SimVarDefinition[] = [
  { name: 'NUMBER OF ENGINES', units: 'number', dataType: SimConnectDataType.INT32 },
  { name: 'ENG N1 RPM:1', units: 'percent', dataType: SimConnectDataType.FLOAT64 },
  { name: 'ENG N2 RPM:1', units: 'percent', dataType: SimConnectDataType.FLOAT64 },
  { name: 'ENG FUEL FLOW GPH:1', units: 'gallons per hour', dataType: SimConnectDataType.FLOAT64 },
  { name: 'GENERAL ENG OIL TEMPERATURE:1', units: 'Rankine', dataType: SimConnectDataType.FLOAT64 },
  { name: 'GENERAL ENG OIL PRESSURE:1', units: 'psf', dataType: SimConnectDataType.FLOAT64 },
  { name: 'TURB ENG PRIMARY NOZZLE PERCENT:1', units: 'percent', dataType: SimConnectDataType.FLOAT64 }, // EGT proxy
  { name: 'TURB ENG ITT:1', units: 'Rankine', dataType: SimConnectDataType.FLOAT64 },
  { name: 'ENG N1 RPM:2', units: 'percent', dataType: SimConnectDataType.FLOAT64 },
  { name: 'ENG N2 RPM:2', units: 'percent', dataType: SimConnectDataType.FLOAT64 },
  { name: 'ENG FUEL FLOW GPH:2', units: 'gallons per hour', dataType: SimConnectDataType.FLOAT64 },
  { name: 'GENERAL ENG OIL TEMPERATURE:2', units: 'Rankine', dataType: SimConnectDataType.FLOAT64 },
  { name: 'GENERAL ENG OIL PRESSURE:2', units: 'Rankine', dataType: SimConnectDataType.FLOAT64 },
  { name: 'TURB ENG PRIMARY NOZZLE PERCENT:2', units: 'percent', dataType: SimConnectDataType.FLOAT64 },
  { name: 'TURB ENG ITT:2', units: 'Rankine', dataType: SimConnectDataType.FLOAT64 },
];

/** Fuel SimVars */
export const FUEL_VARS: SimVarDefinition[] = [
  { name: 'FUEL TOTAL QUANTITY WEIGHT', units: 'pounds', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FUEL TOTAL QUANTITY', units: 'gallons', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FUEL TOTAL CAPACITY', units: 'gallons', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FUEL LEFT QUANTITY', units: 'gallons', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FUEL RIGHT QUANTITY', units: 'gallons', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FUEL CENTER QUANTITY', units: 'gallons', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FUEL LEFT CAPACITY', units: 'gallons', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FUEL RIGHT CAPACITY', units: 'gallons', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FUEL CENTER CAPACITY', units: 'gallons', dataType: SimConnectDataType.FLOAT64 },
];

/** Flight state SimVars */
export const FLIGHT_VARS: SimVarDefinition[] = [
  { name: 'SIM ON GROUND', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'GEAR TOTAL PCT EXTENDED', units: 'percent', dataType: SimConnectDataType.FLOAT64 },
  { name: 'GEAR HANDLE POSITION', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'TRAILING EDGE FLAPS LEFT ANGLE', units: 'degrees', dataType: SimConnectDataType.FLOAT64 },
  { name: 'FLAPS HANDLE INDEX', units: 'number', dataType: SimConnectDataType.INT32 },
  { name: 'SPOILERS HANDLE POSITION', units: 'percent', dataType: SimConnectDataType.FLOAT64 },
  { name: 'BRAKE PARKING POSITION', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'LIGHT BEACON', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'LIGHT LANDING', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'LIGHT NAV', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'LIGHT STROBE', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'LIGHT TAXI', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'SIMULATION TIME', units: 'seconds', dataType: SimConnectDataType.FLOAT64 },
  { name: 'ZULU TIME', units: 'seconds', dataType: SimConnectDataType.FLOAT64 },
  { name: 'LOCAL TIME', units: 'seconds', dataType: SimConnectDataType.FLOAT64 },
  { name: 'SIMULATION RATE', units: 'number', dataType: SimConnectDataType.FLOAT64 },
];

/** Autopilot SimVars */
export const AUTOPILOT_VARS: SimVarDefinition[] = [
  { name: 'AUTOPILOT MASTER', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'AUTOPILOT ALTITUDE LOCK', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'AUTOPILOT ALTITUDE LOCK VAR', units: 'feet', dataType: SimConnectDataType.FLOAT64 },
  { name: 'AUTOPILOT HEADING LOCK', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'AUTOPILOT HEADING LOCK DIR', units: 'degrees', dataType: SimConnectDataType.FLOAT64 },
  { name: 'AUTOPILOT AIRSPEED HOLD', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'AUTOPILOT AIRSPEED HOLD VAR', units: 'knots', dataType: SimConnectDataType.FLOAT64 },
  { name: 'AUTOPILOT VERTICAL HOLD', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'AUTOPILOT VERTICAL HOLD VAR', units: 'feet per minute', dataType: SimConnectDataType.FLOAT64 },
  { name: 'AUTOPILOT APPROACH HOLD', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'AUTOPILOT NAV1 LOCK', units: 'bool', dataType: SimConnectDataType.INT32 },
];

/** Transponder & Radio SimVars */
export const RADIO_VARS: SimVarDefinition[] = [
  { name: 'TRANSPONDER CODE:1', units: 'number', dataType: SimConnectDataType.INT32 },
  { name: 'TRANSPONDER IDENT:1', units: 'bool', dataType: SimConnectDataType.INT32 },
  { name: 'COM ACTIVE FREQUENCY:1', units: 'MHz', dataType: SimConnectDataType.FLOAT64 },
  { name: 'COM STANDBY FREQUENCY:1', units: 'MHz', dataType: SimConnectDataType.FLOAT64 },
  { name: 'COM ACTIVE FREQUENCY:2', units: 'MHz', dataType: SimConnectDataType.FLOAT64 },
  { name: 'COM STANDBY FREQUENCY:2', units: 'MHz', dataType: SimConnectDataType.FLOAT64 },
  { name: 'NAV ACTIVE FREQUENCY:1', units: 'MHz', dataType: SimConnectDataType.FLOAT64 },
  { name: 'NAV STANDBY FREQUENCY:1', units: 'MHz', dataType: SimConnectDataType.FLOAT64 },
  { name: 'NAV ACTIVE FREQUENCY:2', units: 'MHz', dataType: SimConnectDataType.FLOAT64 },
  { name: 'NAV STANDBY FREQUENCY:2', units: 'MHz', dataType: SimConnectDataType.FLOAT64 },
];

/** Aircraft info SimVars (requested once) */
export const AIRCRAFT_INFO_VARS: SimVarDefinition[] = [
  { name: 'TITLE', units: null, dataType: SimConnectDataType.STRING256 },
  { name: 'ATC ID', units: null, dataType: SimConnectDataType.STRING32 },
  { name: 'ATC TYPE', units: null, dataType: SimConnectDataType.STRING32 },
  { name: 'ATC MODEL', units: null, dataType: SimConnectDataType.STRING32 },
];

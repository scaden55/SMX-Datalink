import type { SimConnectConnection } from 'node-simconnect';
import { SimConnectConstants, SimConnectPeriod, DataRequestFlag } from 'node-simconnect';
import {
  POSITION_VARS,
  ENGINE_VARS,
  FUEL_VARS,
  FLIGHT_VARS,
  AUTOPILOT_VARS,
  RADIO_VARS,
  AIRCRAFT_INFO_VARS,
} from '@acars/shared';

/** Data definition group IDs */
export const enum DefinitionID {
  POSITION = 0,
  ENGINE = 1,
  FUEL = 2,
  FLIGHT = 3,
  AUTOPILOT = 4,
  RADIO = 5,
  AIRCRAFT_INFO = 6,
}

/** Data request IDs */
export const enum RequestID {
  POSITION = 100,
  ENGINE = 101,
  FUEL = 102,
  FLIGHT = 103,
  AUTOPILOT = 104,
  RADIO = 105,
  AIRCRAFT_INFO = 106,
}

/** System event subscription IDs */
export const enum SystemEventID {
  PAUSE = 200,
  SIM_START = 201,
  SIM_STOP = 202,
  CRASHED = 203,
  AIRCRAFT_LOADED = 204,
  FLIGHT_LOADED = 205,
}

/**
 * Registers all SimVar data definitions with the SimConnect handle.
 * Must be called after connection is established, before requesting data.
 */
export function registerAllDefinitions(handle: SimConnectConnection): void {
  const groups = [
    { defId: DefinitionID.POSITION, vars: POSITION_VARS },
    { defId: DefinitionID.ENGINE, vars: ENGINE_VARS },
    { defId: DefinitionID.FUEL, vars: FUEL_VARS },
    { defId: DefinitionID.FLIGHT, vars: FLIGHT_VARS },
    { defId: DefinitionID.AUTOPILOT, vars: AUTOPILOT_VARS },
    { defId: DefinitionID.RADIO, vars: RADIO_VARS },
    { defId: DefinitionID.AIRCRAFT_INFO, vars: AIRCRAFT_INFO_VARS },
  ];

  for (const { defId, vars } of groups) {
    for (const v of vars) {
      handle.addToDataDefinition(defId, v.name, v.units, v.dataType);
    }
  }
}

/**
 * Starts periodic data requests for all telemetry groups.
 * Aircraft info is requested once; all others at 1Hz with change-only flag.
 */
export function requestAllData(handle: SimConnectConnection): void {
  const periodicGroups = [
    { reqId: RequestID.POSITION, defId: DefinitionID.POSITION },
    { reqId: RequestID.ENGINE, defId: DefinitionID.ENGINE },
    { reqId: RequestID.FUEL, defId: DefinitionID.FUEL },
    { reqId: RequestID.FLIGHT, defId: DefinitionID.FLIGHT },
    { reqId: RequestID.AUTOPILOT, defId: DefinitionID.AUTOPILOT },
    { reqId: RequestID.RADIO, defId: DefinitionID.RADIO },
  ];

  for (const { reqId, defId } of periodicGroups) {
    handle.requestDataOnSimObject(
      reqId,
      defId,
      SimConnectConstants.OBJECT_ID_USER,
      SimConnectPeriod.SECOND,
      DataRequestFlag.DATA_REQUEST_FLAG_CHANGED,
    );
  }

  // Aircraft info: request once
  handle.requestDataOnSimObject(
    RequestID.AIRCRAFT_INFO,
    DefinitionID.AIRCRAFT_INFO,
    SimConnectConstants.OBJECT_ID_USER,
    SimConnectPeriod.ONCE,
  );
}

/**
 * Subscribes to SimConnect system events for flight lifecycle tracking.
 */
export function subscribeSystemEvents(handle: SimConnectConnection): void {
  handle.subscribeToSystemEvent(SystemEventID.PAUSE, 'Pause');
  handle.subscribeToSystemEvent(SystemEventID.SIM_START, 'SimStart');
  handle.subscribeToSystemEvent(SystemEventID.SIM_STOP, 'SimStop');
  handle.subscribeToSystemEvent(SystemEventID.CRASHED, 'Crashed');
  handle.subscribeToSystemEvent(SystemEventID.AIRCRAFT_LOADED, 'AircraftLoaded');
  handle.subscribeToSystemEvent(SystemEventID.FLIGHT_LOADED, 'FlightLoaded');
}

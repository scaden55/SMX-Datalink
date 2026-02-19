export interface FaaGroundStop {
  impactingCondition: string;
  startTime: string;
  endTime: string;
  probabilityOfExtension: string;
}

export interface FaaGroundDelay {
  impactingCondition: string;
  avgDelay: number;
  maxDelay: number;
  startTime: string;
  endTime: string;
}

export interface FaaArrivalDepartureDelay {
  reason: string;
  arrivalDeparture: {
    type: string;
    min: string;
    max: string;
    trend: string;
  };
}

export interface FaaDeicing {
  eventTime: string;
  expTime: string;
}

export interface FaaAirportConfig {
  arrivalRunwayConfig: string;
  departureRunwayConfig: string;
  arrivalRate: number;
}

export interface FaaFreeForm {
  simpleText: string;
  startTime: string;
  endTime: string;
  notamNumber: number;
}

export interface FaaAirportEvent {
  airportId: string;
  airportLongName: string;
  groundStop: FaaGroundStop | null;
  groundDelay: FaaGroundDelay | null;
  arrivalDelay: FaaArrivalDepartureDelay | null;
  departureDelay: FaaArrivalDepartureDelay | null;
  airportClosure: { reason: string; startTime: string; endTime: string } | null;
  deicing: FaaDeicing | null;
  airportConfig: FaaAirportConfig | null;
  freeForm: FaaFreeForm | null;
}

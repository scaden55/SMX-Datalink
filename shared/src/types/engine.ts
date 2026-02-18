export interface EngineData {
  numberOfEngines: number;
  engines: EngineParameters[];
}

export interface EngineParameters {
  n1: number; // percent
  n2: number; // percent
  fuelFlow: number; // gallons per hour
  oilTemperature: number; // Rankine → converted to Celsius on frontend
  oilPressure: number; // PSI
  egt: number; // Rankine
  itt: number; // Rankine
}

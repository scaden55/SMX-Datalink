export type OOOIEventType = 'OUT' | 'OFF' | 'ON' | 'IN';

export interface AcarsMessage {
  id: string;
  timestamp: string; // ISO UTC
  type: OOOIEventType | 'SYSTEM' | 'DISPATCHER' | 'PILOT';
  content: string;
  source: 'auto' | 'manual';
}

export interface DispatcherRemarks {
  remarks: string;
  fuelAutoRemarks: string;
}

export interface SystemInfo {
  melItems: string[];
  routeNotes: string[];
  burnCorrections: string[];
}

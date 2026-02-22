export interface NavdataSearchResult {
  ident: string;
  type: 'fix' | 'VOR' | 'NDB' | 'DME' | 'DME_STANDALONE' | 'TACAN' | 'ILS_LOC' | 'airway';
  lat: number | null;   // null for airways
  lon: number | null;
  frequency: number | null;
  name: string | null;
}

export interface RouteFixResult {
  ident: string;
  lat: number;
  lon: number;
  type: 'fix' | 'vor' | 'ndb' | 'airport' | 'airway-fix';
  airway?: string;  // which airway placed this fix (for labeling)
}

export interface NavaidMapItem {
  ident: string;
  type: string;      // VOR, NDB, DME, TACAN
  lat: number;
  lon: number;
  frequency: number | null;
  name: string | null;
}

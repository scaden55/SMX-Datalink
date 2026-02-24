// ─── Aircraft Cargo Configurations ──────────────────────────
// Ported from freight-dispatch-companion with modifications for SMX ACARS.
// All weights in KG.

export interface AircraftSection {
  name: string;
  positions: string[];
  maxWeight: number;
  uldTypes: string[];
  arm: number;  // simplified CG arm position (0-1 range, nose to tail)
}

export interface AircraftConfig {
  name: string;
  icao: string;
  maxPayload: number;
  sections: Record<string, AircraftSection>;
  cgRange: { forward: number; aft: number };
  cgTarget: number;
}

export interface ULDTypeConfig {
  code: string;
  name: string;
  tare: number;
  maxGross: number;
  dimensions: string;
}

export const ULD_TYPES: Record<string, ULDTypeConfig> = {
  PMC: { code: 'PMC', name: 'Pallet + Net (PMC)', tare: 110, maxGross: 6804, dimensions: '318x244cm' },
  PAG: { code: 'PAG', name: 'Pallet + Net (PAG)', tare: 100, maxGross: 6804, dimensions: '318x244cm' },
  PLA: { code: 'PLA', name: 'Pallet (PLA)', tare: 90, maxGross: 5000, dimensions: '318x153cm' },
  PGA: { code: 'PGA', name: 'Pallet (PGA)', tare: 85, maxGross: 5000, dimensions: '318x153cm' },
  AMJ: { code: 'AMJ', name: 'Container (AMJ)', tare: 250, maxGross: 6804, dimensions: '318x244x244cm' },
  DQF: { code: 'DQF', name: 'Container (DQF)', tare: 200, maxGross: 5000, dimensions: '318x153x163cm' },
  LD3: { code: 'LD3', name: 'Container LD3', tare: 70, maxGross: 1588, dimensions: '153x156x163cm' },
  LD7: { code: 'LD7', name: 'Container LD7', tare: 100, maxGross: 4626, dimensions: '318x156x163cm' },
  LD1: { code: 'LD1', name: 'Container LD1', tare: 65, maxGross: 1588, dimensions: '153x156x163cm' },
  LD2: { code: 'LD2', name: 'Container LD2', tare: 55, maxGross: 1225, dimensions: '119x156x163cm' },
  AKE: { code: 'AKE', name: 'Container AKE', tare: 75, maxGross: 1588, dimensions: '153x156x114cm' },
  AKH: { code: 'AKH', name: 'Container AKH', tare: 80, maxGross: 1588, dimensions: '153x156x163cm' },
  AAA: { code: 'AAA', name: 'Container AAA', tare: 95, maxGross: 3400, dimensions: '244x318x244cm' },
  BULK: { code: 'BULK', name: 'Bulk Cargo', tare: 0, maxGross: 2000, dimensions: 'Loose load' },
};

export const AIRCRAFT_CONFIGS: Record<string, AircraftConfig> = {
  B77F: {
    name: 'Boeing 777F',
    icao: 'B77F',
    maxPayload: 103000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1', 'ML2', 'ML3', 'ML4', 'ML5', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5',
                     'ML6', 'ML7', 'MR6', 'MR7', 'ML8', 'ML9', 'MR8', 'MR9', 'ML10', 'MR10'],
        maxWeight: 70000,
        uldTypes: ['PMC', 'PAG', 'AMJ', 'DQF'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1', 'FH2', 'FH3', 'FH4', 'FH5'],
        maxWeight: 20000,
        uldTypes: ['LD3', 'LD7', 'LD1', 'LD2', 'AKE'],
        arm: 0.30,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1', 'AH2', 'AH3', 'AH4'],
        maxWeight: 15000,
        uldTypes: ['LD3', 'LD7', 'LD1', 'AKE', 'AKH'],
        arm: 0.70,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 3000,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 14, aft: 44 },
    cgTarget: 28,
  },
  B748: {
    name: 'Boeing 747-8F',
    icao: 'B748',
    maxPayload: 134000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7','ML8','ML9','ML10',
                     'MR1','MR2','MR3','MR4','MR5','MR6','MR7','MR8','MR9','MR10',
                     'MN1','MN2','MN3','MN4','MN5'],
        maxWeight: 90000,
        uldTypes: ['PMC','PAG','AMJ','PLA','PGA'],
        arm: 0.48,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3','FH4','FH5','FH6'],
        maxWeight: 25000,
        uldTypes: ['LD3','LD7','LD1','AKE'],
        arm: 0.28,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2','AH3','AH4','AH5'],
        maxWeight: 18000,
        uldTypes: ['LD3','LD7','AKE','AKH'],
        arm: 0.68,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 4000,
        uldTypes: ['BULK'],
        arm: 0.88,
      },
    },
    cgRange: { forward: 13, aft: 42 },
    cgTarget: 27,
  },
  B744: {
    name: 'Boeing 747-400F',
    icao: 'B744',
    maxPayload: 120000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7','ML8','ML9',
                     'MR1','MR2','MR3','MR4','MR5','MR6','MR7','MR8','MR9',
                     'MN1','MN2','MN3'],
        maxWeight: 82000,
        uldTypes: ['PMC','PAG','AMJ','PLA'],
        arm: 0.48,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3','FH4','FH5'],
        maxWeight: 22000,
        uldTypes: ['LD3','LD7','LD1'],
        arm: 0.29,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2','AH3','AH4'],
        maxWeight: 16000,
        uldTypes: ['LD3','LD7','AKE'],
        arm: 0.69,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 3500,
        uldTypes: ['BULK'],
        arm: 0.86,
      },
    },
    cgRange: { forward: 14, aft: 43 },
    cgTarget: 28,
  },
  B742: {
    name: 'Boeing 747-200F',
    icao: 'B742',
    maxPayload: 105000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7','ML8',
                     'MR1','MR2','MR3','MR4','MR5','MR6','MR7','MR8'],
        maxWeight: 72000,
        uldTypes: ['PMC','PAG','AMJ'],
        arm: 0.49,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3','FH4'],
        maxWeight: 19000,
        uldTypes: ['LD3','LD7'],
        arm: 0.30,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2','AH3'],
        maxWeight: 14000,
        uldTypes: ['LD3','LD7'],
        arm: 0.70,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 3000,
        uldTypes: ['BULK'],
        arm: 0.87,
      },
    },
    cgRange: { forward: 15, aft: 44 },
    cgTarget: 29,
  },
  A333: {
    name: 'Airbus A330-300F',
    icao: 'A333',
    maxPayload: 70000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7','ML8',
                     'MR1','MR2','MR3','MR4','MR5','MR6','MR7','MR8'],
        maxWeight: 48000,
        uldTypes: ['PMC','PAG','AMJ','DQF'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3','FH4'],
        maxWeight: 12000,
        uldTypes: ['LD3','LD7','AKE'],
        arm: 0.32,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2','AH3'],
        maxWeight: 10000,
        uldTypes: ['LD3','LD7','AKE'],
        arm: 0.68,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 2500,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 17, aft: 40 },
    cgTarget: 28,
  },
  A332: {
    name: 'Airbus A330-200F',
    icao: 'A332',
    maxPayload: 64000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7',
                     'MR1','MR2','MR3','MR4','MR5','MR6','MR7'],
        maxWeight: 43000,
        uldTypes: ['PMC','PAG','AMJ','DQF'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3'],
        maxWeight: 11000,
        uldTypes: ['LD3','LD7','AKE'],
        arm: 0.32,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2','AH3'],
        maxWeight: 9000,
        uldTypes: ['LD3','AKE'],
        arm: 0.68,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 2000,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 17, aft: 40 },
    cgTarget: 28,
  },
  MD11: {
    name: 'McDonnell Douglas MD-11F',
    icao: 'MD11',
    maxPayload: 89400,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7','ML8','ML9','ML10',
                     'MR1','MR2','MR3','MR4','MR5','MR6','MR7','MR8','MR9','MR10'],
        maxWeight: 62000,
        uldTypes: ['PMC','PAG','AMJ','PLA','DQF'],
        arm: 0.48,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3','FH4','FH5'],
        maxWeight: 16000,
        uldTypes: ['LD3','LD7','LD1','AKE'],
        arm: 0.28,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2','AH3','AH4'],
        maxWeight: 12000,
        uldTypes: ['LD3','LD7','AKE','AKH'],
        arm: 0.72,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 2500,
        uldTypes: ['BULK'],
        arm: 0.88,
      },
    },
    cgRange: { forward: 12, aft: 38 },
    cgTarget: 25,
  },
  B763: {
    name: 'Boeing 767-300F',
    icao: 'B763',
    maxPayload: 54000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6',
                     'MR1','MR2','MR3','MR4','MR5','MR6'],
        maxWeight: 38000,
        uldTypes: ['PMC','PAG','DQF','PLA'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3'],
        maxWeight: 9000,
        uldTypes: ['LD3','LD2','AKE'],
        arm: 0.30,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2','AH3'],
        maxWeight: 7000,
        uldTypes: ['LD3','LD2','AKE'],
        arm: 0.70,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 2000,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 14, aft: 42 },
    cgTarget: 27,
  },
  B752: {
    name: 'Boeing 757-200PF',
    icao: 'B752',
    maxPayload: 39000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7','ML8',
                     'MR1','MR2','MR3','MR4','MR5','MR6','MR7','MR8'],
        maxWeight: 28000,
        uldTypes: ['PMC','PAG','PLA','PGA'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3'],
        maxWeight: 6000,
        uldTypes: ['LD3','LD2','AKE'],
        arm: 0.30,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2'],
        maxWeight: 4500,
        uldTypes: ['LD3','LD2'],
        arm: 0.70,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 1500,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 15, aft: 40 },
    cgTarget: 27,
  },
  B722: {
    name: 'Boeing 727-200F',
    icao: 'B722',
    maxPayload: 27000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6',
                     'MR1','MR2','MR3','MR4','MR5','MR6'],
        maxWeight: 20000,
        uldTypes: ['PMC','PAG','PLA'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2'],
        maxWeight: 4000,
        uldTypes: ['LD3','LD2'],
        arm: 0.30,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2'],
        maxWeight: 3500,
        uldTypes: ['LD3','LD2'],
        arm: 0.70,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 1000,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 16, aft: 40 },
    cgTarget: 28,
  },
  A306: {
    name: 'Airbus A300-600F',
    icao: 'A306',
    maxPayload: 48000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7','ML8',
                     'MR1','MR2','MR3','MR4','MR5','MR6','MR7','MR8'],
        maxWeight: 34000,
        uldTypes: ['PMC','PAG','AMJ','DQF'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2','FH3'],
        maxWeight: 8000,
        uldTypes: ['LD3','LD7','AKE'],
        arm: 0.30,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2','AH3'],
        maxWeight: 6000,
        uldTypes: ['LD3','AKE'],
        arm: 0.70,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 2000,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 17, aft: 41 },
    cgTarget: 28,
  },
  E190: {
    name: 'Embraer E190',
    icao: 'E190',
    maxPayload: 13000,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6'],
        maxWeight: 9000,
        uldTypes: ['PLA','PGA'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2'],
        maxWeight: 2500,
        uldTypes: ['LD2','AKE'],
        arm: 0.30,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1'],
        maxWeight: 1500,
        uldTypes: ['LD2'],
        arm: 0.70,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 500,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 18, aft: 38 },
    cgTarget: 27,
  },
  E195: {
    name: 'Embraer E195',
    icao: 'E195',
    maxPayload: 14500,
    sections: {
      mainDeck: {
        name: 'Main Deck',
        positions: ['ML1','ML2','ML3','ML4','ML5','ML6','ML7'],
        maxWeight: 10000,
        uldTypes: ['PLA','PGA'],
        arm: 0.50,
      },
      forwardHold: {
        name: 'Forward Lower Hold',
        positions: ['FH1','FH2'],
        maxWeight: 2800,
        uldTypes: ['LD2','AKE'],
        arm: 0.30,
      },
      aftHold: {
        name: 'Aft Lower Hold',
        positions: ['AH1','AH2'],
        maxWeight: 1700,
        uldTypes: ['LD2'],
        arm: 0.70,
      },
      bulk: {
        name: 'Bulk Cargo',
        positions: ['BLK'],
        maxWeight: 500,
        uldTypes: ['BULK'],
        arm: 0.85,
      },
    },
    cgRange: { forward: 18, aft: 38 },
    cgTarget: 27,
  },
};

// ICAO type mapping — maps non-freighter types to closest freighter config
export const AIRCRAFT_MAP: Record<string, string> = {
  // Direct matches
  'B77F': 'B77F', 'B748': 'B748', 'B744': 'B744', 'B742': 'B742',
  'A333': 'A333', 'A332': 'A332', 'MD11': 'MD11', 'B763': 'B763',
  'B752': 'B752', 'B722': 'B722', 'A306': 'A306', 'E190': 'E190',
  'E195': 'E195',
  // Widebody mappings
  'B77W': 'B77F', 'B773': 'B77F', 'B77L': 'B77F',
  'A359': 'A332', 'A35K': 'A333', 'A346': 'A333',
  'B788': 'B763', 'B789': 'B763', 'B78X': 'B763',
  // Narrowbody mappings
  'B738': 'B752', 'B739': 'B752', 'A320': 'B752', 'A321': 'B752',
  'A319': 'B722', 'CRJ9': 'E190', 'E175': 'E190',
};

/** Look up an aircraft config by ICAO code, using AIRCRAFT_MAP for fallback. */
export function getAircraftConfig(icao: string): AircraftConfig | null {
  const mapped = AIRCRAFT_MAP[icao];
  if (mapped) return AIRCRAFT_CONFIGS[mapped] ?? null;
  // Fallback: try direct lookup
  return AIRCRAFT_CONFIGS[icao] ?? null;
}

/** Convert weight between LBS and KGS. */
export function convertWeight(value: number, from: 'LBS' | 'KGS', to: 'LBS' | 'KGS'): number {
  if (from === to) return value;
  return from === 'LBS' ? value * 0.453592 : value * 2.20462;
}

/** Format weight with unit suffix. */
export function formatWeight(kg: number, unit: 'LBS' | 'KGS'): string {
  const val = unit === 'KGS' ? kg : kg * 2.20462;
  return `${Math.round(val).toLocaleString()} ${unit === 'KGS' ? 'kg' : 'lbs'}`;
}

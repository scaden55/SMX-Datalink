CREATE TABLE IF NOT EXISTS aircraft_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aircraft_id INTEGER NOT NULL,
  component_type TEXT NOT NULL CHECK (component_type IN ('engine', 'apu', 'landing_gear', 'propeller', 'avionics', 'other')),
  part_number TEXT,
  serial_number TEXT,
  position TEXT,
  hours_since_new REAL DEFAULT 0,
  cycles_since_new INTEGER DEFAULT 0,
  hours_since_overhaul REAL DEFAULT 0,
  overhaul_limit REAL,
  installed_date TEXT,
  status TEXT DEFAULT 'installed' CHECK (status IN ('installed', 'removed', 'overhauled', 'scrapped')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (aircraft_id) REFERENCES aircraft(id)
);

CREATE INDEX IF NOT EXISTS idx_components_aircraft ON aircraft_components(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_components_type ON aircraft_components(component_type);

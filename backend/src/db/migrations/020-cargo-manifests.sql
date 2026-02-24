-- Cargo manifests: stores generated ULD distributions for flights.
-- Links to active bids / logbook entries via flight_id.

CREATE TABLE IF NOT EXISTS cargo_manifests (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id             INTEGER NOT NULL,
  user_id               INTEGER NOT NULL,
  manifest_number       TEXT NOT NULL,
  aircraft_icao         TEXT NOT NULL,
  payload_kg            REAL NOT NULL,
  cargo_mode            TEXT NOT NULL DEFAULT 'mixed',
  primary_category      TEXT,
  total_weight_kg       REAL NOT NULL,
  cg_position           REAL,
  payload_utilization   INTEGER,
  ulds_json             TEXT NOT NULL,
  section_weights_json  TEXT NOT NULL,
  remarks_json          TEXT,
  notoc_required        INTEGER DEFAULT 0,
  notoc_items_json      TEXT,
  created_at            TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_cargo_manifests_flight ON cargo_manifests(flight_id);
CREATE INDEX idx_cargo_manifests_user ON cargo_manifests(user_id);

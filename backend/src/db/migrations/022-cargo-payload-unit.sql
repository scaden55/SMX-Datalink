-- Add payload_unit column so display weight/unit can be reconstructed on reload.
ALTER TABLE cargo_manifests ADD COLUMN payload_unit TEXT NOT NULL DEFAULT 'KGS';

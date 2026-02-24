ALTER TABLE logbook ADD COLUMN cargo_manifest_id INTEGER REFERENCES cargo_manifests(id);

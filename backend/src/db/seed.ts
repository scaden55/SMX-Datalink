import bcrypt from 'bcryptjs';
import { getDb } from './index.js';

export function seedDatabase(): void {
  const db = getDb();

  // ── Users ──────────────────────────────────────────────────────
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const passwordHash = bcrypt.hashSync('changeme', 10);
    const insertUser = db.prepare(`
      INSERT INTO users (email, callsign, password_hash, first_name, last_name, role, rank)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('admin@smavirtual.com', 'SMA-001', passwordHash, 'Admin', 'User', 'admin', 'Captain');
    console.log('[Seed] Admin user created: admin@smavirtual.com');
  }

  // ── Airports (26 major US hubs) ────────────────────────────────
  const airportCount = db.prepare('SELECT COUNT(*) as count FROM airports').get() as { count: number };
  if (airportCount.count === 0) {
    const insertAirport = db.prepare(`
      INSERT INTO airports (icao, name, city, state, country, lat, lon, elevation, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const airports = [
      ['KJFK', 'John F Kennedy Intl',         'New York',      'NY', 'US', 40.6398, -73.7789, 13,   'America/New_York'],
      ['KLAX', 'Los Angeles Intl',             'Los Angeles',   'CA', 'US', 33.9425, -118.4081, 126, 'America/Los_Angeles'],
      ['KORD', "Chicago O'Hare Intl",          'Chicago',       'IL', 'US', 41.9742, -87.9073, 672,  'America/Chicago'],
      ['KATL', 'Hartsfield-Jackson Atlanta Intl', 'Atlanta',    'GA', 'US', 33.6407, -84.4277, 1026, 'America/New_York'],
      ['KDFW', 'Dallas/Fort Worth Intl',       'Dallas',        'TX', 'US', 32.8998, -97.0403, 607,  'America/Chicago'],
      ['KDEN', 'Denver Intl',                  'Denver',        'CO', 'US', 39.8561, -104.6737, 5431, 'America/Denver'],
      ['KSFO', 'San Francisco Intl',           'San Francisco', 'CA', 'US', 37.6213, -122.3790, 13,  'America/Los_Angeles'],
      ['KIAH', 'George Bush Intercontinental',  'Houston',      'TX', 'US', 29.9844, -95.3414, 97,   'America/Chicago'],
      ['KMIA', 'Miami Intl',                   'Miami',         'FL', 'US', 25.7959, -80.2870, 8,    'America/New_York'],
      ['KBOS', 'Boston Logan Intl',            'Boston',        'MA', 'US', 42.3656, -71.0096, 20,   'America/New_York'],
      ['KSEA', 'Seattle-Tacoma Intl',          'Seattle',       'WA', 'US', 47.4502, -122.3088, 433, 'America/Los_Angeles'],
      ['KMSP', 'Minneapolis-St Paul Intl',     'Minneapolis',   'MN', 'US', 44.8848, -93.2223, 841,  'America/Chicago'],
      ['KDTW', 'Detroit Metro Wayne County',   'Detroit',       'MI', 'US', 42.2124, -83.3534, 645,  'America/New_York'],
      ['KPHX', 'Phoenix Sky Harbor Intl',      'Phoenix',       'AZ', 'US', 33.4373, -112.0078, 1135, 'America/Phoenix'],
      ['KLAS', 'Harry Reid Intl',              'Las Vegas',     'NV', 'US', 36.0840, -115.1537, 2181, 'America/Los_Angeles'],
      ['KMCO', 'Orlando Intl',                 'Orlando',       'FL', 'US', 28.4312, -81.3081, 96,   'America/New_York'],
      ['KEWR', 'Newark Liberty Intl',          'Newark',        'NJ', 'US', 40.6895, -74.1745, 18,   'America/New_York'],
      ['KCLT', 'Charlotte Douglas Intl',       'Charlotte',     'NC', 'US', 35.2144, -80.9473, 748,  'America/New_York'],
      ['KPHL', 'Philadelphia Intl',            'Philadelphia',  'PA', 'US', 39.8744, -75.2424, 36,   'America/New_York'],
      ['KSLC', 'Salt Lake City Intl',          'Salt Lake City','UT', 'US', 40.7884, -111.9778, 4227, 'America/Denver'],
      ['KBWI', 'Baltimore/Washington Intl',    'Baltimore',     'MD', 'US', 39.1754, -76.6683, 146,  'America/New_York'],
      ['KSAN', 'San Diego Intl',               'San Diego',     'CA', 'US', 32.7336, -117.1897, 17,  'America/Los_Angeles'],
      ['KTPA', 'Tampa Intl',                   'Tampa',         'FL', 'US', 27.9755, -82.5332, 26,   'America/New_York'],
      ['KAUS', 'Austin-Bergstrom Intl',        'Austin',        'TX', 'US', 30.1945, -97.6699, 542,  'America/Chicago'],
      ['KRDU', 'Raleigh-Durham Intl',          'Raleigh',       'NC', 'US', 35.8776, -78.7875, 435,  'America/New_York'],
      ['KPDX', 'Portland Intl',               'Portland',      'OR', 'US', 45.5887, -122.5975, 31,  'America/Los_Angeles'],
    ] as const;

    const insertMany = db.transaction(() => {
      for (const a of airports) {
        insertAirport.run(...a);
      }
    });
    insertMany();
    console.log(`[Seed] ${airports.length} airports created`);
  }
}

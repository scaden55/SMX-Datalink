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
    insertUser.run('pilot@smavirtual.com', 'SMA-042', passwordHash, 'Jake', 'Mitchell', 'pilot', 'First Officer');
    console.log('[Seed] Admin user created: admin@smavirtual.com');
    console.log('[Seed] Pilot user created: pilot@smavirtual.com');
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

  // ── Fleet (12 aircraft) ────────────────────────────────────────
  const fleetCount = db.prepare('SELECT COUNT(*) as count FROM fleet').get() as { count: number };
  if (fleetCount.count === 0) {
    const insertFleet = db.prepare(`
      INSERT INTO fleet (icao_type, name, registration, airline, range_nm, cruise_speed, pax_capacity, cargo_capacity_lbs, is_active, status, base_icao, location_icao, remarks, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const fleet = [
      ['B738', 'Boeing 737-800',         'N801SM', 'SMA', 2935, 453, 162, 5200,  1, 'active',  'KJFK', 'KJFK', null,                          now],
      ['B738', 'Boeing 737-800',         'N802SM', 'SMA', 2935, 453, 162, 5200,  1, 'stored',  'KPHX', 'KPHX', 'Engine inspection due Mar 2026', now],
      ['B739', 'Boeing 737-900ER',       'N901SM', 'SMA', 2950, 453, 178, 5400,  1, 'active',  'KJFK', 'KORD', null,                          now],
      ['A320', 'Airbus A320neo',         'N320SM', 'SMA', 3400, 447, 150, 4600,  1, 'active',  'KORD', 'KORD', null,                          now],
      ['A320', 'Airbus A320neo',         'N321SM', 'SMA', 3400, 447, 150, 4600,  1, 'active',  'KLAX', 'KLAX', null,                          now],
      ['A321', 'Airbus A321neo',         'N322SM', 'SMA', 3500, 447, 196, 5100,  1, 'active',  'KMIA', 'KJFK', null,                          now],
      ['B772', 'Boeing 777-200ER',       'N772SM', 'SMA', 7700, 490, 314, 14500, 1, 'active',  'KJFK', 'KLAX', null,                          now],
      ['B772', 'Boeing 777-200ER',       'N773SM', 'SMA', 7700, 490, 314, 14500, 1, 'active',  'KJFK', 'KJFK', null,                          now],
      ['B789', 'Boeing 787-9 Dreamliner','N789SM', 'SMA', 7635, 488, 290, 13200, 1, 'active',  'KSFO', 'KSFO', null,                          now],
      ['A333', 'Airbus A330-300',        'N333SM', 'SMA', 6350, 470, 277, 11800, 1, 'active',  'KSEA', 'KMIA', null,                          now],
      ['E175', 'Embraer E175',           'N175SM', 'SMA', 2000, 430,  76, 2200,  1, 'active',  'KBOS', 'KBOS', null,                          now],
      ['CRJ9', 'Bombardier CRJ-900',    'N900SM', 'SMA', 1550, 447,  76, 2000,  0, 'retired', 'KLAS', 'KLAS', 'Retired from fleet Feb 2026',  now],
    ] as const;

    const insertMany = db.transaction(() => {
      for (const f of fleet) {
        insertFleet.run(...f);
      }
    });
    insertMany();
    console.log(`[Seed] ${fleet.length} fleet aircraft created`);
  }

  // ── Scheduled Flights (24 routes) ──────────────────────────────
  const schedCount = db.prepare('SELECT COUNT(*) as count FROM scheduled_flights').get() as { count: number };
  if (schedCount.count === 0) {
    const insertSchedule = db.prepare(`
      INSERT INTO scheduled_flights (flight_number, dep_icao, arr_icao, aircraft_type, dep_time, arr_time, distance_nm, flight_time_min, days_of_week, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const schedules = [
      // Short-haul (< 500nm)
      ['SMA101', 'KJFK', 'KBOS', 'E175', '07:00', '08:15', 187,   75,  '1234567', 1],
      ['SMA102', 'KBOS', 'KJFK', 'E175', '09:00', '10:15', 187,   75,  '1234567', 1],
      ['SMA103', 'KLAX', 'KSAN', 'CRJ9', '08:00', '08:55', 109,   55,  '12345',   1],
      ['SMA104', 'KSAN', 'KLAX', 'CRJ9', '10:00', '10:55', 109,   55,  '12345',   1],
      ['SMA105', 'KLAS', 'KPHX', 'E175', '06:30', '07:45', 256,   75,  '1234567', 1],
      ['SMA106', 'KPHX', 'KLAS', 'E175', '09:00', '10:15', 256,   75,  '1234567', 1],

      // Medium-haul (500–1200nm)
      ['SMA201', 'KJFK', 'KORD', 'A320', '08:00', '10:15', 740,  135,  '1234567', 1],
      ['SMA202', 'KORD', 'KJFK', 'A320', '11:00', '13:15', 740,  135,  '1234567', 1],
      ['SMA203', 'KATL', 'KDFW', 'B738', '07:30', '09:15', 731,  105,  '12345',   1],
      ['SMA204', 'KDFW', 'KATL', 'B738', '10:30', '12:15', 731,  105,  '12345',   1],
      ['SMA205', 'KMIA', 'KJFK', 'A321', '06:00', '08:45', 1089, 165,  '1234567', 1],
      ['SMA206', 'KJFK', 'KMIA', 'A321', '10:00', '12:45', 1089, 165,  '1234567', 1],
      ['SMA207', 'KDEN', 'KIAH', 'B739', '09:00', '11:30', 879,  150,  '12345',   1],
      ['SMA208', 'KIAH', 'KDEN', 'B739', '13:00', '15:30', 879,  150,  '12345',   1],

      // Transcontinental (> 2000nm)
      ['SMA501', 'KJFK', 'KLAX', 'B772', '08:00', '11:20', 2475, 320,  '1234567', 1],
      ['SMA502', 'KLAX', 'KJFK', 'B772', '13:00', '21:05', 2475, 305,  '1234567', 1],
      ['SMA503', 'KSFO', 'KJFK', 'B789', '07:00', '15:10', 2586, 310,  '1234567', 1],
      ['SMA504', 'KJFK', 'KSFO', 'B789', '17:00', '20:30', 2586, 330,  '1234567', 1],
      ['SMA505', 'KSEA', 'KMIA', 'A333', '06:00', '13:45', 2724, 345,  '12345',   1],
      ['SMA506', 'KMIA', 'KSEA', 'A333', '15:00', '19:30', 2724, 330,  '12345',   1],

      // Cross-country medium
      ['SMA301', 'KORD', 'KDEN', 'B738', '07:00', '09:00', 888,  120,  '1234567', 1],
      ['SMA302', 'KDEN', 'KORD', 'B738', '10:00', '13:00', 888,  120,  '1234567', 1],
      ['SMA303', 'KATL', 'KMCO', 'A320', '08:00', '09:30', 403,   90,  '1234567', 1],
      ['SMA304', 'KMCO', 'KATL', 'A320', '11:00', '12:30', 403,   90,  '1234567', 1],
    ] as const;

    const insertMany = db.transaction(() => {
      for (const s of schedules) {
        insertSchedule.run(...s);
      }
    });
    insertMany();
    console.log(`[Seed] ${schedules.length} scheduled flights created`);
  }

  // ── Logbook (14 completed flights over past 2 weeks) ──────────
  const logbookCount = db.prepare('SELECT COUNT(*) as count FROM logbook').get() as { count: number };
  if (logbookCount.count === 0) {
    const insertLog = db.prepare(`
      INSERT INTO logbook (
        user_id, flight_number, dep_icao, arr_icao, aircraft_type, aircraft_registration,
        scheduled_dep, scheduled_arr, actual_dep, actual_arr, flight_time_min, distance_nm,
        fuel_used_lbs, fuel_planned_lbs, route, cruise_altitude,
        pax_count, cargo_lbs, landing_rate_fpm, score, status, remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Flights for admin (user_id=1) and pilot (user_id=2), realistic dates
    const logEntries = [
      // Admin (SMA-001) — 8 flights
      [1, 'SMA501', 'KJFK', 'KLAX', 'B772', 'N772SM',
        '2026-02-05T08:00:00Z', '2026-02-05T11:20:00Z',
        '2026-02-05T08:12:00Z', '2026-02-05T11:35:00Z',
        323, 2475, 48200, 49500, 'MERIT J60 MIZAR J64 LENDY6', 'FL370',
        287, 4200, -142, 92, 'completed', 'Smooth ride, minor headwinds over the Rockies', '2026-02-05T11:35:00Z'],

      [1, 'SMA502', 'KLAX', 'KJFK', 'B772', 'N772SM',
        '2026-02-06T13:00:00Z', '2026-02-06T21:05:00Z',
        '2026-02-06T13:08:00Z', '2026-02-06T20:48:00Z',
        300, 2475, 46800, 48100, 'SEAL8 J146 WHALE J80 BETTE2', 'FL390',
        302, 3800, -168, 88, 'completed', 'Strong tailwinds, arrived early', '2026-02-06T20:48:00Z'],

      [1, 'SMA201', 'KJFK', 'KORD', 'A320', 'N320SM',
        '2026-02-08T08:00:00Z', '2026-02-08T10:15:00Z',
        '2026-02-08T08:05:00Z', '2026-02-08T10:22:00Z',
        137, 740, 9850, 10200, 'WHITE J584 KEYED2', 'FL350',
        142, 1200, -156, 90, 'completed', null, '2026-02-08T10:22:00Z'],

      [1, 'SMA202', 'KORD', 'KJFK', 'A320', 'N320SM',
        '2026-02-08T11:00:00Z', '2026-02-08T13:15:00Z',
        '2026-02-08T11:15:00Z', '2026-02-08T13:38:00Z',
        143, 740, 10100, 10200, 'BACEN3 J584 BIGGY CAMRN4', 'FL330',
        138, 950, -210, 78, 'completed', 'Turbulence over Pennsylvania, firm landing', '2026-02-08T13:38:00Z'],

      [1, 'SMA101', 'KJFK', 'KBOS', 'E175', 'N175SM',
        '2026-02-10T07:00:00Z', '2026-02-10T08:15:00Z',
        '2026-02-10T07:03:00Z', '2026-02-10T08:12:00Z',
        69, 187, 3200, 3500, 'MERIT LUCOS BOSTN3', 'FL240',
        64, 420, -125, 95, 'completed', 'Beautiful morning departure, smooth approach into BOS', '2026-02-10T08:12:00Z'],

      [1, 'SMA503', 'KSFO', 'KJFK', 'B789', 'N789SM',
        '2026-02-12T07:00:00Z', '2026-02-12T15:10:00Z',
        '2026-02-12T07:22:00Z', '2026-02-12T15:28:00Z',
        306, 2586, 41500, 43200, 'SXC4 J80 PUDDS J6 MERIT LENDY6', 'FL410',
        268, 5100, -135, 93, 'completed', 'RVSM at FL410, great fuel burn on the 787', '2026-02-12T15:28:00Z'],

      [1, 'SMA301', 'KORD', 'KDEN', 'B738', 'N801SM',
        '2026-02-15T07:00:00Z', '2026-02-15T09:00:00Z',
        '2026-02-15T07:10:00Z', '2026-02-15T09:08:00Z',
        118, 888, 11400, 11800, 'PALER4 J100 ELBERT FQF', 'FL360',
        148, 2800, -180, 85, 'completed', null, '2026-02-15T09:08:00Z'],

      [1, 'SMA205', 'KMIA', 'KJFK', 'A321', 'N322SM',
        '2026-02-17T06:00:00Z', '2026-02-17T08:45:00Z',
        '2026-02-17T06:05:00Z', '2026-02-17T08:52:00Z',
        167, 1089, 13200, 13800, 'WINCO TYDAL J209 BETTE2', 'FL350',
        184, 3200, -148, 91, 'completed', 'Light chop FL300-340, otherwise smooth', '2026-02-17T08:52:00Z'],

      // Pilot (SMA-042) — 6 flights
      [2, 'SMA303', 'KATL', 'KMCO', 'A320', 'N321SM',
        '2026-02-04T08:00:00Z', '2026-02-04T09:30:00Z',
        '2026-02-04T08:02:00Z', '2026-02-04T09:28:00Z',
        86, 403, 5800, 6100, 'DUVLL FETAL CWRLD3', 'FL280',
        132, 800, -115, 96, 'completed', 'Quick hop to Orlando, greaser landing', '2026-02-04T09:28:00Z'],

      [2, 'SMA304', 'KMCO', 'KATL', 'A320', 'N321SM',
        '2026-02-04T11:00:00Z', '2026-02-04T12:30:00Z',
        '2026-02-04T11:10:00Z', '2026-02-04T12:42:00Z',
        92, 403, 5950, 6100, 'MCCOY3 PECHY J14 CLTQQ ROBIE3', 'FL300',
        128, 650, -195, 80, 'completed', 'ATC delays on departure, gusty crosswind at ATL', '2026-02-04T12:42:00Z'],

      [2, 'SMA203', 'KATL', 'KDFW', 'B738', 'N801SM',
        '2026-02-07T07:30:00Z', '2026-02-07T09:15:00Z',
        '2026-02-07T07:45:00Z', '2026-02-07T09:32:00Z',
        107, 731, 10200, 10500, 'KAJUN3 BEREE J4 FINGR SEEVR4', 'FL340',
        152, 3100, -165, 87, 'completed', null, '2026-02-07T09:32:00Z'],

      [2, 'SMA505', 'KSEA', 'KMIA', 'A333', 'N333SM',
        '2026-02-09T06:00:00Z', '2026-02-09T13:45:00Z',
        '2026-02-09T06:18:00Z', '2026-02-09T14:02:00Z',
        344, 2724, 38900, 40200, 'SUMMA2 J1 GIGEM J4 ALTAS HILEY4', 'FL380',
        258, 8200, -152, 89, 'completed', 'Cross-country on the A330, nice routing over the gulf', '2026-02-09T14:02:00Z'],

      [2, 'SMA105', 'KLAS', 'KPHX', 'E175', 'N175SM',
        '2026-02-14T06:30:00Z', '2026-02-14T07:45:00Z',
        '2026-02-14T06:35:00Z', '2026-02-14T07:42:00Z',
        67, 256, 3100, 3400, 'COWBY5 TNP KOOLY BXK EAGUL5', 'FL260',
        68, 380, -130, 94, 'completed', 'Desert morning, crystal clear skies', '2026-02-14T07:42:00Z'],

      [2, 'SMA207', 'KDEN', 'KIAH', 'B739', 'N901SM',
        '2026-02-18T09:00:00Z', '2026-02-18T11:30:00Z',
        '2026-02-18T09:08:00Z', '2026-02-18T11:45:00Z',
        157, 879, 11800, 12100, 'PLAIN5 J17 WLEEE LFK HUUEY3', 'FL350',
        168, 2900, -188, 84, 'completed', 'Mountain wave turbulence departing DEN', '2026-02-18T11:45:00Z'],
    ];

    const insertMany = db.transaction(() => {
      for (const l of logEntries) {
        insertLog.run(...l);
      }
    });
    insertMany();
    console.log(`[Seed] ${logEntries.length} logbook entries created`);
  }

  // ── News / Announcements ────────────────────────────────────────
  const newsCount = db.prepare('SELECT COUNT(*) as count FROM news').get() as { count: number };
  if (newsCount.count === 0) {
    const insertNews = db.prepare(`
      INSERT INTO news (author_id, title, body, pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const newsPosts = [
      [1, 'Welcome to SMA Virtual',
        'Welcome aboard! SMA Virtual is a cargo-first virtual airline operating across the United States. Browse our schedule, bid on flights, and start logging hours. Check the fleet page for available aircraft and the dispatch board for your next mission. Blue skies!',
        1, '2026-02-01T12:00:00Z', '2026-02-01T12:00:00Z'],
      [1, 'New Fleet Additions — February 2026',
        'We\'re excited to announce the addition of two new Boeing 777-200ER aircraft to our fleet (N772SM and N773SM), based at KJFK. These widebodies will serve our transcontinental cargo routes between JFK and LAX. Additionally, a Boeing 787-9 Dreamliner (N789SM) joins the SFO hub for long-haul operations.',
        0, '2026-02-10T09:30:00Z', '2026-02-10T09:30:00Z'],
    ] as const;

    const insertManyNews = db.transaction(() => {
      for (const n of newsPosts) {
        insertNews.run(...n);
      }
    });
    insertManyNews();
    console.log(`[Seed] ${newsPosts.length} news posts created`);
  }
}

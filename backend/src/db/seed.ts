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
    insertUser.run('admin@smavirtual.com', 'SMX-001', passwordHash, 'Admin', 'User', 'admin', 'Captain');
    console.log('[Seed] Admin user created: admin@smavirtual.com');
  }

  // ── Airports (95 SMA route airports from oa_airports) ─────────
  const airportCount = db.prepare('SELECT COUNT(*) as count FROM airports').get() as { count: number };
  if (airportCount.count === 0) {
    const icaos = [
      'CYLW','CYQM','CYWG','CYYC','CYYZ','EDDP','HKJK','KAFW','KBDL','KBNA',
      'KBRO','KBUR','KBWI','KCLE','KCMH','KCRP','KDEN','KDTW','KEB','KELP',
      'KFAT','KFLL','KGJT','KGPT','KGSP','KJFK','KLAX','KLGB','KMDT','KMIA',
      'KMKE','KMRY','KMSY','KOAK','KOKC','KOMA','KPDX','KPSP','KRDU','KRFD',
      'KRIC','KRNO','KSAN','KSBA','KSBP','KSDF','KSEA','KSJC','KSLC','KSTL',
      'KSYR','KTPA','MDSD','MKJS','MMGL','MMMY','MTPP','MUGM','MYGF','MYNN',
      'PABR','PACV','PACX','PADQ','PAEN','PAFA','PAGK','PAHO','PAHU','PAJN',
      'PAKD','PAKH','PAMC','PANC','PANO','PAOM','PARY','PASO','PATK','PAUN',
      'PAYA','PFAL','PFTO','PFYU','PHNL','PHTO','RJTT','SBEG','SBFI','SBGR',
      'SKBO','SMJP','SPJC','TJSJ','TPO',
    ];

    /** Derive country ISO-2 from ICAO prefix */
    function countryFromIcao(icao: string): string {
      if (icao.startsWith('K') || icao.startsWith('PH') || icao.startsWith('PA') || icao.startsWith('PF') || icao.startsWith('TJ')) return 'US';
      if (icao.startsWith('CY')) return 'CA';
      if (icao.startsWith('ED')) return 'DE';
      if (icao.startsWith('HK')) return 'KE';
      if (icao.startsWith('SB')) return 'BR';
      if (icao.startsWith('SP')) return 'PE';
      if (icao.startsWith('SK')) return 'CO';
      if (icao.startsWith('SM')) return 'SR';
      if (icao.startsWith('MM')) return 'MX';
      if (icao.startsWith('MD')) return 'DO';
      if (icao.startsWith('MK')) return 'JM';
      if (icao.startsWith('MT')) return 'HT';
      if (icao.startsWith('MU')) return 'CU';
      if (icao.startsWith('MY')) return 'BS';
      if (icao.startsWith('RJ')) return 'JP';
      return 'XX';
    }

    /** Derive timezone from ICAO prefix (rough approximation) */
    function timezoneFromIcao(icao: string): string {
      if (icao.startsWith('PA') || icao.startsWith('PF')) return 'America/Anchorage';
      if (icao.startsWith('PH')) return 'Pacific/Honolulu';
      if (icao.startsWith('CY')) return 'America/Toronto';
      if (icao.startsWith('ED')) return 'Europe/Berlin';
      if (icao.startsWith('HK')) return 'Africa/Nairobi';
      if (icao.startsWith('SB')) return 'America/Sao_Paulo';
      if (icao.startsWith('SP')) return 'America/Lima';
      if (icao.startsWith('SK')) return 'America/Bogota';
      if (icao.startsWith('SM')) return 'America/Paramaribo';
      if (icao.startsWith('MM')) return 'America/Mexico_City';
      if (icao.startsWith('MD')) return 'America/Santo_Domingo';
      if (icao.startsWith('MK')) return 'America/Jamaica';
      if (icao.startsWith('MT')) return 'America/Port-au-Prince';
      if (icao.startsWith('MU')) return 'America/Havana';
      if (icao.startsWith('MY')) return 'America/Nassau';
      if (icao.startsWith('RJ')) return 'Asia/Tokyo';
      if (icao.startsWith('TJ')) return 'America/Puerto_Rico';
      return 'America/New_York'; // default for K-prefixed US airports
    }

    const insertAirport = db.prepare(`
      INSERT OR IGNORE INTO airports (icao, name, city, state, country, lat, lon, elevation, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const lookupOa = db.prepare(`
      SELECT name, municipality, iso_region, latitude_deg, longitude_deg, elevation_ft
      FROM oa_airports WHERE ident = ?
    `);

    type OaRow = {
      name: string; municipality: string | null; iso_region: string | null;
      latitude_deg: number | null; longitude_deg: number | null; elevation_ft: number | null;
    };

    const txn = db.transaction(() => {
      let seeded = 0;
      for (const icao of icaos) {
        const oa = lookupOa.get(icao) as OaRow | undefined;

        if (!oa || oa.latitude_deg == null) {
          console.log(`[Seed] WARNING: Airport ${icao} not found in oa_airports — skipping`);
          continue;
        }

        // Extract state from iso_region (e.g., "US-CA" → "CA")
        const state = oa.iso_region?.split('-')[1] ?? '';
        const country = countryFromIcao(icao);
        const timezone = timezoneFromIcao(icao);

        insertAirport.run(
          icao, oa.name, oa.municipality ?? '', state, country,
          oa.latitude_deg, oa.longitude_deg, oa.elevation_ft ?? 0, timezone
        );
        seeded++;
      }
      return seeded;
    });

    const count = txn();
    console.log(`[Seed] ${count} airports created from oa_airports`);
  }
}

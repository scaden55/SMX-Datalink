#!/usr/bin/env node
/**
 * Flight Simulator — sends realistic heartbeats through the real backend
 * without needing MSFS. Registers/logs in as a test pilot, picks up or
 * creates a bid, saves a minimal flight plan, then animates heartbeats
 * along the great-circle route while cycling through flight phases.
 *
 * Usage:
 *   node scripts/simulate-flight.mjs [--url http://localhost:3001] [--speed 50]
 *
 * Options:
 *   --url    Backend URL (default: http://localhost:3001)
 *   --speed  Simulation speed multiplier (default: 50, i.e. 50x real time)
 */

import { io } from 'socket.io-client';

// ── Config ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
function arg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const BASE_URL = arg('url', 'http://localhost:3001');
const SPEED = Number(arg('speed', '50'));
const HEARTBEAT_INTERVAL_MS = Number(arg('heartbeat', '30000')); // match Electron's 30s default

const TEST_PILOT = {
  email: 'testpilot@smavirtual.com',
  password: 'TestPilot2026!',
  firstName: 'Test',
  lastName: 'Pilot',
};

// ── Helpers ─────────────────────────────────────────────────────
async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function toRad(d) { return d * Math.PI / 180; }
function toDeg(r) { return r * 180 / Math.PI; }

/** Great-circle interpolation between two lat/lon points */
function interpolate(lat1, lon1, lat2, lon2, fraction) {
  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
  ));
  if (d < 1e-10) return { lat: lat1, lon: lon1 };
  const A = Math.sin((1 - fraction) * d) / Math.sin(d);
  const B = Math.sin(fraction * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lon: toDeg(Math.atan2(y, x)) };
}

/** Bearing from point 1 to point 2 */
function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Great-circle distance in NM */
function distanceNm(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * 3440.065 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Flight phases with fraction ranges ──────────────────────────
// Each phase occupies a fraction of the total route distance
const PHASES = [
  { phase: 'PREFLIGHT',  start: 0.000, end: 0.000, alt: 0,     gs: 0   },
  { phase: 'TAXI_OUT',   start: 0.000, end: 0.005, alt: 0,     gs: 15  },
  { phase: 'TAKEOFF',    start: 0.005, end: 0.015, alt: 1500,  gs: 160 },
  { phase: 'CLIMB',      start: 0.015, end: 0.15,  alt: 20000, gs: 320 },
  { phase: 'CRUISE',     start: 0.15,  end: 0.80,  alt: 35000, gs: 460 },
  { phase: 'DESCENT',    start: 0.80,  end: 0.92,  alt: 10000, gs: 300 },
  { phase: 'APPROACH',   start: 0.92,  end: 0.97,  alt: 3000,  gs: 180 },
  { phase: 'LANDING',    start: 0.97,  end: 0.995, alt: 0,     gs: 140 },
  { phase: 'TAXI_IN',    start: 0.995, end: 1.000, alt: 0,     gs: 15  },
];

function getPhaseData(fraction) {
  for (const p of PHASES) {
    if (fraction >= p.start && fraction < p.end) return p;
  }
  return { phase: 'PARKED', start: 1, end: 1, alt: 0, gs: 0 };
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`\n  SMA ACARS Flight Simulator`);
  console.log(`  Backend: ${BASE_URL}`);
  console.log(`  Speed:   ${SPEED}x real time\n`);

  // 1. Register or login
  let token, userId, callsign;
  try {
    console.log('  Registering test pilot...');
    const reg = await api('POST', '/api/auth/register', TEST_PILOT);
    token = reg.accessToken;
    userId = reg.user.id;
    callsign = reg.user.callsign;
    console.log(`  Created account: ${callsign} (${reg.user.email})`);
  } catch (err) {
    if (err.message.includes('409') || err.message.includes('already')) {
      console.log('  Account exists, logging in...');
      const login = await api('POST', '/api/auth/login', {
        email: TEST_PILOT.email,
        password: TEST_PILOT.password,
      });
      token = login.accessToken;
      userId = login.user.id;
      callsign = login.user.callsign;
      console.log(`  Logged in as: ${callsign}`);
    } else {
      throw err;
    }
  }

  // 2. Reuse existing bid or pick a fresh schedule matching the aircraft location
  let bid;
  const myBids = await api('GET', '/api/bids/my', null, token);
  if (myBids.bids && myBids.bids.length > 0) {
    bid = myBids.bids[0];
    console.log(`  Using existing bid: ${bid.flightNumber} (${bid.depIcao} → ${bid.arrIcao}) [bid ${bid.id}]`);
  } else {
    // Get schedules and pick one
    const schedules = await api('GET', '/api/schedules', null, token);
    const scheduleList = schedules.schedules || schedules;
    if (!scheduleList || scheduleList.length === 0) {
      console.error('  No schedules available. Create some schedules first.');
      process.exit(1);
    }
    // Get active aircraft from fleet
    const allFleet = await api('GET', '/api/fleet', null, token);
    const aircraft = allFleet.find(a => a.status === 'active');
    if (!aircraft) {
      console.error('  No active aircraft available. Activate an aircraft first.');
      process.exit(1);
    }

    // Pick a schedule that departs from the aircraft's current location (avoids reposition block)
    const acftLocation = aircraft.locationIcao || aircraft.baseIcao;
    let schedule;
    if (acftLocation) {
      schedule = scheduleList.find(s => s.depIcao === acftLocation && s.distanceNm > 100 && s.distanceNm < 3000);
      if (!schedule) schedule = scheduleList.find(s => s.depIcao === acftLocation);
    }
    if (!schedule) {
      schedule = scheduleList.find(s => s.distanceNm > 100 && s.distanceNm < 3000) || scheduleList[0];
    }

    console.log(`  Placing bid: ${schedule.flightNumber} (${schedule.depIcao} → ${schedule.arrIcao}) on ${aircraft.registration}...`);
    let bidResult;
    try {
      bidResult = await api('POST', '/api/bids', { scheduleId: schedule.id, aircraftId: aircraft.id }, token);
    } catch (err) {
      // Try other schedules if this one fails
      for (const alt of scheduleList.filter(s => s.id !== schedule.id).slice(0, 5)) {
        try {
          console.log(`  Retrying with ${alt.flightNumber} (${alt.depIcao} → ${alt.arrIcao})...`);
          bidResult = await api('POST', '/api/bids', { scheduleId: alt.id, aircraftId: aircraft.id }, token);
          break;
        } catch { continue; }
      }
      if (!bidResult) throw err;
    }
    bid = bidResult.bid;
    console.log(`  Bid placed: ${bid.flightNumber}`);
  }

  // 3. Look up airport coordinates
  let depLat, depLon, arrLat, arrLon;
  try {
    const dep = await api('GET', `/api/airports/${bid.depIcao}`, null, token);
    const arr = await api('GET', `/api/airports/${bid.arrIcao}`, null, token);
    depLat = dep.latitude; depLon = dep.longitude;
    arrLat = arr.latitude; arrLon = arr.longitude;
  } catch {
    // Fallback: use airports from the airports list
    const airports = await api('GET', '/api/airports', null, token);
    const dep = airports.find(a => a.icao === bid.depIcao);
    const arr = airports.find(a => a.icao === bid.arrIcao);
    if (!dep || !arr) {
      console.error(`  Could not find airports ${bid.depIcao} / ${bid.arrIcao}`);
      process.exit(1);
    }
    depLat = dep.lat; depLon = dep.lon;
    arrLat = arr.lat; arrLon = arr.lon;
  }

  const totalNm = distanceNm(depLat, depLon, arrLat, arrLon);
  console.log(`  Route: ${bid.depIcao} → ${bid.arrIcao} (${Math.round(totalNm)} nm)`);

  // 4. Save a minimal flight plan so it shows on the dispatch page
  const flightPlanData = {
    origin: bid.depIcao,
    destination: bid.arrIcao,
    route: 'DCT',
    cruiseFL: 'FL350',
    costIndex: '100',
    flightNumber: bid.flightNumber,
    pic: `${TEST_PILOT.firstName} ${TEST_PILOT.lastName}`,
    alternate1: '',
    alternate2: '',
    fuelPlanned: '15000',
    fuelTotal: '15000',
    fuelBurn: '10000',
    estZfw: '120000',
    estTow: '135000',
    estLdw: '125000',
    payload: '30000',
    paxCount: '0',
    cargoLbs: '30000',
    depRunway: '',
    arrRunway: '',
    sid: '',
    star: '',
    aobFL: '',
    melRestrictions: '',
    dispatcherRemarks: '',
    autoRemarks: '',
    units: 'LBS',
    contpct: '5',
    resvrule: 'AUTO',
    stepclimbs: false,
    etops: false,
    etd: '',
    fuelExtra: '',
    fuelAlternate: '',
    fuelReserve: '',
    fuelTaxi: '',
    fuelContingency: '',
  };

  try {
    await api('PUT', `/api/bids/${bid.id}/flight-plan`, {
      flightPlanData,
      phase: 'planning',
    }, token);
    console.log('  Flight plan saved');
  } catch (err) {
    console.log(`  Flight plan save: ${err.message}`);
  }

  // Transition to active phase so the backend associates this bid with heartbeats
  try {
    await api('PUT', `/api/bids/${bid.id}/flight-plan`, {
      flightPlanData,
      phase: 'active',
    }, token);
    console.log('  Flight plan activated');
  } catch (err) {
    console.log(`  Flight plan activate: ${err.message}`);
  }

  // 5. Connect WebSocket and start heartbeats
  console.log('\n  Connecting WebSocket...');
  const socket = io(BASE_URL, {
    transports: ['websocket'],
    auth: { token },
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
  });
  console.log('  WebSocket connected\n');

  // 6. Simulate the flight
  const cruiseSpeedKts = 460;
  // Time to fly the route at cruise speed (in real seconds), then divide by speed multiplier
  const flightDurationSec = (totalNm / cruiseSpeedKts) * 3600 / SPEED;
  const startTime = Date.now();

  console.log(`  Flight duration: ~${Math.round(flightDurationSec)}s (${Math.round(totalNm / cruiseSpeedKts * 60)} real minutes at ${SPEED}x)`);
  console.log('  Press Ctrl+C to stop\n');

  // Send preflight heartbeat first
  let lastPhase = '';

  const heartbeatLoop = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const fraction = Math.min(elapsed / flightDurationSec, 1.0);
    const phaseData = getPhaseData(fraction);

    // Interpolate position
    const pos = interpolate(depLat, depLon, arrLat, arrLon, fraction);
    const hdg = bearing(pos.lat, pos.lon, arrLat, arrLon);

    // Smooth altitude transition
    const alt = phaseData.alt;
    const gs = phaseData.gs;

    const heartbeat = {
      userId,
      callsign,
      aircraftType: bid.aircraftIcaoType || 'B738',
      latitude: pos.lat,
      longitude: pos.lon,
      altitude: alt,
      heading: Math.round(hdg),
      groundSpeed: gs,
      phase: phaseData.phase,
      timestamp: new Date().toISOString(),
    };

    socket.emit('flight:heartbeat', heartbeat);

    if (phaseData.phase !== lastPhase) {
      const pct = (fraction * 100).toFixed(1);
      console.log(`  [${pct}%] Phase: ${phaseData.phase.padEnd(12)} | ALT: ${String(alt).padStart(6)} ft | GS: ${String(gs).padStart(3)} kts | HDG: ${String(Math.round(hdg)).padStart(3)}°`);
      lastPhase = phaseData.phase;
    }

    if (fraction >= 1.0) {
      console.log('\n  Flight complete!');
      clearInterval(heartbeatLoop);

      // File PIREP via API (same as Electron's DispatchActionBar)
      try {
        console.log('  Filing PIREP...');
        const result = await api('POST', `/api/dispatch/flights/${bid.id}/complete`, {
          remarks: 'Simulated flight via simulate-flight.mjs',
          clientFlightEvents: {
            landingRateFpm: -180,
            landingGForce: 1.15,
            takeoffFuelLbs: 15000,
            takeoffTime: new Date(startTime + flightDurationSec * 0.015 * 1000).toISOString(),
            oooiOut: new Date(startTime).toISOString(),
            oooiOff: new Date(startTime + flightDurationSec * 0.005 * 1000).toISOString(),
            oooiOn: new Date(startTime + flightDurationSec * 0.97 * 1000).toISOString(),
            oooiIn: new Date(startTime + flightDurationSec * 1000).toISOString(),
          },
          clientFuelLbs: 5000,
        }, token);
        console.log(`  PIREP filed! Logbook entry #${result.logbookId}`);
      } catch (err) {
        console.log(`  PIREP filing failed: ${err.message}`);
      }

      // Clean up websocket
      socket.emit('flight:ended');
      setTimeout(() => {
        socket.disconnect();
        console.log('  Disconnected. Goodbye.\n');
        process.exit(0);
      }, 1000);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n  Stopping simulation...');
    socket.emit('flight:ended');
    clearInterval(heartbeatLoop);
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 1000);
  });
}

main().catch((err) => {
  console.error(`\n  Error: ${err.message}\n`);
  process.exit(1);
});

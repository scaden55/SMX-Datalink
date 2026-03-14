import type {
  SimBriefOFP,
  SimBriefStep,
  SimBriefFuel,
  SimBriefWeights,
  SimBriefTimes,
  SimBriefAlternate,
  FlightPlanFormData,
  Waypoint,
} from '@acars/shared';

/**
 * Parse SimBrief JSON API response into structured OFP data.
 * Pure function — no side effects.
 */
export function parseSimBriefResponse(json: any): SimBriefOFP {
  const general = json.general ?? {};
  const origin = json.origin ?? {};
  const destination = json.destination ?? {};

  const navlog = json.navlog?.fix ?? [];
  const fuelData = json.fuel ?? {};
  const weightsData = json.weights ?? {};
  const timesData = json.times ?? {};
  const alts = json.alternate ? (Array.isArray(json.alternate) ? json.alternate : [json.alternate]) : [];
  const textSection = json.text ?? '';
  const crew = json.crew ?? {};

  const fuel: SimBriefFuel = {
    plannedLbs: toNum(fuelData.plan_ramp),
    extraLbs: toNum(fuelData.extra),
    alternateLbs: toNum(fuelData.alternate_burn),
    reserveLbs: toNum(fuelData.reserve),
    taxiLbs: toNum(fuelData.taxi),
    contingencyLbs: toNum(fuelData.contingency),
    totalLbs: toNum(fuelData.plan_ramp),
    burnLbs: toNum(fuelData.enroute_burn),
  };

  const weights: SimBriefWeights = {
    estZfw: toNum(weightsData.est_zfw),
    maxZfw: toNum(weightsData.max_zfw),
    estTow: toNum(weightsData.est_tow),
    maxTow: toNum(weightsData.max_tow),
    estLdw: toNum(weightsData.est_ldw),
    maxLdw: toNum(weightsData.max_ldw),
    payload: toNum(weightsData.payload),
    paxCount: toNum(weightsData.pax_count),
    cargoLbs: toNum(weightsData.cargo),
  };

  const rawSteps: SimBriefStep[] = navlog.map((fix: any) => ({
    ident: toStr(fix.ident),
    lat: toNum(fix.pos_lat),
    lon: toNum(fix.pos_long),
    altitudeFt: toNum(fix.altitude_feet),
    distanceFromOriginNm: toNum(fix.distance),
    fuelRemainLbs: toNum(fix.fuel_plan_onboard),
    wind: fix.wind_dir && fix.wind_spd ? `${fix.wind_dir}/${fix.wind_spd}` : '',
    oat: toNum(fix.oat),
    fixType: toStr(fix.type) || undefined,
  }));

  // Ensure origin airport is first step at field elevation so the vertical
  // profile starts on the ground instead of at the first enroute altitude.
  const originIcao = toStr(origin.icao_code);
  const originElev = toNum(origin.elevation);
  const originLat = toNum(origin.pos_lat);
  const originLon = toNum(origin.pos_long);

  if (rawSteps.length === 0 || rawSteps[0].ident !== originIcao) {
    rawSteps.unshift({
      ident: originIcao,
      lat: originLat,
      lon: originLon,
      altitudeFt: originElev,
      distanceFromOriginNm: 0,
      fuelRemainLbs: fuel.totalLbs,
      wind: '',
      oat: 0,
      fixType: 'apt',
    });
  } else {
    // First step is origin — pin altitude to field elevation
    rawSteps[0].altitudeFt = originElev;
    rawSteps[0].fixType = rawSteps[0].fixType ?? 'apt';
  }

  // Ensure destination airport is last step at field elevation.
  const destIcao = toStr(destination.icao_code);
  const destElev = toNum(destination.elevation);
  const destLat = toNum(destination.pos_lat);
  const destLon = toNum(destination.pos_long);
  const routeDistNm = toNum(general.route_distance);

  // Truncate alternate-route fixes BEFORE bookend logic. SimBrief navlog may
  // include legs to the alternate airport after the destination. Find the
  // first occurrence of the destination (forward scan, skip origin) and cut.
  if (destIcao && destIcao !== originIcao) {
    for (let i = 1; i < rawSteps.length; i++) {
      if (rawSteps[i].ident === destIcao) {
        rawSteps.length = i + 1; // truncate in-place
        break;
      }
    }
  }

  if (rawSteps.length === 0 || rawSteps[rawSteps.length - 1].ident !== destIcao) {
    const lastDist = rawSteps.length > 0
      ? rawSteps[rawSteps.length - 1].distanceFromOriginNm
      : 0;
    rawSteps.push({
      ident: destIcao,
      lat: destLat,
      lon: destLon,
      altitudeFt: destElev,
      distanceFromOriginNm: routeDistNm || lastDist,
      fuelRemainLbs: 0,
      wind: '',
      oat: 0,
      fixType: 'apt',
    });
  } else {
    // Last step is destination — pin altitude to field elevation
    rawSteps[rawSteps.length - 1].altitudeFt = destElev;
    rawSteps[rawSteps.length - 1].fixType = rawSteps[rawSteps.length - 1].fixType ?? 'apt';
  }

  const steps = rawSteps;

  const times: SimBriefTimes = {
    schedDep: toStr(timesData.sched_out),
    schedArr: toStr(timesData.sched_in),
    estEnroute: Math.round(toNum(timesData.est_time_enroute) / 60),
    estBlock: Math.round(toNum(timesData.est_block) / 60),
  };

  const alternates: SimBriefAlternate[] = alts.map((alt: any) => ({
    icao: toStr(alt.icao_code),
    name: toStr(alt.name),
    distanceNm: toNum(alt.distance),
    fuelLbs: toNum(alt.burn),
  }));

  const route = toStr(general.route);
  const cruiseAltitude = toNum(general.initial_altitude);

  // Build raw text from the text fields
  let rawText = '';
  if (typeof textSection === 'string') {
    rawText = textSection;
  } else if (typeof textSection?.plan_html === 'string') {
    rawText = textSection.plan_html.replace(/<[^>]+>/g, '');
  }

  return {
    origin: toStr(origin.icao_code),
    destination: toStr(destination.icao_code),
    route,
    cruiseAltitude,
    costIndex: toNum(general.costindex),
    airline: toStr(general.icao_airline),
    flightNumber: toStr(general.flight_number),
    aircraftType: toStr(general.icao_aircraft),
    fuel,
    weights,
    steps,
    times,
    alternates,
    rawText,
    pilotName: toStr(crew.cpt) || toStr(general.pilot) || '',
    depRunway: toStr(origin.plan_rwy),
    arrRunway: toStr(destination.plan_rwy),
    sid: toStr(origin.plan_sid),
    star: toStr(destination.plan_star),
  };
}

/**
 * Map parsed OFP data to form fields for the planning form.
 */
export function ofpToFormFields(ofp: SimBriefOFP): Partial<FlightPlanFormData> {
  return {
    origin: ofp.origin,
    destination: ofp.destination,
    route: ofp.route,
    cruiseFL: ofp.cruiseAltitude ? `FL${Math.round(ofp.cruiseAltitude / 100)}` : '',
    costIndex: ofp.costIndex ? String(ofp.costIndex) : '',
    alternate1: ofp.alternates[0]?.icao ?? '',
    alternate2: ofp.alternates[1]?.icao ?? '',
    fuelPlanned: ofp.fuel.plannedLbs ? String(ofp.fuel.plannedLbs) : '',
    fuelExtra: ofp.fuel.extraLbs ? String(ofp.fuel.extraLbs) : '',
    fuelAlternate: ofp.fuel.alternateLbs ? String(ofp.fuel.alternateLbs) : '',
    fuelReserve: ofp.fuel.reserveLbs ? String(ofp.fuel.reserveLbs) : '',
    fuelTaxi: ofp.fuel.taxiLbs ? String(ofp.fuel.taxiLbs) : '',
    fuelContingency: ofp.fuel.contingencyLbs ? String(ofp.fuel.contingencyLbs) : '',
    fuelTotal: ofp.fuel.totalLbs ? String(ofp.fuel.totalLbs) : '',
    fuelBurn: ofp.fuel.burnLbs ? String(ofp.fuel.burnLbs) : '',
    estZfw: ofp.weights.estZfw ? String(ofp.weights.estZfw) : '',
    estTow: ofp.weights.estTow ? String(ofp.weights.estTow) : '',
    estLdw: ofp.weights.estLdw ? String(ofp.weights.estLdw) : '',
    payload: ofp.weights.payload ? String(ofp.weights.payload) : '',
    paxCount: ofp.weights.paxCount ? String(ofp.weights.paxCount) : '',
    cargoLbs: ofp.weights.cargoLbs ? String(ofp.weights.cargoLbs) : '',
    pic: ofp.pilotName || '',
    depRunway: ofp.depRunway || '',
    arrRunway: ofp.arrRunway || '',
    sid: ofp.sid || '',
    star: ofp.star || '',
  };
}

export interface AirportBookend {
  icao: string;
  lat: number;
  lon: number;
  elevation: number;
}

/**
 * Convert OFP steps to Waypoint[] for map rendering.
 * When origin/destination are provided, ensures the route starts and ends
 * at field elevation so the vertical profile shows the full climb/descent.
 */
export function stepsToWaypoints(
  steps: SimBriefStep[],
  origin?: AirportBookend,
  destination?: AirportBookend,
): Waypoint[] {
  if (steps.length === 0) return [];

  // Work on a shallow copy so we don't mutate the caller's array
  let work = [...steps];

  // Ensure origin airport is first at field elevation
  if (origin) {
    if (work[0].ident === origin.icao) {
      // Already the first step — pin altitude to field elevation
      work[0] = { ...work[0], altitudeFt: origin.elevation, fixType: work[0].fixType ?? 'apt' };
    } else {
      // Prepend origin at distance 0
      work.unshift({
        ident: origin.icao,
        lat: origin.lat,
        lon: origin.lon,
        altitudeFt: origin.elevation,
        distanceFromOriginNm: 0,
        fuelRemainLbs: 0,
        wind: '',
        oat: 0,
        fixType: 'apt',
      });
    }
  }

  // Ensure destination airport is last at field elevation
  if (destination) {
    const last = work[work.length - 1];
    if (last.ident === destination.icao) {
      work[work.length - 1] = { ...last, altitudeFt: destination.elevation, fixType: last.fixType ?? 'apt' };
    } else {
      work.push({
        ident: destination.icao,
        lat: destination.lat,
        lon: destination.lon,
        altitudeFt: destination.elevation,
        distanceFromOriginNm: last.distanceFromOriginNm,
        fuelRemainLbs: 0,
        wind: '',
        oat: 0,
        fixType: 'apt',
      });
    }
  }

  return work.map((step, i) => ({
    ident: step.ident,
    type: mapFixType(step.fixType, i === 0 || i === work.length - 1),
    latitude: step.lat,
    longitude: step.lon,
    altitude: step.altitudeFt,
    isActive: false,
    distanceFromPrevious: i === 0 ? 0 : step.distanceFromOriginNm - (work[i - 1]?.distanceFromOriginNm ?? 0),
    ete: null,
    eta: null,
    passed: false,
  }));
}

/** Map SimBrief fix type string to Waypoint type. */
function mapFixType(
  fixType: string | undefined,
  isEndpoint: boolean,
): Waypoint['type'] {
  if (isEndpoint) return 'airport';
  switch (fixType) {
    case 'apt': return 'airport';
    case 'vor': return 'vor';
    case 'ndb': return 'ndb';
    case 'ltlg': return 'gps';
    default: return 'intersection'; // wpt, toc, tod, sc, etc.
  }
}

function toNum(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** Safely coerce any SimBrief field to a string (objects → ''). */
function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return ''; // objects, arrays → empty string
}

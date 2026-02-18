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
  const fuelData = json.fuel ?? {};
  const weightsData = json.weights ?? {};
  const timesData = json.times ?? {};
  const navlog = json.navlog?.fix ?? [];
  const alts = json.alternate ? (Array.isArray(json.alternate) ? json.alternate : [json.alternate]) : [];
  const textSection = json.text ?? '';

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

  const steps: SimBriefStep[] = navlog.map((fix: any) => ({
    ident: fix.ident ?? '',
    lat: toNum(fix.pos_lat),
    lon: toNum(fix.pos_long),
    altitudeFt: toNum(fix.altitude_feet),
    distanceFromOriginNm: toNum(fix.distance),
    fuelRemainLbs: toNum(fix.fuel_plan_onboard),
    wind: fix.wind_dir && fix.wind_spd ? `${fix.wind_dir}/${fix.wind_spd}` : '',
    oat: toNum(fix.oat),
  }));

  const times: SimBriefTimes = {
    schedDep: timesData.sched_out ?? '',
    schedArr: timesData.sched_in ?? '',
    estEnroute: Math.round(toNum(timesData.est_time_enroute) / 60),
    estBlock: Math.round(toNum(timesData.est_block) / 60),
  };

  const alternates: SimBriefAlternate[] = alts.map((alt: any) => ({
    icao: alt.icao_code ?? '',
    name: alt.name ?? '',
    distanceNm: toNum(alt.distance),
    fuelLbs: toNum(alt.burn),
  }));

  const route = general.route ?? '';
  const cruiseAltitude = toNum(general.initial_altitude);

  // Build raw text from the text fields
  let rawText = '';
  if (typeof textSection === 'string') {
    rawText = textSection;
  } else if (textSection?.plan_html) {
    rawText = textSection.plan_html.replace(/<[^>]+>/g, '');
  }

  return {
    origin: origin.icao_code ?? '',
    destination: destination.icao_code ?? '',
    route,
    cruiseAltitude,
    costIndex: toNum(general.costindex),
    airline: general.icao_airline ?? '',
    flightNumber: general.flight_number ?? '',
    aircraftType: general.icao_aircraft ?? '',
    fuel,
    weights,
    steps,
    times,
    alternates,
    rawText,
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
  };
}

/**
 * Convert OFP steps to Waypoint[] for map rendering.
 */
export function stepsToWaypoints(steps: SimBriefStep[]): Waypoint[] {
  return steps.map((step, i) => ({
    ident: step.ident,
    type: i === 0 || i === steps.length - 1 ? 'airport' : 'intersection',
    latitude: step.lat,
    longitude: step.lon,
    altitude: step.altitudeFt,
    isActive: false,
    distanceFromPrevious: i === 0 ? 0 : step.distanceFromOriginNm - (steps[i - 1]?.distanceFromOriginNm ?? 0),
    ete: null,
    eta: null,
    passed: false,
  }));
}

function toNum(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

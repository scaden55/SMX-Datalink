/** Raw runway row from the bbox API */
export interface RunwayData {
  airport_ident: string;
  le_ident: string;
  he_ident: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  le_latitude_deg: number;
  le_longitude_deg: number;
  le_heading_degT: number | null;
  le_displaced_threshold_ft: number | null;
  he_latitude_deg: number;
  he_longitude_deg: number;
  he_heading_degT: number | null;
  he_displaced_threshold_ft: number | null;
}

// ── Constants ────────────────────────────────────────────────

const FT_PER_DEG_LAT = 364_000;
const DEG_TO_RAD = Math.PI / 180;

// ── Coordinate helpers ───────────────────────────────────────

function ftToDegLat(ft: number): number {
  return ft / FT_PER_DEG_LAT;
}

function ftToDegLon(ft: number, latDeg: number): number {
  return ft / (FT_PER_DEG_LAT * Math.cos(latDeg * DEG_TO_RAD));
}

function offsetPoint(
  lat: number, lon: number, headingDeg: number, distanceFt: number,
): [number, number] {
  const hdgRad = headingDeg * DEG_TO_RAD;
  const dLat = ftToDegLat(distanceFt) * Math.cos(hdgRad);
  const dLon = ftToDegLon(distanceFt, lat) * Math.sin(hdgRad);
  return [lat + dLat, lon + dLon];
}

function perpendicularOffsets(
  lat: number, lon: number, headingDeg: number, widthFt: number,
): [[number, number], [number, number]] {
  const halfWidth = widthFt / 2;
  const left = offsetPoint(lat, lon, headingDeg - 90, halfWidth);
  const right = offsetPoint(lat, lon, headingDeg + 90, halfWidth);
  return [left, right];
}

function computeHeading(
  leLat: number, leLon: number, heLat: number, heLon: number,
): number {
  const dLat = heLat - leLat;
  const dLon = (heLon - leLon) * Math.cos(((leLat + heLat) / 2) * DEG_TO_RAD);
  const rad = Math.atan2(dLon, dLat);
  return ((rad / DEG_TO_RAD) + 360) % 360;
}

/** Helper: create a GeoJSON LineString feature */
function line(coords: [number, number][], layer: string): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: { layer },
    geometry: { type: 'LineString', coordinates: coords.map(([lat, lon]) => [lon, lat]) },
  };
}

/** Helper: create a GeoJSON Polygon feature */
function poly(coords: [number, number][], layer: string, props: Record<string, unknown> = {}): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring = coords.map(([lat, lon]) => [lon, lat] as [number, number]);
  ring.push(ring[0]); // close ring
  return {
    type: 'Feature',
    properties: { layer, ...props },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

// ── Feature generators ───────────────────────────────────────

/** Runway surface rectangle */
function runwayRect(rwy: RunwayData, leHdg: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const [leL, leR] = perpendicularOffsets(rwy.le_latitude_deg, rwy.le_longitude_deg, leHdg, rwy.width_ft);
  const [heL, heR] = perpendicularOffsets(rwy.he_latitude_deg, rwy.he_longitude_deg, leHdg, rwy.width_ft);
  return poly([leL, leR, heR, heL], 'surface', { airport: rwy.airport_ident });
}

/** Edge lines — two solid lines along the full length of each runway edge */
function edgeLines(rwy: RunwayData, leHdg: number): GeoJSON.Feature<GeoJSON.LineString>[] {
  const inset = rwy.width_ft * 0.02; // slight inset from physical edge
  const edgeW = rwy.width_ft - inset * 2;
  const [leL, leR] = perpendicularOffsets(rwy.le_latitude_deg, rwy.le_longitude_deg, leHdg, edgeW);
  const [heL, heR] = perpendicularOffsets(rwy.he_latitude_deg, rwy.he_longitude_deg, leHdg, edgeW);
  return [
    line([leL, heL], 'edge'),
    line([leR, heR], 'edge'),
  ];
}

/** Centerline dashes — inset from thresholds */
function centerline(rwy: RunwayData, leHdg: number): GeoJSON.Feature<GeoJSON.LineString> {
  let startLat = rwy.le_latitude_deg;
  let startLon = rwy.le_longitude_deg;
  let endLat = rwy.he_latitude_deg;
  let endLon = rwy.he_longitude_deg;

  // Inset past threshold + number area (~500ft from each end)
  const inset = Math.min(500, rwy.length_ft * 0.08);
  [startLat, startLon] = offsetPoint(startLat, startLon, leHdg, inset);
  const heHdg = (leHdg + 180) % 360;
  [endLat, endLon] = offsetPoint(endLat, endLon, heHdg, inset);

  return line([[startLat, startLon], [endLat, endLon]], 'centerline');
}

/** Threshold stripes — multiple parallel bars at each runway end (FAA standard) */
function thresholdStripes(
  rwy: RunwayData, leHdg: number,
): GeoJSON.Feature<GeoJSON.Polygon>[] {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const heHdg = (leHdg + 180) % 360;
  const w = rwy.width_ft;

  // Number of stripes based on runway width (FAA AC 150/5340-1M)
  const stripeCount = w >= 150 ? 16 : w >= 100 ? 12 : w >= 75 ? 8 : 4;
  const stripeLength = Math.min(150, rwy.length_ft * 0.02); // 150ft or 2% of length
  const stripeWidth = 5.75; // FAA standard: ~5.75ft wide each stripe
  const gapWidth = (w * 0.85 - stripeCount * stripeWidth) / (stripeCount - 1); // spread across 85% of width
  const totalStripesWidth = stripeCount * stripeWidth + (stripeCount - 1) * gapWidth;

  // Generate stripes for each end
  for (const [endLat, endLon, hdg] of [
    [rwy.le_latitude_deg, rwy.le_longitude_deg, leHdg],
    [rwy.he_latitude_deg, rwy.he_longitude_deg, heHdg],
  ] as [number, number, number][]) {
    // Threshold position (offset slightly inward)
    const [tLat, tLon] = offsetPoint(endLat, endLon, hdg, 30);

    for (let i = 0; i < stripeCount; i++) {
      const lateralOffset = -totalStripesWidth / 2 + i * (stripeWidth + gapWidth) + stripeWidth / 2;
      const [sLat, sLon] = offsetPoint(tLat, tLon, hdg + 90, lateralOffset);

      // Each stripe is a thin rectangle along the runway heading
      const [nearL, nearR] = perpendicularOffsets(sLat, sLon, hdg, stripeWidth);
      const [farPt] = [offsetPoint(sLat, sLon, hdg, stripeLength)];
      const [farL, farR] = perpendicularOffsets(farPt[0], farPt[1], hdg, stripeWidth);

      features.push(poly([nearL, nearR, farR, farL], 'threshold-stripe'));
    }
  }

  return features;
}

/** Touchdown zone markings — pairs of rectangular bars after threshold */
function touchdownZone(rwy: RunwayData, leHdg: number): GeoJSON.Feature<GeoJSON.Polygon>[] {
  if (rwy.length_ft < 4000) return []; // only on longer runways
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const heHdg = (leHdg + 180) % 360;

  // TDZ bars at 500ft intervals starting at 500ft from threshold
  const barLength = 75;
  const barWidth = rwy.width_ft * 0.06;
  const barSpacing = rwy.width_ft * 0.15; // lateral spacing between pair
  const positions = [500, 1000, 1500]; // distance from threshold in feet

  for (const [endLat, endLon, hdg] of [
    [rwy.le_latitude_deg, rwy.le_longitude_deg, leHdg],
    [rwy.he_latitude_deg, rwy.he_longitude_deg, heHdg],
  ] as [number, number, number][]) {
    for (const dist of positions) {
      if (dist > rwy.length_ft * 0.3) break; // don't go past 30% of runway

      const [cLat, cLon] = offsetPoint(endLat, endLon, hdg, dist);

      // Left bar
      const [lLat, lLon] = offsetPoint(cLat, cLon, hdg - 90, barSpacing);
      const [lNearL, lNearR] = perpendicularOffsets(lLat, lLon, hdg, barWidth);
      const lFar = offsetPoint(lLat, lLon, hdg, barLength);
      const [lFarL, lFarR] = perpendicularOffsets(lFar[0], lFar[1], hdg, barWidth);
      features.push(poly([lNearL, lNearR, lFarR, lFarL], 'tdz'));

      // Right bar
      const [rLat, rLon] = offsetPoint(cLat, cLon, hdg + 90, barSpacing);
      const [rNearL, rNearR] = perpendicularOffsets(rLat, rLon, hdg, barWidth);
      const rFar = offsetPoint(rLat, rLon, hdg, barLength);
      const [rFarL, rFarR] = perpendicularOffsets(rFar[0], rFar[1], hdg, barWidth);
      features.push(poly([rNearL, rNearR, rFarR, rFarL], 'tdz'));
    }
  }

  return features;
}

/** Aiming point markings — two thick bars 1000ft from each threshold */
function aimingPoints(rwy: RunwayData, leHdg: number): GeoJSON.Feature<GeoJSON.Polygon>[] {
  if (rwy.length_ft < 4000) return [];
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const heHdg = (leHdg + 180) % 360;

  const barLength = 150;
  const barWidth = rwy.width_ft * 0.08;
  const lateralOffset = rwy.width_ft * 0.2;
  const dist = 1000; // 1000ft from threshold

  for (const [endLat, endLon, hdg] of [
    [rwy.le_latitude_deg, rwy.le_longitude_deg, leHdg],
    [rwy.he_latitude_deg, rwy.he_longitude_deg, heHdg],
  ] as [number, number, number][]) {
    if (dist > rwy.length_ft * 0.3) continue;

    const [cLat, cLon] = offsetPoint(endLat, endLon, hdg, dist);

    for (const side of [-1, 1]) {
      const [bLat, bLon] = offsetPoint(cLat, cLon, hdg + 90 * side, lateralOffset);
      const [nearL, nearR] = perpendicularOffsets(bLat, bLon, hdg, barWidth);
      const far = offsetPoint(bLat, bLon, hdg, barLength);
      const [farL, farR] = perpendicularOffsets(far[0], far[1], hdg, barWidth);
      features.push(poly([nearL, nearR, farR, farL], 'aiming'));
    }
  }

  return features;
}

/** Runway number labels — placed on the surface near each threshold */
function runwayLabels(rwy: RunwayData, leHdg: number): GeoJSON.Feature<GeoJSON.Point>[] {
  const insetFt = Math.min(350, rwy.length_ft * 0.06);
  const heHdg = (leHdg + 180) % 360;

  const [leLat, leLon] = offsetPoint(rwy.le_latitude_deg, rwy.le_longitude_deg, leHdg, insetFt);
  const [heLat, heLon] = offsetPoint(rwy.he_latitude_deg, rwy.he_longitude_deg, heHdg, insetFt);

  return [
    {
      type: 'Feature',
      properties: { layer: 'label', ident: rwy.le_ident || '', rotation: leHdg },
      geometry: { type: 'Point', coordinates: [leLon, leLat] },
    },
    {
      type: 'Feature',
      properties: { layer: 'label', ident: rwy.he_ident || '', rotation: heHdg },
      geometry: { type: 'Point', coordinates: [heLon, heLat] },
    },
  ];
}

// ── Public API ───────────────────────────────────────────────

export function buildRunwayGeoJSON(runways: RunwayData[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const rwy of runways) {
    if (rwy.le_latitude_deg === rwy.he_latitude_deg && rwy.le_longitude_deg === rwy.he_longitude_deg) continue;

    const leHdg = rwy.le_heading_degT
      ?? computeHeading(rwy.le_latitude_deg, rwy.le_longitude_deg, rwy.he_latitude_deg, rwy.he_longitude_deg);

    features.push(runwayRect(rwy, leHdg));
    features.push(...edgeLines(rwy, leHdg));
    features.push(centerline(rwy, leHdg));
    features.push(...thresholdStripes(rwy, leHdg));
    features.push(...touchdownZone(rwy, leHdg));
    features.push(...aimingPoints(rwy, leHdg));
    features.push(...runwayLabels(rwy, leHdg));
  }

  return { type: 'FeatureCollection', features };
}

export const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import Map, { Source, Layer, Marker, Popup } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getMapStyle } from '@/lib/map-style';
import { getAircraftIcon } from '@/lib/aircraft-icons';
import { useRunwayMarkings } from '@/hooks/useRunwayMarkings';
import { useSocket } from '@/hooks/useSocket';
import type { VatsimControllerWithPosition, VatsimAtis, VatsimUpdateEvent } from '@acars/shared';

interface TrackPt {
  lat: number;
  lon: number;
}

interface FlightData {
  latitude: number;
  longitude: number;
  heading: number;
  callsign: string;
  flightNumber?: string;
  aircraftType?: string;
  depIcao?: string;
  arrIcao?: string;
  depLat?: number;
  depLon?: number;
  arrLat?: number;
  arrLon?: number;
  altitude?: number;
  groundSpeed?: number;
  phase?: string;
  trackPoints?: TrackPt[];
  bidId?: number;
}

interface HistoricalRoute {
  callsign: string;
  depLat: number;
  depLon: number;
  arrLat: number;
  arrLon: number;
  trackPoints: TrackPt[];
}

interface HubData {
  lat: number;
  lon: number;
  icao?: string;
  coverage?: number;
}

interface RouteWaypoint {
  lat: number;
  lon: number;
  altitudeFt?: number;
  fixType?: string;
  ident?: string;
}

interface WorldMapProps {
  hubs?: HubData[];
  flights?: FlightData[];
  selectedCallsign?: string | null;
  onSelectCallsign?: (callsign: string | null) => void;
  historicalRoute?: HistoricalRoute | null;
  mode?: 'overview' | 'dispatch';
  onFlightClick?: (flight: FlightData, event: React.MouseEvent) => void;
  selectedRoute?: RouteWaypoint[];
}

// ── Icon URI cache ───────────────────────────────────────────

const dataUriCache: Record<string, string> = {};

function buildUri(typeCode: string | undefined, color: string, suffix = ''): string {
  const key = (typeCode?.toUpperCase().split('/')[0].trim() || 'generic') + color + suffix;
  let uri = dataUriCache[key];
  if (!uri) {
    const info = getAircraftIcon(typeCode);
    const colored = info.svgRaw
      .replace(/currentColor/g, color)
      .replace(/fill="currentColor"/g, `fill="${color}"`);
    uri = `data:image/svg+xml,${encodeURIComponent(colored)}`;
    dataUriCache[key] = uri;
  }
  return uri;
}

// ── Phase color helper (dispatch mode) ───────────────────────

function getMarkerColor(flight: FlightData, mode: string | undefined): string {
  if (mode !== 'dispatch') return '#4ade80'; // default overview color (emerald)
  switch (flight.phase) {
    case 'planning': return '#f59e0b';   // amber
    case 'completed': return '#6b7280';  // gray
    default: return '#4ade80';           // flying/active — emerald
  }
}

// ── Route phase colors ───────────────────────────────────────

const CLR_CLIMB = '#d2a8ff';
const CLR_CRUISE = '#58a6ff';
const CLR_DESCENT = '#3fb950';

function findTocTod(steps: RouteWaypoint[]): { tocIndex: number; todIndex: number } {
  if (steps.length < 2) return { tocIndex: 0, todIndex: steps.length - 1 };

  const tocByType = steps.findIndex(s => s.fixType === 'toc');
  const todByType = steps.length - 1 - [...steps].reverse().findIndex(s => s.fixType === 'tod');
  const hasToc = tocByType >= 0;
  const hasTod = todByType < steps.length && steps.findIndex(s => s.fixType === 'tod') >= 0;

  if (hasToc && hasTod) return { tocIndex: tocByType, todIndex: todByType };

  // Fallback: altitude threshold (90% of max)
  const maxAlt = Math.max(...steps.map(s => s.altitudeFt ?? 0));
  const threshold = maxAlt * 0.9;

  let tocFallback = 0;
  let todFallback = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if ((steps[i].altitudeFt ?? 0) >= threshold) { tocFallback = i; break; }
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    if ((steps[i].altitudeFt ?? 0) >= threshold) { todFallback = i; break; }
  }

  return {
    tocIndex: hasToc ? tocByType : tocFallback,
    todIndex: hasTod ? todByType : todFallback,
  };
}

function getPhaseColor(index: number, tocIndex: number, todIndex: number): string {
  if (index <= tocIndex) return CLR_CLIMB;
  if (index <= todIndex) return CLR_CRUISE;
  return CLR_DESCENT;
}

function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
  }).join(' ');
}

/** Airport icon as a single continuous SVG path — circle with 4 protruding ticks */
function airportPath(r: number): string {
  const tr = r * 1.5; // tick reach (outer end of tick)
  return [
    `M 0 ${-tr}`,
    `L 0 ${-r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    `L ${tr} 0`,
    `L ${r} 0`,
    `A ${r} ${r} 0 0 1 0 ${r}`,
    `L 0 ${tr}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${-r} 0`,
    `L ${-tr} 0`,
    `L ${-r} 0`,
    `A ${r} ${r} 0 0 1 0 ${-r}`,
    'Z',
  ].join(' ');
}

/** Build an aerodrome icon SVG — hollow ring with 4 narrow ticks connected to ring */
function buildAirportSvgUri(size: number, color: string): string {
  const s = size;
  const cx = s / 2;
  const ringR = s * 0.18;       // ring radius (to center of stroke)
  const ringW = s * 0.09;       // ring stroke width
  const tw = s * 0.10;          // tick width (narrower)
  const th = s * 0.12;          // tick length
  const tr = 0;                  // no rounding on ticks

  // Ticks start at the outer edge of the ring (no gap)
  const tickStart = ringR + ringW / 1.9;

  const ticks = [
    `<rect x="${cx - tw/2}" y="${cx - tickStart - th}" width="${tw}" height="${th}" rx="${tr}" fill="${color}"/>`,
    `<rect x="${cx - tw/2}" y="${cx + tickStart}" width="${tw}" height="${th}" rx="${tr}" fill="${color}"/>`,
    `<rect x="${cx - tickStart - th}" y="${cx - tw/2}" width="${th}" height="${tw}" rx="${tr}" fill="${color}"/>`,
    `<rect x="${cx + tickStart}" y="${cx - tw/2}" width="${th}" height="${tw}" rx="${tr}" fill="${color}"/>`,
  ].join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${cx}" cy="${cx}" r="${ringR}" fill="none" stroke="${color}" stroke-width="${ringW}"/>${ticks}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Airport icon image IDs for MapLibre
const APT_ICON_MAJOR = 'apt-major';
const APT_ICON_MEDIUM = 'apt-medium';
const APT_ICON_SMALL = 'apt-small';

const APT_ICON_MAJOR_GREEN = 'apt-major-green';
const APT_ICON_MEDIUM_GREEN = 'apt-medium-green';
const APT_ICON_SMALL_GREEN = 'apt-small-green';

/** Register airport tick-circle icons on the map */
function registerAirportIcons(map: maplibregl.Map) {
  const icons: Array<[string, string]> = [
    [APT_ICON_MAJOR, buildAirportSvgUri(48, '#4F6CCD')],
    [APT_ICON_MEDIUM, buildAirportSvgUri(40, '#4F6CCD')],
    [APT_ICON_SMALL, buildAirportSvgUri(32, '#4F6CCD')],
    [APT_ICON_MAJOR_GREEN, buildAirportSvgUri(48, '#34d399')],
    [APT_ICON_MEDIUM_GREEN, buildAirportSvgUri(40, '#34d399')],
    [APT_ICON_SMALL_GREEN, buildAirportSvgUri(32, '#34d399')],
  ];
  for (const [id, uri] of icons) {
    // Remove old image so updates take effect
    if (map.hasImage(id)) map.removeImage(id);
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, img, { sdf: false });
    };
    img.src = uri;
  }
}

// ── GeoJSON helpers ──────────────────────────────────────────

function toLineGeoJSON(points: Array<{ lat: number; lon: number }>): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map(p => [p.lon, p.lat]),
    },
  };
}

function toPointGeoJSON(lat: number, lon: number, props: Record<string, unknown> = {}): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    properties: props,
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
  };
}

// ── Map style (cached) ──────────────────────────────────────

const mapStyle = getMapStyle();

// ── Component ────────────────────────────────────────────────

export const WorldMap = memo(function WorldMap({
  hubs = [], flights = [],
  selectedCallsign, onSelectCallsign,
  historicalRoute,
  mode, onFlightClick,
  selectedRoute,
}: WorldMapProps) {
  const mapRef = useRef<MapRef>(null);
  const badgeHoverRef = useRef(false);
  const [hoveredHub, setHoveredHub] = useState<number | null>(null);
  const [airportIconsReady, setAirportIconsReady] = useState(false);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    registerAirportIcons(map);
    // Small delay to let images load
    setTimeout(() => setAirportIconsReady(true), 100);
  }, []);

  // ── Runway markings (zoom 13+) ────────────────────────────
  const runwayGeoJson = useRunwayMarkings(mapRef, airportIconsReady);

  // ── FIR boundary data (top-level only, no sub-sectors) ──
  const [firRawFeatures, setFirRawFeatures] = useState<any[] | null>(null);
  useEffect(() => {
    fetch('/api/vatsim/boundaries/fir')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setFirRawFeatures(data.features.filter((f: any) => !f.properties.id?.includes('-')));
      })
      .catch(() => {});
  }, []);

  // ── VATSIM ATC controllers (all facilities) ─────────────
  const [vatsimControllers, setVatsimControllers] = useState<VatsimControllerWithPosition[]>([]);
  const [vatsimAtis, setVatsimAtis] = useState<VatsimAtis[]>([]);
  const [vatsimUpdatedAt, setVatsimUpdatedAt] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/vatsim/data')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setVatsimControllers(data.controllers ?? []);
        setVatsimAtis(data.atis ?? []);
        setVatsimUpdatedAt(Date.now());
      })
      .catch(() => {});
  }, []);

  // Live updates every 15s via socket
  useSocket<VatsimUpdateEvent>('vatsim:update', (data) => {
    setVatsimControllers(data.controllers ?? []);
    setVatsimAtis(data.atis ?? []);
    setVatsimUpdatedAt(Date.now());
  }, { subscribeEvent: 'vatsim:subscribe', unsubscribeEvent: 'vatsim:unsubscribe' });

  // Freshness ticker — re-renders the "Xs ago" label every 5s
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Build boundaryId → controller[] lookups by type
  const { onlineFirMap, onlineTraconMap } = useMemo(() => {
    const fir: Record<string, VatsimControllerWithPosition[]> = {};
    const tracon: Record<string, VatsimControllerWithPosition[]> = {};
    for (const c of vatsimControllers) {
      if (!c.boundaryId) continue;
      if (c.facility === 1 || c.facility === 6) {
        (fir[c.boundaryId] ??= []).push(c);
      } else if (c.facility === 5) {
        (tracon[c.boundaryId] ??= []).push(c);
      }
    }
    return { onlineFirMap: fir, onlineTraconMap: tracon };
  }, [vatsimControllers]);

  // Group local controllers (TWR/GND/DEL) + ATIS by airport for compact badges
  interface FacilityInfo { letter: string; color: string; callsign: string; name: string; frequency: string; logon_time: string }
  interface LocalAtcAirport {
    icao: string;
    lng: number;
    lat: number;
    facilities: FacilityInfo[];
  }
  const localAtcAirports = useMemo<LocalAtcAirport[]>(() => {
    const airports: Record<string, { lng: number; lat: number; seen: Set<string>; facilityList: FacilityInfo[] }> = {};
    const facilityMeta: Record<number, { letter: string; color: string }> = {
      2: { letter: 'D', color: '#60a5fa' },
      3: { letter: 'G', color: '#22c55e' },
      4: { letter: 'T', color: '#ef4444' },
    };
    for (const c of vatsimControllers) {
      if (c.facility < 2 || c.facility > 4) continue;
      if (c.latitude == null || c.longitude == null) continue;
      const prefix = c.parsed?.prefix ?? c.callsign.split('_')[0];
      if (!airports[prefix]) {
        airports[prefix] = { lng: c.longitude, lat: c.latitude, seen: new Set(), facilityList: [] };
      }
      const meta = facilityMeta[c.facility];
      if (meta && !airports[prefix].seen.has(meta.letter)) {
        airports[prefix].seen.add(meta.letter);
        airports[prefix].facilityList.push({ ...meta, callsign: c.callsign, name: c.name, frequency: c.frequency, logon_time: c.logon_time });
      }
    }
    for (const a of vatsimAtis) {
      const prefix = a.callsign.replace(/_ATIS$/, '');
      const info: FacilityInfo = { letter: 'A', color: '#94a3b8', callsign: a.callsign, name: a.name, frequency: a.frequency, logon_time: a.logon_time };
      if (airports[prefix]) {
        if (!airports[prefix].seen.has('A')) {
          airports[prefix].seen.add('A');
          airports[prefix].facilityList.push(info);
        }
      } else {
        const colocated = vatsimControllers.find(c =>
          c.latitude != null && c.callsign.startsWith(prefix) && c.facility >= 2 && c.facility <= 4
        );
        if (colocated) {
          airports[prefix] = { lng: colocated.longitude!, lat: colocated.latitude!, seen: new Set(['A']), facilityList: [info] };
        }
      }
    }
    const letterOrder: Record<string, number> = { D: 0, G: 1, T: 2, A: 3 };
    return Object.entries(airports).map(([icao, data]) => ({
      icao,
      lng: data.lng,
      lat: data.lat,
      facilities: data.facilityList.sort((a, b) => (letterOrder[a.letter] ?? 9) - (letterOrder[b.letter] ?? 9)),
    }));
  }, [vatsimControllers, vatsimAtis]);

  // Enrich FIR polygons + labels with online status
  const firGeoJson = useMemo(() => {
    if (!firRawFeatures) return null;
    return {
      type: 'FeatureCollection' as const,
      features: firRawFeatures.map((f: any) => {
        const controllers = onlineFirMap[f.properties.id];
        return {
          ...f,
          properties: {
            ...f.properties,
            online: controllers ? 1 : 0,
          },
        };
      }),
    };
  }, [firRawFeatures, onlineFirMap]);

  const firLabelGeoJson = useMemo(() => {
    if (!firRawFeatures) return null;
    return {
      type: 'FeatureCollection' as const,
      features: firRawFeatures
        .filter((f: any) => f.properties.label_lon && f.properties.label_lat)
        .map((f: any) => {
          const controllers = onlineFirMap[f.properties.id];
          const primary = controllers?.[0];
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [parseFloat(f.properties.label_lon), parseFloat(f.properties.label_lat)],
            },
            properties: {
              id: f.properties.id,
              online: controllers ? 1 : 0,
              label: primary ? `${primary.callsign} · ${primary.frequency}` : f.properties.id,
            },
          };
        }),
    };
  }, [firRawFeatures, onlineFirMap]);

  // ── TRACON boundary data ─────────────────────────────────
  const [traconRawFeatures, setTraconRawFeatures] = useState<any[] | null>(null);
  useEffect(() => {
    fetch('/api/vatsim/boundaries/tracon')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.features) setTraconRawFeatures(data.features); })
      .catch(() => {});
  }, []);

  // Enrich TRACON polygons + build label points
  const traconGeoJson = useMemo(() => {
    if (!traconRawFeatures) return null;
    // Deduplicate by ID (multiple features can share same ID)
    const seen = new Set<string>();
    return {
      type: 'FeatureCollection' as const,
      features: traconRawFeatures
        .filter((f: any) => {
          const id = f.properties?.id;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((f: any) => ({
          ...f,
          properties: {
            ...f.properties,
            online: onlineTraconMap[f.properties.id] ? 1 : 0,
          },
        })),
    };
  }, [traconRawFeatures, onlineTraconMap]);

  const traconLabelGeoJson = useMemo(() => {
    if (!traconRawFeatures) return null;
    const seen = new Set<string>();
    const features: any[] = [];
    for (const f of traconRawFeatures) {
      const id = f.properties?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      // Use label_lat/lon if available, otherwise compute centroid from first ring
      let lng: number, lat: number;
      if (f.properties.label_lon && f.properties.label_lat) {
        lng = parseFloat(f.properties.label_lon);
        lat = parseFloat(f.properties.label_lat);
      } else if (f.geometry?.coordinates?.[0]?.[0]) {
        const ring = f.geometry.coordinates[0][0];
        lng = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length;
        lat = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
      } else continue;
      const controllers = onlineTraconMap[id];
      const primary = controllers?.[0];
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id,
          name: f.properties.name || id,
          online: controllers ? 1 : 0,
          label: primary ? `${primary.callsign} · ${primary.frequency}` : (f.properties.name || id),
        },
      });
    }
    return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection;
  }, [traconRawFeatures, onlineTraconMap]);

  // ── Airspace hover state (FIR + TRACON) ─────────────────
  const [hoveredAirspace, setHoveredAirspace] = useState<{
    id: string;
    type: 'fir' | 'tracon';
    lng: number;
    lat: number;
    controllers: VatsimControllerWithPosition[];
  } | null>(null);

  // ── Local ATC badge hover state ────────────────────────
  const [hoveredBadge, setHoveredBadge] = useState<LocalAtcAirport | null>(null);

  // ── Airport data for map display ─────────────────────────
  const [rawAirports, setRawAirports] = useState<Array<{ ident: string; type: string; latitude_deg: number; longitude_deg: number }> | null>(null);
  useEffect(() => {
    fetch('/api/airports/map')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setRawAirports(data); })
      .catch(() => {});
  }, []);

  // Match VATSIM prefix (e.g. "MSY") to airport ICAO (e.g. "KMSY")
  // VATSIM strips the K/C prefix for US/Canadian airports
  const { controlledIcaos, vatsimToIcao } = useMemo(() => {
    if (!rawAirports) return { controlledIcaos: new Set<string>(), vatsimToIcao: {} as Record<string, string> };
    // Build reverse lookup: VATSIM prefix → airport ident
    const byIdent: Record<string, string> = {};
    const bySuffix: Record<string, string> = {};
    for (const a of rawAirports) {
      byIdent[a.ident] = a.ident; // exact match (e.g. EGLL → EGLL)
      // US: KMSY → MSY, Canada: CYUL → YUL (don't overwrite existing)
      if (a.ident.length === 4 && a.ident[0] === 'K') bySuffix[a.ident.slice(1)] ??= a.ident;
      if (a.ident.length === 4 && a.ident[0] === 'C') bySuffix[a.ident.slice(1)] ??= a.ident;
    }
    const mapping: Record<string, string> = {};
    const controlled = new Set<string>();
    for (const apt of localAtcAirports) {
      const icao = byIdent[apt.icao] ?? bySuffix[apt.icao];
      if (icao) {
        mapping[apt.icao] = icao;
        controlled.add(icao);
      }
    }
    return { controlledIcaos: controlled, vatsimToIcao: mapping };
  }, [rawAirports, localAtcAirports]);

  // Snap local ATC badge positions to actual airport coordinates
  const snappedLocalAtcAirports = useMemo(() => {
    if (!rawAirports) return localAtcAirports;
    const airportMap: Record<string, { lng: number; lat: number }> = {};
    for (const a of rawAirports) airportMap[a.ident] = { lng: a.longitude_deg, lat: a.latitude_deg };
    return localAtcAirports.map(apt => {
      const icao = vatsimToIcao[apt.icao];
      const match = icao ? airportMap[icao] : null;
      return match ? { ...apt, lng: match.lng, lat: match.lat } : apt;
    });
  }, [localAtcAirports, rawAirports, vatsimToIcao]);

  // Enrich airport GeoJSON with controlled flag
  const airportGeoJson = useMemo(() => {
    if (!rawAirports) return null;
    return {
      type: 'FeatureCollection' as const,
      features: rawAirports.map(a => ({
        type: 'Feature' as const,
        properties: { ident: a.ident, airportType: a.type, controlled: controlledIcaos.has(a.ident) ? 1 : 0 },
        geometry: { type: 'Point' as const, coordinates: [a.longitude_deg, a.latitude_deg] },
      })),
    };
  }, [rawAirports, controlledIcaos]);

  const selectedIdx = useMemo(() => {
    if (!selectedCallsign) return null;
    const idx = flights.findIndex(f => f.callsign === selectedCallsign);
    return idx >= 0 ? idx : null;
  }, [selectedCallsign, flights]);

  const handleSelect = useCallback((idx: number | null) => {
    const callsign = idx !== null ? flights[idx]?.callsign ?? null : null;
    onSelectCallsign?.(callsign);
  }, [flights, onSelectCallsign]);

  const routeFlights = useMemo(
    () => flights.filter(f => f.phase !== 'completed' && f.depLat != null && f.depLon != null && f.arrLat != null && f.arrLon != null),
    [flights],
  );

  const selectedFlight = selectedIdx !== null ? flights[selectedIdx] : null;

  // ── GeoJSON: Unselected route lines ─────────────────────
  const unselectedRoutesGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const f of routeFlights) {
      const flightIdx = flights.indexOf(f);
      if (flightIdx === selectedIdx) continue;
      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [[f.depLon!, f.depLat!], [f.arrLon!, f.arrLat!]],
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [routeFlights, flights, selectedIdx]);

  // ── GeoJSON: Hub dots ───────────────────────────────────
  const hubsGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: hubs.map(h => toPointGeoJSON(h.lat, h.lon, { icao: h.icao ?? '', coverage: h.coverage ?? 0 })),
  }), [hubs]);

  // ── GeoJSON: Selected route segments (phase-colored) ────
  const selectedRouteSegments = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!selectedFlight || !selectedRoute || selectedRoute.length < 2) {
      // Simple dep→arr line if no OFP route
      if (selectedFlight && selectedFlight.depLat != null && selectedFlight.depLon != null && selectedFlight.arrLat != null && selectedFlight.arrLon != null) {
        return {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { color: '#4F6CCD' },
            geometry: {
              type: 'LineString',
              coordinates: [[selectedFlight.depLon!, selectedFlight.depLat!], [selectedFlight.arrLon!, selectedFlight.arrLat!]],
            },
          }],
        };
      }
      return { type: 'FeatureCollection', features: [] };
    }

    const { tocIndex, todIndex } = findTocTod(selectedRoute);
    const features: GeoJSON.Feature[] = [];
    for (let j = 0; j < selectedRoute.length - 1; j++) {
      const wp = selectedRoute[j];
      const next = selectedRoute[j + 1];
      features.push({
        type: 'Feature',
        properties: { color: getPhaseColor(j, tocIndex, todIndex) },
        geometry: {
          type: 'LineString',
          coordinates: [[wp.lon, wp.lat], [next.lon, next.lat]],
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [selectedFlight, selectedRoute]);

  // ── GeoJSON: Actual flown track ─────────────────────────
  const trackGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!selectedFlight?.trackPoints || selectedFlight.trackPoints.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    return { type: 'FeatureCollection', features: [toLineGeoJSON(selectedFlight.trackPoints)] };
  }, [selectedFlight]);

  // ── GeoJSON: Historical route ───────────────────────────
  const historicalGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!historicalRoute || selectedFlight || historicalRoute.trackPoints.length < 2) {
      return { type: 'FeatureCollection', features: [] };
    }
    return { type: 'FeatureCollection', features: [toLineGeoJSON(historicalRoute.trackPoints)] };
  }, [historicalRoute, selectedFlight]);

  // ── Waypoint data for selected route ────────────────────
  const waypointData = useMemo(() => {
    if (!selectedFlight || !selectedRoute || selectedRoute.length < 2) return [];
    const { tocIndex, todIndex } = findTocTod(selectedRoute);
    return selectedRoute.map((wp, j) => ({
      ...wp,
      color: getPhaseColor(j, tocIndex, todIndex),
      index: j,
    }));
  }, [selectedFlight, selectedRoute]);

  // ── Unselected route airport endpoints ──────────────────
  const routeEndpoints = useMemo(() => {
    const pts: Array<{ lon: number; lat: number; icao: string }> = [];
    const seen = new Set<string>();
    for (const f of routeFlights) {
      const flightIdx = flights.indexOf(f);
      if (flightIdx === selectedIdx) continue;
      if (f.depIcao && !seen.has(`${f.depLon},${f.depLat}`)) {
        seen.add(`${f.depLon},${f.depLat}`);
        pts.push({ lon: f.depLon!, lat: f.depLat!, icao: f.depIcao });
      }
      if (f.arrIcao && !seen.has(`${f.arrLon},${f.arrLat}`)) {
        seen.add(`${f.arrLon},${f.arrLat}`);
        pts.push({ lon: f.arrLon!, lat: f.arrLat!, icao: f.arrIcao });
      }
    }
    return pts;
  }, [routeFlights, flights, selectedIdx]);

  // ── Visible aircraft (skip planning/completed) ──────────
  const visibleAircraft = useMemo(() => {
    return flights.map((f, i) => {
      const isPlanning = f.phase === 'planning';
      const isCompleted = f.phase === 'completed';
      if (isPlanning || isCompleted) return null;

      const lat = f.latitude || (f.phase === 'completed' ? (f.arrLat ?? 0) : (f.depLat ?? 0));
      const lon = f.longitude || (f.phase === 'completed' ? (f.arrLon ?? 0) : (f.depLon ?? 0));
      if (lat === 0 && lon === 0) return null;

      return { flight: f, lat, lon, index: i };
    }).filter(Boolean) as Array<{ flight: FlightData; lat: number; lon: number; index: number }>;
  }, [flights]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent' }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 0,
          latitude: 30,
          zoom: 1.5,
        }}
        minZoom={1}
        maxZoom={16}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
        interactiveLayerIds={['fir-fill', 'tracon-fill']}
        onMouseMove={(e) => {
          if (badgeHoverRef.current) return;
          const f = e.features?.[0];
          if (!f || !f.properties || f.properties.online !== 1) {
            if (hoveredAirspace) setHoveredAirspace(null);
            return;
          }
          const id = f.properties.id as string;
          const layerId = f.layer?.id as string;
          const isFir = layerId === 'fir-fill';
          const lookup = isFir ? onlineFirMap : onlineTraconMap;
          const controllers = lookup[id];
          if (controllers) {
            setHoveredAirspace({ id, type: isFir ? 'fir' : 'tracon', lng: e.lngLat.lng, lat: e.lngLat.lat, controllers });
          }
        }}
        onMouseOut={() => { if (hoveredAirspace) setHoveredAirspace(null); }}
      >
        {/* ── Hub dots (overview mode only) ─────────────────── */}
        {mode !== 'dispatch' && (
          <Source id="hubs" type="geojson" data={hubsGeoJSON}>
            <Layer
              id="hub-glow"
              type="circle"
              paint={{
                'circle-radius': 6,
                'circle-color': '#4F6CCD',
                'circle-opacity': 0.2,
              }}
            />
            <Layer
              id="hub-dot"
              type="circle"
              paint={{
                'circle-radius': 3,
                'circle-color': '#4F6CCD',
                'circle-opacity': 0.8,
              }}
            />
          </Source>
        )}

        {/* ── Hub tooltip markers (for hover) ──────────────── */}
        {mode !== 'dispatch' && hubs.map((hub, i) => (
          <Marker
            key={`hub-hover-${i}`}
            longitude={hub.lon}
            latitude={hub.lat}
            anchor="center"
          >
            <div
              onMouseEnter={() => setHoveredHub(i)}
              onMouseLeave={() => setHoveredHub(null)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            {hoveredHub === i && hub.icao && (
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: -10,
                  background: 'rgba(3,7,38,0.85)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  borderRadius: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#ffffff',
                  }}
                >
                  {hub.icao}
                </span>
                {hub.coverage != null && (
                  <span
                    style={{
                      fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.45)',
                      marginLeft: 6,
                    }}
                  >
                    {hub.coverage}%
                  </span>
                )}
              </div>
            )}
          </Marker>
        ))}

        {/* ── FIR ATC boundaries (data-driven: online = highlighted) ── */}
        {firGeoJson && (
          <Source id="fir-boundaries" type="geojson" data={firGeoJson}>
            <Layer
              id="fir-fill"
              type="fill"
              paint={{
                'fill-color': '#22d3ee',
                'fill-opacity': ['case', ['==', ['get', 'online'], 1], 0.07, 0],
              }}
            />
            <Layer
              id="fir-outline"
              type="line"
              paint={{
                'line-color': ['case', ['==', ['get', 'online'], 1], '#22d3ee', '#198292'],
                'line-width': ['case', ['==', ['get', 'online'], 1], 1, 0.4],
                'line-opacity': ['case', ['==', ['get', 'online'], 1], 0.7, 0.25],
              }}
            />
          </Source>
        )}

        {/* ── FIR labels (zoom 4+, enriched when ATC online) ───── */}
        {firLabelGeoJson && (
          <Source id="fir-labels" type="geojson" data={firLabelGeoJson}>
            <Layer
              id="fir-label-text"
              type="symbol"
              minzoom={4}
              layout={{
                'text-field': ['case', ['==', ['get', 'online'], 1], ['get', 'label'], ['get', 'id']],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 7, 11],
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-padding': 4,
              }}
              paint={{
                'text-color': ['case', ['==', ['get', 'online'], 1], '#22d3ee', '#198292'],
                'text-opacity': ['interpolate', ['linear'], ['zoom'],
                  4, ['case', ['==', ['get', 'online'], 1], 0.9, 0.35],
                  6, ['case', ['==', ['get', 'online'], 1], 0.9, 0.55],
                ],
                'text-halo-color': '#030726',
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}

        {/* ── TRACON boundaries (purple, online only) ─────────── */}
        {traconGeoJson && (
          <Source id="tracon-boundaries" type="geojson" data={traconGeoJson}>
            <Layer
              id="tracon-fill"
              type="fill"
              paint={{
                'fill-color': '#a855f7',
                'fill-opacity': ['case', ['==', ['get', 'online'], 1], 0.08, 0],
              }}
            />
            <Layer
              id="tracon-outline"
              type="line"
              paint={{
                'line-color': '#a855f7',
                'line-width': ['case', ['==', ['get', 'online'], 1], 1, 0],
                'line-opacity': ['case', ['==', ['get', 'online'], 1], 0.6, 0],
              }}
            />
          </Source>
        )}

        {/* ── TRACON labels (zoom 6+, online = callsign + freq) ── */}
        {traconLabelGeoJson && (
          <Source id="tracon-labels" type="geojson" data={traconLabelGeoJson}>
            <Layer
              id="tracon-label-text"
              type="symbol"
              minzoom={6}
              filter={['==', ['get', 'online'], 1]}
              layout={{
                'text-field': ['get', 'label'],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 10, 11],
                'text-allow-overlap': false,
                'text-ignore-placement': false,
                'text-padding': 4,
              }}
              paint={{
                'text-color': '#a855f7',
                'text-opacity': 0.9,
                'text-halo-color': '#030726',
                'text-halo-width': 1.5,
              }}
            />
          </Source>
        )}

        {/* ── Local ATC badges: facility letters above airport icon ── */}
        {snappedLocalAtcAirports.map((apt) => (
          <Marker key={`atc-${apt.icao}`} longitude={apt.lng} latitude={apt.lat} anchor="bottom" offset={[0, -14]} style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              className="atc-badge-group"
              onMouseEnter={() => { badgeHoverRef.current = true; setHoveredAirspace(null); setHoveredBadge(apt); }}
              onMouseLeave={() => { badgeHoverRef.current = false; setHoveredBadge(null); setHoveredAirspace(null); }}
              style={{
                display: 'flex',
                gap: 2,
                cursor: 'default',
              }}
            >
              {apt.facilities.map((f) => (
                <span
                  key={f.letter}
                  className="atc-badge-letter"
                  style={{
                    fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                    fontSize: 9,
                    fontWeight: 700,
                    color: f.color,
                    background: 'rgba(3,7,38,0.85)',
                    borderRadius: 2,
                    padding: '2px 4px',
                    lineHeight: 1,
                  }}
                >
                  {f.letter}
                </span>
              ))}
            </div>
          </Marker>
        ))}

        {/* ── Airport icons (zoom-filtered by size) ──────────── */}
        {airportGeoJson && airportIconsReady && (
          <Source id="airports" type="geojson" data={airportGeoJson}>
            {/* Controlled airport glow ring */}
            <Layer
              id="airport-ctrl-glow"
              type="circle"
              filter={['==', ['get', 'controlled'], 1]}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 8, 8, 12, 12],
                'circle-color': '#34d399',
                'circle-opacity': 0.15,
                'circle-opacity-transition': { duration: 1000 },
              }}
            />
            {/* Major airports (uncontrolled) — blue, visible from zoom 4 */}
            <Layer
              id="airport-major-icon"
              type="symbol"
              filter={['all', ['==', ['get', 'airportType'], 'large_airport'], ['!=', ['get', 'controlled'], 1]]}
              minzoom={4}
              layout={{
                'icon-image': APT_ICON_MAJOR,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 8, 0.7, 12, 1],
                'icon-allow-overlap': true,
                'text-field': ['step', ['zoom'], '', 5, ['get', 'ident']],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 10, 10],
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                'text-optional': true,
              }}
              paint={{
                'text-color': '#697785',
                'text-halo-color': '#0a0c14',
                'text-halo-width': 1,
              }}
            />
            {/* Major airports (controlled) — turquoise, always visible */}
            <Layer
              id="airport-major-icon-ctrl"
              type="symbol"
              filter={['all', ['==', ['get', 'airportType'], 'large_airport'], ['==', ['get', 'controlled'], 1]]}
              layout={{
                'icon-image': APT_ICON_MAJOR_GREEN,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.3, 4, 0.4, 8, 0.7, 12, 1],
                'icon-allow-overlap': true,
                'text-field': ['get', 'ident'],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 1, 8, 10, 10],
                'text-offset': [0, 1.6],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                'text-optional': true,
              }}
              paint={{
                'text-color': '#34d399',
                'text-halo-color': '#0a0c14',
                'text-halo-width': 1,
              }}
            />

            {/* Medium airports (uncontrolled) — blue, visible from zoom 7 */}
            <Layer
              id="airport-medium-icon"
              type="symbol"
              filter={['all', ['==', ['get', 'airportType'], 'medium_airport'], ['!=', ['get', 'controlled'], 1]]}
              minzoom={7}
              layout={{
                'icon-image': APT_ICON_MEDIUM,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.35, 10, 0.6, 14, 0.9],
                'icon-allow-overlap': true,
                'text-field': ['step', ['zoom'], '', 8, ['get', 'ident']],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 8, 7, 12, 9],
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                'text-optional': true,
              }}
              paint={{
                'text-color': '#505560',
                'text-halo-color': '#0a0c14',
                'text-halo-width': 1,
              }}
            />
            {/* Medium airports (controlled) — turquoise, always visible */}
            <Layer
              id="airport-medium-icon-ctrl"
              type="symbol"
              filter={['all', ['==', ['get', 'airportType'], 'medium_airport'], ['==', ['get', 'controlled'], 1]]}
              layout={{
                'icon-image': APT_ICON_MEDIUM_GREEN,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.25, 7, 0.35, 10, 0.6, 14, 0.9],
                'icon-allow-overlap': true,
                'text-field': ['get', 'ident'],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 1, 7, 12, 9],
                'text-offset': [0, 1.6],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                'text-optional': true,
              }}
              paint={{
                'text-color': '#34d399',
                'text-halo-color': '#0a0c14',
                'text-halo-width': 1,
              }}
            />

            {/* Small airports (uncontrolled) — blue, visible from zoom 10 */}
            <Layer
              id="airport-small-icon"
              type="symbol"
              filter={['all', ['==', ['get', 'airportType'], 'small_airport'], ['!=', ['get', 'controlled'], 1]]}
              minzoom={10}
              layout={{
                'icon-image': APT_ICON_SMALL,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 0.7],
                'icon-allow-overlap': true,
                'text-field': ['step', ['zoom'], '', 11, ['get', 'ident']],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 11, 6, 14, 8],
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                'text-optional': true,
              }}
              paint={{
                'text-color': '#3a3e48',
                'text-halo-color': '#0a0c14',
                'text-halo-width': 1,
              }}
            />
            {/* Small airports (controlled) — turquoise, always visible */}
            <Layer
              id="airport-small-icon-ctrl"
              type="symbol"
              filter={['all', ['==', ['get', 'airportType'], 'small_airport'], ['==', ['get', 'controlled'], 1]]}
              layout={{
                'icon-image': APT_ICON_SMALL_GREEN,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.2, 10, 0.3, 14, 0.7],
                'icon-allow-overlap': true,
                'text-field': ['get', 'ident'],
                'text-font': ['Noto Sans Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 1, 6, 14, 8],
                'text-offset': [0, 1.6],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                'text-optional': true,
              }}
              paint={{
                'text-color': '#34d399',
                'text-halo-color': '#0a0c14',
                'text-halo-width': 1,
              }}
            />
          </Source>
        )}

        {/* ── Runway markings (zoom 13+) ─────────────────────── */}
        {runwayGeoJson.features.length > 0 && (
          <Source id="runway-markings" type="geojson" data={runwayGeoJson}>
            {/* Runway surface rectangle */}
            <Layer
              id="rwy-surface"
              type="fill"
              filter={['==', ['get', 'layer'], 'surface']}
              minzoom={13}
              paint={{
                'fill-color': '#2a2a30',
                'fill-opacity': 1,
              }}
            />
            {/* Edge lines — solid white along both runway edges */}
            <Layer
              id="rwy-edge"
              type="line"
              filter={['==', ['get', 'layer'], 'edge']}
              minzoom={13}
              paint={{
                'line-color': '#ffffff',
                'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 15, 1, 16, 1.5],
                'line-opacity': 0.7,
              }}
            />
            {/* Centerline dashes */}
            <Layer
              id="rwy-centerline"
              type="line"
              filter={['==', ['get', 'layer'], 'centerline']}
              minzoom={13}
              paint={{
                'line-color': '#ffffff',
                'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 15, 1.5, 16, 2.5],
                'line-dasharray': [8, 6],
                'line-opacity': 0.8,
              }}
            />
            {/* Threshold stripes — white bars at each end */}
            <Layer
              id="rwy-threshold-stripe"
              type="fill"
              filter={['==', ['get', 'layer'], 'threshold-stripe']}
              minzoom={13}
              paint={{
                'fill-color': '#ffffff',
                'fill-opacity': 0.85,
              }}
            />
            {/* Touchdown zone bars */}
            <Layer
              id="rwy-tdz"
              type="fill"
              filter={['==', ['get', 'layer'], 'tdz']}
              minzoom={14}
              paint={{
                'fill-color': '#ffffff',
                'fill-opacity': 0.7,
              }}
            />
            {/* Aiming point marks — thick bars */}
            <Layer
              id="rwy-aiming"
              type="fill"
              filter={['==', ['get', 'layer'], 'aiming']}
              minzoom={14}
              paint={{
                'fill-color': '#ffffff',
                'fill-opacity': 0.8,
              }}
            />
            {/* Runway number labels */}
            <Layer
              id="rwy-numbers"
              type="symbol"
              filter={['==', ['get', 'layer'], 'label']}
              minzoom={14}
              layout={{
                'text-field': ['get', 'ident'],
                'text-font': ['Noto Sans Bold'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 18],
                'text-rotate': ['get', 'rotation'],
                'text-rotation-alignment': 'map',
                'text-allow-overlap': true,
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': '#2a2a30',
                'text-halo-width': 1,
                'text-opacity': 0.9,
              }}
            />
          </Source>
        )}

        {/* ── Unselected route lines (dashed) ──────────────── */}
        <Source id="unselected-routes" type="geojson" data={unselectedRoutesGeoJSON}>
          <Layer
            id="unselected-route-lines"
            type="line"
            paint={{
              'line-color': 'rgba(99,132,230,0.12)',
              'line-width': 1,
              'line-dasharray': [4, 4],
            }}
            layout={{
              'line-cap': 'round',
            }}
          />
        </Source>

        {/* ── Unselected route airport endpoint markers ────── */}
        {routeEndpoints.map((ep, i) => (
          <Marker key={`route-ep-${i}`} longitude={ep.lon} latitude={ep.lat} anchor="center">
            <svg width="16" height="16" viewBox="-6 -6 12 12">
              <path
                d={airportPath(2.5)}
                fill="none"
                stroke="rgba(99,132,230,0.6)"
                strokeWidth={0.8}
                strokeLinejoin="round"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                top: -14,
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                fontSize: 9,
                fill: 'rgba(99,132,230,0.7)',
                color: 'rgba(99,132,230,0.7)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {ep.icao}
            </div>
          </Marker>
        ))}

        {/* ── Selected route segments (phase-colored) ──────── */}
        <Source id="selected-route" type="geojson" data={selectedRouteSegments}>
          <Layer
            id="selected-route-line"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 2,
            }}
            layout={{
              'line-cap': 'round',
            }}
          />
        </Source>

        {/* ── Waypoint markers ─────────────────────────────── */}
        {waypointData.map((wp, j) => {
          const ft = wp.fixType;
          const isApt = ft === 'apt';
          const isTocTod = ft === 'toc' || ft === 'tod';
          const isVor = ft === 'vor';

          return (
            <Marker key={`wp-${j}`} longitude={wp.lon} latitude={wp.lat} anchor="center">
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                    fontSize: 9,
                    color: wp.color,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    marginBottom: 2,
                    pointerEvents: 'none',
                  }}
                >
                  {wp.ident ?? ft?.toUpperCase() ?? ''}
                </div>
                <svg width="14" height="14" viewBox="-7 -7 14 14">
                  {isApt ? (
                    <path
                      d={airportPath(3)}
                      fill="none"
                      stroke={wp.color}
                      strokeWidth={1}
                      strokeLinejoin="round"
                    />
                  ) : isTocTod ? (
                    <polygon
                      points="0,-3 3,0 0,3 -3,0"
                      fill={wp.color}
                      stroke="#000"
                      strokeWidth={0.3}
                    />
                  ) : isVor ? (
                    <polygon
                      points={hexPoints(2.5)}
                      fill={wp.color}
                      stroke="#000"
                      strokeWidth={0.3}
                    />
                  ) : (
                    <polygon
                      points="0,-2.5 2.5,0 0,2.5 -2.5,0"
                      fill="none"
                      stroke={wp.color}
                      strokeWidth={0.5}
                    />
                  )}
                </svg>
              </div>
            </Marker>
          );
        })}

        {/* ── Actual flown track — solid emerald ───────────── */}
        <Source id="flown-track" type="geojson" data={trackGeoJSON}>
          <Layer
            id="flown-track-line"
            type="line"
            paint={{
              'line-color': '#4ade80',
              'line-width': 2,
            }}
            layout={{
              'line-cap': 'round',
            }}
          />
        </Source>

        {/* ── Historical route — cyan line ─────────────────── */}
        <Source id="historical-route" type="geojson" data={historicalGeoJSON}>
          <Layer
            id="historical-route-line"
            type="line"
            paint={{
              'line-color': '#22d3ee',
              'line-width': 1.5,
            }}
            layout={{
              'line-cap': 'round',
            }}
          />
        </Source>

        {/* ── Historical route dep/arr markers ─────────────── */}
        {historicalRoute && !selectedFlight && (
          <>
            <Marker longitude={historicalRoute.depLon} latitude={historicalRoute.depLat} anchor="center">
              <svg width="12" height="12" viewBox="-6 -6 12 12">
                <circle r={3} fill="none" stroke="#4ade80" strokeWidth={0.8} />
                <circle r={1.2} fill="#4ade80" />
              </svg>
            </Marker>
            <Marker longitude={historicalRoute.arrLon} latitude={historicalRoute.arrLat} anchor="center">
              <svg width="12" height="12" viewBox="-6 -6 12 12">
                <circle r={3} fill="none" stroke="#ef4444" strokeWidth={0.8} />
                <circle r={1.2} fill="#ef4444" />
              </svg>
            </Marker>
          </>
        )}

        {/* ── Aircraft markers + callsign labels ───────────── */}
        {visibleAircraft.map(({ flight: f, lat, lon, index: i }) => {
          const isSelected = i === selectedIdx;
          const markerColor = getMarkerColor(f, mode);

          return (
            <Marker
              key={`ac-${i}`}
              longitude={lon}
              latitude={lat}
              anchor="center"
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(isSelected ? null : i);
                  if (mode === 'dispatch') {
                    onFlightClick?.(f, e);
                  }
                }}
              >
                {/* Callsign label */}
                <div
                  style={{
                    fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                    fontSize: 10,
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#ffffff' : `${markerColor}b3`,
                    whiteSpace: 'nowrap',
                    marginBottom: 2,
                    fontFeatureSettings: '"tnum"',
                    pointerEvents: 'none',
                  }}
                >
                  {f.callsign}
                </div>
                {/* Aircraft icon */}
                <img
                  src={buildUri(f.aircraftType, isSelected ? '#ffffff' : markerColor, isSelected ? '_sel' : '')}
                  width={24}
                  height={24}
                  style={{
                    transform: `rotate(${f.heading}deg)`,
                  }}
                  alt=""
                  draggable={false}
                />
              </div>
            </Marker>
          );
        })}
        {/* ── VATSIM ATC hover popup (FIR + TRACON) ──────────── */}
        {hoveredAirspace && (
          <Popup
            longitude={hoveredAirspace.lng}
            latitude={hoveredAirspace.lat}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={8}
            className="fir-popup"
          >
            <div style={{
              background: '#0d1028',
              border: `1px solid ${hoveredAirspace.type === 'fir' ? 'rgba(34,211,238,0.3)' : 'rgba(168,85,247,0.3)'}`,
              borderRadius: 6,
              padding: '8px 10px',
              minWidth: 160,
            }}>
              <div style={{
                fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                fontSize: 11,
                fontWeight: 600,
                color: hoveredAirspace.type === 'fir' ? '#22d3ee' : '#a855f7',
                marginBottom: 6,
              }}>
                {hoveredAirspace.id} {hoveredAirspace.type === 'fir' ? 'FIR' : 'APP'}
              </div>
              {hoveredAirspace.controllers.map((c) => {
                const logonMs = Date.now() - new Date(c.logon_time).getTime();
                const hrs = Math.floor(logonMs / 3600000);
                const mins = Math.floor((logonMs % 3600000) / 60000);
                return (
                  <div key={c.callsign} style={{ marginBottom: 4 }}>
                    <div style={{
                      fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.85)',
                    }}>
                      {c.callsign} · {c.frequency}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>
                      {c.name} · online {hrs}h{String(mins).padStart(2, '0')}m
                    </div>
                    {c.text_atis && c.text_atis.length > 0 && (() => {
                      const atisText = c.text_atis.join(' ');
                      return (
                        <div style={{
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.35)',
                          marginTop: 2,
                          lineHeight: 1.3,
                          maxHeight: 40,
                          overflow: 'hidden',
                        }}>
                          {atisText.slice(0, 120)}{atisText.length > 120 ? '…' : ''}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </Popup>
        )}

        {/* ── Local ATC badge hover popup (TWR/GND/DEL/ATIS) ── */}
        {hoveredBadge && (
          <Popup
            longitude={hoveredBadge.lng}
            latitude={hoveredBadge.lat}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={30}
            className="fir-popup"
          >
            <div style={{
              background: '#0d1028',
              border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: 6,
              padding: '8px 10px',
              minWidth: 140,
            }}>
              <div style={{
                fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                fontSize: 11,
                fontWeight: 600,
                color: '#34d399',
                marginBottom: 6,
              }}>
                {hoveredBadge.icao}
              </div>
              {hoveredBadge.facilities.map((f) => {
                const logonMs = Date.now() - new Date(f.logon_time).getTime();
                const hrs = Math.floor(logonMs / 3600000);
                const mins = Math.floor((logonMs % 3600000) / 60000);
                return (
                  <div key={f.callsign} style={{ marginBottom: 4 }}>
                    <div style={{
                      fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
                      fontSize: 10,
                      color: f.color,
                    }}>
                      {f.callsign} · {f.frequency}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>
                      {f.name} · online {hrs}h{String(mins).padStart(2, '0')}m
                    </div>
                  </div>
                );
              })}
            </div>
          </Popup>
        )}
      </Map>

      {/* ── VATSIM status badge (bottom-left) ────────────── */}
      {vatsimControllers.length > 0 && (
        <div
          className="vatsim-status-badge"
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(3,7,38,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 4,
            padding: '4px 8px',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 4px #34d399',
          }} />
          <span style={{
            fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
          }}>
            {vatsimControllers.length} ATC
          </span>
          {vatsimUpdatedAt && (
            <span style={{
              fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace',
              fontSize: 9,
              color: 'rgba(255,255,255,0.35)',
            }}>
              · {Math.round((Date.now() - vatsimUpdatedAt) / 1000)}s ago
            </span>
          )}
        </div>
      )}

      {/* ── Flight detail panel (reference-style sidebar) ── */}
      {mode !== 'dispatch' && selectedFlight && (
        <div
          className="absolute flex flex-col gap-3 overflow-y-auto"
          style={{
            top: 0, right: 0, bottom: 0,
            width: 220,
            background: 'rgba(8,10,18,0.92)',
            borderLeft: '1px solid var(--border-primary)',
            padding: '12px 14px',
            zIndex: 10,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[16px] font-bold text-[var(--accent-emerald)]">
              {selectedFlight.callsign}
            </span>
            <button
              onClick={() => handleSelect(null)}
              className="text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] text-[16px] leading-none px-1"
            >
              ×
            </button>
          </div>

          {/* Route */}
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--divider)]">
            <div className="text-center">
              <div className="font-mono text-[13px] font-bold text-[var(--accent-emerald)]">
                {selectedFlight.depIcao || '----'}
              </div>
              <div className="text-[8px] text-[var(--text-quaternary)]">DEP</div>
            </div>
            <div className="flex-1 flex items-center">
              <div className="flex-1 h-px bg-[var(--divider)]" />
              <span className="px-1.5 text-[9px] text-[var(--text-quaternary)]">→</span>
              <div className="flex-1 h-px bg-[var(--divider)]" />
            </div>
            <div className="text-center">
              <div className="font-mono text-[13px] font-bold text-[var(--accent-red)]">
                {selectedFlight.arrIcao || '----'}
              </div>
              <div className="text-[8px] text-[var(--text-quaternary)]">ARR</div>
            </div>
          </div>

          {/* Flight Details */}
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-quaternary)] mb-1.5">
              Flight Details
            </div>
            <div className="grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: 'auto 1fr' }}>
              <span className="text-[10px] text-[var(--text-quaternary)]">Callsign</span>
              <span className="font-mono text-[11px] text-[var(--text-primary)]">{selectedFlight.callsign}</span>

              <span className="text-[10px] text-[var(--text-quaternary)]">Aircraft</span>
              <span className="font-mono text-[11px] text-[var(--text-primary)]">{selectedFlight.aircraftType || '----'}</span>

              <span className="text-[10px] text-[var(--text-quaternary)]">Flight No.</span>
              <span className="font-mono text-[11px] text-[var(--text-primary)]">{selectedFlight.flightNumber || '----'}</span>
            </div>
          </div>

          {/* Telemetry */}
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-quaternary)] mb-1.5">
              Live Telemetry
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[8px] text-[var(--text-quaternary)]">Altitude</div>
                <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                  FL{String(Math.round(selectedFlight.altitude ?? 0) / 100 | 0).padStart(3, '0')}
                </div>
              </div>
              <div>
                <div className="text-[8px] text-[var(--text-quaternary)]">Ground Speed</div>
                <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {Math.round(selectedFlight.groundSpeed ?? 0)}kt
                </div>
              </div>
              <div>
                <div className="text-[8px] text-[var(--text-quaternary)]">Heading</div>
                <div className="font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {String(Math.round(selectedFlight.heading)).padStart(3, '0')}°
                </div>
              </div>
              <div>
                <div className="text-[8px] text-[var(--text-quaternary)]">Position</div>
                <div className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                  {selectedFlight.latitude.toFixed(2)}°
                  <br />
                  {selectedFlight.longitude.toFixed(2)}°
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Historical route panel ─────────────────────── */}
      {mode !== 'dispatch' && historicalRoute && !selectedFlight && (
        <div
          className="absolute flex flex-col gap-2"
          style={{
            top: 0, right: 0,
            width: 200,
            background: 'rgba(8,10,18,0.92)',
            borderLeft: '1px solid var(--border-primary)',
            padding: '12px 14px',
            zIndex: 10,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[14px] font-bold text-[var(--text-primary)]">
              {historicalRoute.callsign}
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--accent-cyan)]">
              Completed
            </span>
          </div>
          <div className="text-[10px] text-[var(--text-quaternary)]">
            Historical flight trace
          </div>
        </div>
      )}
    </div>
  );
});

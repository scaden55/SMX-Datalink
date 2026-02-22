import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../lib/api';
import type { VatsimControllerWithPosition, VatsimAtis, VatsimFacilityType } from '@acars/shared';

// ── Types ───────────────────────────────────────────────────

interface MapAirport {
  ident: string;
  type: string;
  latitude_deg: number;
  longitude_deg: number;
}

interface Props {
  controllers: VatsimControllerWithPosition[];
  atis: VatsimAtis[];
  visible: boolean;
  onSelectAirport: (icao: string) => void;
}

// ── Badge config (facility type → letter + color) ───────────

interface BadgeInfo {
  letter: string;
  color: string;
}

const FACILITY_BADGES: Partial<Record<VatsimFacilityType, BadgeInfo>> = {
  2: { letter: 'D', color: '#60a5fa' }, // Delivery — blue
  3: { letter: 'G', color: '#22c55e' }, // Ground — green
  4: { letter: 'T', color: '#ef4444' }, // Tower — red
  5: { letter: 'A', color: '#f59e0b' }, // Approach — amber
};

const ATIS_BADGE: BadgeInfo = { letter: 'A', color: '#d29922' }; // ATIS — yellow-gold

// ── DivIcon cache ───────────────────────────────────────────

const iconCache = new Map<string, L.DivIcon>();

function getIcon(icao: string, badges: BadgeInfo[]): L.DivIcon {
  const key = badges.length > 0
    ? `${icao}-${badges.map((b) => b.letter).join('')}`
    : icao;

  let icon = iconCache.get(key);
  if (icon) return icon;

  const hasBadges = badges.length > 0;

  const badgeHtml = badges.map(
    (b) =>
      `<span style="background:${b.color};color:#fff;font:bold 7px sans-serif;padding:0 2px;border-radius:1px;line-height:10px;">${b.letter}</span>`,
  ).join('');

  const dot = `<div style="width:5px;height:5px;border-radius:50%;background:${hasBadges ? '#58a6ff' : '#4a5568'};margin-bottom:1px;"></div>`;

  const html = hasBadges
    ? `<div style="display:flex;flex-direction:column;align-items:flex-start;pointer-events:auto;cursor:pointer;">
        <div style="white-space:nowrap;display:flex;align-items:center;gap:2px;">
          <span style="font:bold 10px Inter,system-ui,sans-serif;color:#e6e9ee;text-shadow:0 1px 3px rgba(0,0,0,0.8);font-feature-settings:'tnum';">${icao}</span>
          ${badgeHtml}
        </div>
        ${dot}
      </div>`
    : `<div style="display:flex;flex-direction:column;align-items:flex-start;pointer-events:auto;cursor:pointer;">
        <span style="font:10px Inter,system-ui,sans-serif;color:#6e7681;text-shadow:0 1px 3px rgba(0,0,0,0.8);font-feature-settings:'tnum';">${icao}</span>
        ${dot}
      </div>`;

  icon = L.divIcon({
    html,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [2, 18], // anchor at the dot (bottom of label + dot column)
  });

  iconCache.set(key, icon);
  return icon;
}

// ── Component ───────────────────────────────────────────────

export function AirportLabels({ controllers, atis, visible, onSelectAirport }: Props) {
  const [airports, setAirports] = useState<MapAirport[]>([]);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [zoom, setZoom] = useState(4);
  const fetchedRef = useRef(false);

  // Fetch map airports once on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    api.get<MapAirport[]>('/api/airports/map')
      .then(setAirports)
      .catch(() => {}); // silent — labels are supplementary
  }, []);

  // Track viewport bounds + zoom
  const updateView = useCallback((map: L.Map) => {
    setBounds(map.getBounds());
    setZoom(map.getZoom());
  }, []);

  const map = useMapEvents({
    moveend: () => updateView(map),
    zoomend: () => updateView(map),
    load: () => updateView(map),
  });

  // Initialize bounds on first render
  if (!bounds) {
    setTimeout(() => updateView(map), 0);
  }

  // Build controller → ICAO lookup: Map<icao, Set<facilityType>>
  const atcByIcao = useMemo(() => {
    const lookup = new Map<string, Set<VatsimFacilityType>>();

    for (const ctrl of controllers) {
      const icao = ctrl.parsed.prefix;
      if (!icao) continue;
      // Only include facility types that have badges (2-5)
      if (!FACILITY_BADGES[ctrl.facility]) continue;

      if (!lookup.has(icao)) lookup.set(icao, new Set());
      lookup.get(icao)!.add(ctrl.facility);
    }

    // Add ATIS — callsign is like "KJFK_ATIS"
    for (const a of atis) {
      const icao = a.callsign.split('_')[0];
      if (!icao) continue;
      // Mark with facility type 0 as a sentinel for ATIS
      if (!lookup.has(icao)) lookup.set(icao, new Set());
      // Use 0 as ATIS indicator (we handle it specially below)
      lookup.get(icao)!.add(0 as VatsimFacilityType);
    }

    return lookup;
  }, [controllers, atis]);

  // Set of ICAOs with active ATC (for zoom-based filtering)
  const atcIcaos = useMemo(() => new Set(atcByIcao.keys()), [atcByIcao]);

  // Filter airports to visible viewport + zoom-based LOD
  const visibleAirports = useMemo(() => {
    if (!bounds || airports.length === 0) return [];

    return airports.filter((apt) => {
      // Must be within viewport
      if (!bounds.contains([apt.latitude_deg, apt.longitude_deg])) return false;

      const hasAtc = atcIcaos.has(apt.ident);
      const isLarge = apt.type === 'large_airport';

      // Zoom-based LOD — sparser at low zoom, denser as you zoom in
      if (zoom < 3) {
        // Continent view: only airports with active ATC
        return hasAtc;
      } else if (zoom < 5) {
        // Wide regional: large airports + ATC airports only
        return isLarge || hasAtc;
      } else if (zoom < 8) {
        // Regional/state: large + ATC only (medium airports are too dense)
        return isLarge || hasAtc;
      }
      // zoom >= 8: show all large + medium in viewport
      return true;
    });
  }, [airports, bounds, zoom, atcIcaos]);

  // Build badges for each airport
  const getBadges = useCallback(
    (icao: string): BadgeInfo[] => {
      const facilities = atcByIcao.get(icao);
      if (!facilities) return [];

      const badges: BadgeInfo[] = [];
      // Ordered: Tower, Ground, Approach, Delivery, ATIS
      if (facilities.has(4)) badges.push(FACILITY_BADGES[4]!);
      if (facilities.has(3)) badges.push(FACILITY_BADGES[3]!);
      if (facilities.has(5)) badges.push(FACILITY_BADGES[5]!);
      if (facilities.has(2)) badges.push(FACILITY_BADGES[2]!);
      if (facilities.has(0 as VatsimFacilityType)) badges.push(ATIS_BADGE); // ATIS sentinel

      return badges;
    },
    [atcByIcao],
  );

  if (!visible) return null;

  return (
    <>
      {visibleAirports.map((apt) => (
        <Marker
          key={apt.ident}
          position={[apt.latitude_deg, apt.longitude_deg]}
          icon={getIcon(apt.ident, getBadges(apt.ident))}
          eventHandlers={{
            click: () => onSelectAirport(apt.ident),
          }}
        />
      ))}
    </>
  );
}

import { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';
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
    ? `${icao}-${badges.map((b) => b.letter + b.color).join('')}`
    : icao;

  let icon = iconCache.get(key);
  if (icon) return icon;

  const hasBadges = badges.length > 0;

  const badgeHtml = badges.map(
    (b) =>
      `<span class="airport-facility-badge" style="background:${b.color};">${b.letter}</span>`,
  ).join('');

  const dot = `<div class="airport-label-dot" style="background:${hasBadges ? '#58a6ff' : '#4a5568'};"></div>`;

  const html = hasBadges
    ? `<div class="airport-label airport-label--active">
        <div class="airport-label-row">
          <span class="airport-label-icao airport-label-icao--active">${icao}</span>
          ${badgeHtml}
        </div>
        ${dot}
      </div>`
    : `<div class="airport-label">
        <span class="airport-label-icao">${icao}</span>
        ${dot}
      </div>`;

  icon = L.divIcon({
    html,
    className: 'airport-label-wrapper',
    iconSize: [0, 0],
    iconAnchor: [2, 22],
  });

  iconCache.set(key, icon);
  return icon;
}

// ── Prefix normalization ────────────────────────────────────

/** Add a facility to the lookup under a prefix + its US K-prefix variant */
function addToLookup(
  lookup: Map<string, Set<VatsimFacilityType>>,
  prefix: string,
  facility: VatsimFacilityType,
): void {
  if (!lookup.has(prefix)) lookup.set(prefix, new Set());
  lookup.get(prefix)!.add(facility);

  // Cross-map US variants: BOS ↔ KBOS
  if (prefix.length <= 3 && /^[A-Z]{2,3}$/.test(prefix)) {
    const kPrefixed = 'K' + prefix;
    if (!lookup.has(kPrefixed)) lookup.set(kPrefixed, new Set());
    lookup.get(kPrefixed)!.add(facility);
  } else if (prefix.length === 4 && prefix.startsWith('K')) {
    const stripped = prefix.slice(1);
    if (!lookup.has(stripped)) lookup.set(stripped, new Set());
    lookup.get(stripped)!.add(facility);
  }
}

// ── Component ───────────────────────────────────────────────

export const AirportLabels = memo(function AirportLabels({ controllers, atis, visible, onSelectAirport }: Props) {
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

  // Build controller → ICAO lookup (with US prefix cross-mapping)
  const atcByIcao = useMemo(() => {
    const lookup = new Map<string, Set<VatsimFacilityType>>();

    for (const ctrl of controllers) {
      const prefix = ctrl.parsed.prefix;
      if (!prefix) continue;
      if (!FACILITY_BADGES[ctrl.facility]) continue;
      addToLookup(lookup, prefix, ctrl.facility);
    }

    // Add ATIS — callsign is like "KJFK_ATIS" or "KJFK_D_ATIS"
    for (const a of atis) {
      const prefix = a.callsign.split('_')[0];
      if (!prefix) continue;
      addToLookup(lookup, prefix, 0 as VatsimFacilityType);
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
});

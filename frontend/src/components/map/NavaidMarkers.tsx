import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Marker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../lib/api';
import type { NavaidMapItem } from '@acars/shared';

// ── SVG icon templates (ForeFlight style) ───────────────────

// VOR: Cyan hexagon (stroke only) with center dot
const VOR_SVG = `<svg viewBox="0 0 16 16" width="16" height="16">
  <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" fill="none" stroke="#00d4ff" stroke-width="2"/>
  <circle cx="8" cy="8" r="2" fill="#00d4ff"/>
</svg>`;

// NDB: Orange circle (stroke only)
const NDB_SVG = `<svg viewBox="0 0 12 12" width="12" height="12">
  <circle cx="6" cy="6" r="4.5" fill="none" stroke="#d29922" stroke-width="2"/>
</svg>`;

// DME: Gray square (stroke only)
const DME_SVG = `<svg viewBox="0 0 12 12" width="12" height="12">
  <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="#8e939b" stroke-width="1.5"/>
</svg>`;

// TACAN: Cyan diamond (stroke only)
const TACAN_SVG = `<svg viewBox="0 0 14 14" width="14" height="14">
  <polygon points="7,1 13,7 7,13 1,7" fill="none" stroke="#a5d6ff" stroke-width="1.5"/>
</svg>`;

// Fix: Cyan filled triangle
const FIX_SVG = `<svg viewBox="0 0 10 10" width="10" height="10">
  <polygon points="5,1 9,9 1,9" fill="#00d4ff"/>
</svg>`;

// ── Icon cache ──────────────────────────────────────────────

const iconCache = new Map<string, L.DivIcon>();

function getNavaidIcon(type: string): L.DivIcon {
  let icon = iconCache.get(type);
  if (icon) return icon;

  let svg: string;
  let size: [number, number];
  switch (type) {
    case 'VOR':
    case 'VOR-DME':
    case 'VORTAC':
      svg = VOR_SVG;
      size = [16, 16];
      break;
    case 'NDB':
    case 'NDB-DME':
      svg = NDB_SVG;
      size = [12, 12];
      break;
    case 'DME':
    case 'DME_STANDALONE':
      svg = DME_SVG;
      size = [12, 12];
      break;
    case 'TACAN':
      svg = TACAN_SVG;
      size = [14, 14];
      break;
    case 'fix':
      svg = FIX_SVG;
      size = [10, 10];
      break;
    default:
      svg = DME_SVG;
      size = [12, 12];
      break;
  }

  icon = L.divIcon({
    html: svg,
    className: '',
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
  });
  iconCache.set(type, icon);
  return icon;
}

// ── Component ───────────────────────────────────────────────

export function NavaidMarkers() {
  const [navaids, setNavaids] = useState<NavaidMapItem[]>([]);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [zoom, setZoom] = useState(4);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  const updateView = useCallback((map: L.Map) => {
    setBounds(map.getBounds());
    setZoom(map.getZoom());
  }, []);

  const map = useMapEvents({
    moveend: () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => updateView(map), 200);
    },
    zoomend: () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => updateView(map), 200);
    },
  });

  // Initialize bounds after map ready
  useEffect(() => {
    const timer = setTimeout(() => updateView(map), 100);
    return () => clearTimeout(timer);
  }, [map, updateView]);

  // Fetch navaids when viewport changes
  useEffect(() => {
    if (!bounds) return;

    // Don't fetch at very low zoom (too many navaids, not useful)
    if (zoom < 4) {
      setNavaids([]);
      return;
    }

    // Abort previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const boundsParam = `${ne.lat},${sw.lng},${sw.lat},${ne.lng}`;

    api.get<NavaidMapItem[]>(
      `/api/navdata/navaids?bounds=${boundsParam}&zoom=${Math.round(zoom)}`
    ).then((data) => {
      if (!controller.signal.aborted) {
        setNavaids(data);
      }
    }).catch(() => {
      // silent — navaids are supplementary
    });

    return () => controller.abort();
  }, [bounds, zoom]);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <>
      {navaids.map((n, i) => (
        <Marker
          key={`${n.ident}-${n.type}-${i}`}
          position={[n.lat, n.lon]}
          icon={getNavaidIcon(n.type)}
          interactive
        >
          <Tooltip
            direction="top"
            offset={[0, -8]}
            className="navaid-tooltip"
            opacity={0.95}
          >
            <span style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontFeatureSettings: '"tnum"',
              fontSize: '10px',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}>
              {n.ident}
              {n.frequency ? ` ${n.frequency.toFixed(n.type === 'NDB' ? 0 : 2)}` : ''}
              {` (${n.type})`}
            </span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

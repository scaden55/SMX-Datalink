import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Marker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../lib/api';
import type { NavaidMapItem } from '@acars/shared';

// ── SVG icon templates ──────────────────────────────────────

const VOR_SVG = `<svg viewBox="0 0 14 14" width="14" height="14">
  <polygon points="7,1 12.5,4.2 12.5,9.8 7,13 1.5,9.8 1.5,4.2" fill="var(--bg-panel)" stroke="#79c0ff" stroke-width="1.5"/>
</svg>`;

const NDB_SVG = `<svg viewBox="0 0 14 14" width="14" height="14">
  <circle cx="7" cy="7" r="5.5" fill="var(--bg-panel)" stroke="#d29922" stroke-width="1.5"/>
</svg>`;

const DME_SVG = `<svg viewBox="0 0 14 14" width="14" height="14">
  <rect x="2" y="2" width="10" height="10" fill="var(--bg-panel)" stroke="#8e939b" stroke-width="1.5"/>
</svg>`;

const TACAN_SVG = `<svg viewBox="0 0 14 14" width="14" height="14">
  <polygon points="7,1 13,7 7,13 1,7" fill="var(--bg-panel)" stroke="#a5d6ff" stroke-width="1.5"/>
</svg>`;

// ── Icon cache ──────────────────────────────────────────────

const iconCache = new Map<string, L.DivIcon>();

function getNavaidIcon(type: string): L.DivIcon {
  let icon = iconCache.get(type);
  if (icon) return icon;

  let svg: string;
  switch (type) {
    case 'VOR': svg = VOR_SVG; break;
    case 'NDB': svg = NDB_SVG; break;
    case 'DME':
    case 'DME_STANDALONE': svg = DME_SVG; break;
    case 'TACAN': svg = TACAN_SVG; break;
    default: svg = DME_SVG; break;
  }

  icon = L.divIcon({
    html: svg,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
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

import { useState, useMemo, useCallback, memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
  Line,
} from 'react-simple-maps';
import type { ActiveFlightHeartbeat, TrackPoint } from '@acars/shared';

/* ── Constants ──────────────────────────────────────────────── */

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const ACCENT = '#3950ed';
const SELECTED_COLOR = '#facc15';

const OCEAN_COLOR = '#05060d';
const LAND_COLOR = '#0d121f';
const LAND_STROKE = '#1b2336';
const LAND_HOVER = '#141c2e';

/* ── Aircraft SVG marker ────────────────────────────────────── */

const AircraftIcon = memo(function AircraftIcon({
  color,
  heading,
  size = 14,
}: {
  color: string;
  heading: number;
  size?: number;
}) {
  return (
    <g transform={`rotate(${heading})`} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}>
      <path
        d="M0 -10C0.6 -10 1 -9.2 1 -8.2L1 -1L10 3.5C10.8 3.9 10.8 4.8 10 5L1 4.2V11.8L4.5 14.5C5 15 4.9 15.6 4.5 15.8L1 14.8L0.2 16.8C0.1 17.2 -0.1 17.2 -0.2 16.8L-1 14.8L-4.5 15.8C-4.9 15.6 -5 15 -4.5 14.5L-1 11.8V4.2L-10 5C-10.8 4.8 -10.8 3.9 -10 3.5L-1 -1V-8.2C-1 -9.2 -0.6 -10 0 -10Z"
        fill={color}
        transform={`scale(${size / 14})`}
      />
    </g>
  );
});

/* ── Tooltip ────────────────────────────────────────────────── */

function MarkerTooltip({
  callsign,
  x,
  y,
}: {
  callsign: string;
  x: number;
  y: number;
}) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      <rect
        x={-callsign.length * 3.5 - 6}
        y={-28}
        width={callsign.length * 7 + 12}
        height={18}
        rx={3}
        fill={OCEAN_COLOR}
        stroke={LAND_STROKE}
        strokeWidth={0.5}
        opacity={0.95}
      />
      <text
        y={-16}
        textAnchor="middle"
        fill="#eceef5"
        fontSize={9}
        fontWeight={600}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {callsign}
      </text>
    </g>
  );
}

/* ── Geography layer (memoized) ─────────────────────────────── */

const GeoLayer = memo(function GeoLayer() {
  return (
    <Geographies geography={GEO_URL}>
      {({ geographies }) =>
        geographies.map((geo) => (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            fill={LAND_COLOR}
            stroke={LAND_STROKE}
            strokeWidth={0.4}
            style={{
              default: { outline: 'none' },
              hover: { fill: LAND_HOVER, outline: 'none' },
              pressed: { outline: 'none' },
            }}
          />
        ))
      }
    </Geographies>
  );
});

/* ── Trail path ─────────────────────────────────────────────── */

const TrailPath = memo(function TrailPath({ trail }: { trail: TrackPoint[] }) {
  const coords = useMemo(
    () => trail.map((p) => [p.lon, p.lat] as [number, number]),
    [trail],
  );

  if (coords.length < 2) return null;

  return (
    <Line
      coordinates={coords}
      stroke={ACCENT}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeDasharray="4 3"
      strokeOpacity={0.7}
      fill="none"
    />
  );
});

/* ── Main map component ─────────────────────────────────────── */

interface FlightMapProps {
  flights: ActiveFlightHeartbeat[];
  selectedCallsign: string | null;
  onSelectFlight: (flight: ActiveFlightHeartbeat) => void;
  trail: TrackPoint[];
}

export const FlightMap = memo(function FlightMap({
  flights,
  selectedCallsign,
  onSelectFlight,
  trail,
}: FlightMapProps) {
  const [hoveredCallsign, setHoveredCallsign] = useState<string | null>(null);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [-10, 30],
    zoom: 1.4,
  });

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    setPosition(pos);
  }, []);

  // Sort flights so selected is rendered last (on top)
  const sortedFlights = useMemo(() => {
    const valid = flights.filter((f) => f.latitude !== 0 || f.longitude !== 0);
    return valid.sort((a, b) => {
      if (a.callsign === selectedCallsign) return 1;
      if (b.callsign === selectedCallsign) return -1;
      return 0;
    });
  }, [flights, selectedCallsign]);

  // Scale marker size inversely with zoom for consistent visual size
  const markerScale = useMemo(() => Math.max(0.6, 1 / Math.sqrt(position.zoom)), [position.zoom]);

  return (
    <div className="h-full w-full" style={{ backgroundColor: OCEAN_COLOR }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140 }}
        width={800}
        height={500}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={1}
          maxZoom={16}
          onMoveEnd={handleMoveEnd}
        >
          {/* Geographies */}
          <GeoLayer />

          {/* Flight trail */}
          <TrailPath trail={trail} />

          {/* Aircraft markers */}
          {sortedFlights.map((flight) => {
            const isSelected = flight.callsign === selectedCallsign;
            const isHovered = flight.callsign === hoveredCallsign;
            const color = isSelected ? SELECTED_COLOR : ACCENT;

            return (
              <Marker
                key={flight.callsign}
                coordinates={[flight.longitude, flight.latitude]}
              >
                <g
                  onClick={() => onSelectFlight(flight)}
                  onMouseEnter={() => setHoveredCallsign(flight.callsign)}
                  onMouseLeave={() => setHoveredCallsign(null)}
                  style={{ cursor: 'pointer' }}
                  transform={`scale(${markerScale})`}
                >
                  {/* Pulse ring for selected */}
                  {isSelected && (
                    <circle r={18} fill="none" stroke={SELECTED_COLOR} strokeWidth={1} opacity={0.3}>
                      <animate
                        attributeName="r"
                        from="10"
                        to="22"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.4"
                        to="0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Aircraft icon */}
                  <AircraftIcon color={color} heading={flight.heading} size={isSelected ? 16 : 14} />

                  {/* Tooltip on hover */}
                  {(isHovered || isSelected) && (
                    <MarkerTooltip callsign={flight.callsign} x={0} y={0} />
                  )}
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
});

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { DispatchFlight } from '@acars/shared';
import 'leaflet/dist/leaflet.css';

interface RouteMapPanelProps {
  flight: DispatchFlight;
  track: any[];
  telemetry?: any;
}

/* ── Auto-fit bounds to route ────────────────────────────────── */

function FitRoute({ flight }: { flight: DispatchFlight }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current) return;
    const points: [number, number][] = [];

    if (flight.depLat && flight.depLon) points.push([flight.depLat, flight.depLon]);
    if (flight.arrLat && flight.arrLon) points.push([flight.arrLat, flight.arrLon]);

    // Add OFP waypoints if available
    if (flight.ofpJson?.steps) {
      for (const step of flight.ofpJson.steps) {
        if (step.lat && step.lon) points.push([step.lat, step.lon]);
      }
    }

    if (points.length === 0) return;
    fittedRef.current = true;

    if (points.length === 1) {
      map.setView(points[0], 6, { animate: true });
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
    }
  }, [map, flight]);

  return null;
}

/* ── Telemetry overlay bar ───────────────────────────────────── */

function TelemetryBar({ telemetry }: { telemetry: any }) {
  if (!telemetry) return null;

  const alt = telemetry.altitude != null
    ? `FL${Math.round(telemetry.altitude / 100).toString().padStart(3, '0')}`
    : '--';
  const gs = telemetry.groundSpeed != null
    ? `${Math.round(telemetry.groundSpeed).toString().padStart(3, '0')}kt`
    : '--';
  const hdg = telemetry.heading != null
    ? `${Math.round(telemetry.heading).toString().padStart(3, '0')}°`
    : '--';
  const vs = telemetry.verticalSpeed != null
    ? `${telemetry.verticalSpeed > 0 ? '+' : ''}${Math.round(telemetry.verticalSpeed)}fpm`
    : '--';

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[1000] flex items-center justify-center gap-6 px-4 py-1.5"
      style={{ background: 'rgba(3, 7, 38, 0.85)' }}
    >
      <span className="font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
        ALT <span className="text-[var(--text-primary)]">{alt}</span>
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
        GS <span className="text-[var(--text-primary)]">{gs}</span>
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
        HDG <span className="text-[var(--text-primary)]">{hdg}</span>
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[var(--text-secondary)]">
        VS <span className="text-[var(--text-primary)]">{vs}</span>
      </span>
    </div>
  );
}

/* ── Main RouteMapPanel ──────────────────────────────────────── */

export default function RouteMapPanel({ flight, track, telemetry }: RouteMapPanelProps) {
  // Build route waypoints from OFP steps
  const routePoints: [number, number][] = [];
  if (flight.ofpJson?.steps) {
    for (const step of flight.ofpJson.steps) {
      if (step.lat && step.lon) routePoints.push([step.lat, step.lon]);
    }
  }

  // If no OFP steps, just draw origin to destination
  const hasOFPRoute = routePoints.length >= 2;
  const directRoute: [number, number][] = [];
  if (!hasOFPRoute && flight.depLat && flight.depLon && flight.arrLat && flight.arrLon) {
    directRoute.push([flight.depLat, flight.depLon], [flight.arrLat, flight.arrLon]);
  }

  // Breadcrumb trail from track points
  const breadcrumbPoints: [number, number][] = track
    .filter((p: any) => p.lat && p.lon)
    .map((p: any) => [p.lat, p.lon] as [number, number]);

  // Aircraft position from telemetry
  const acPos: [number, number] | null =
    telemetry?.latitude && telemetry?.longitude
      ? [telemetry.latitude, telemetry.longitude]
      : null;

  return (
    <div className="h-[45%] border-b border-[var(--surface-3)] relative" style={{ background: 'var(--surface-0)' }}>
      <MapContainer
        center={[30, -20]}
        zoom={3}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: 'var(--surface-0)' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        <FitRoute flight={flight} />

        {/* Route line (OFP waypoints or direct) */}
        {hasOFPRoute && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: '#4F6CCD', weight: 2, opacity: 0.6, dashArray: '6 4' }}
          />
        )}
        {!hasOFPRoute && directRoute.length === 2 && (
          <Polyline
            positions={directRoute}
            pathOptions={{ color: '#4F6CCD', weight: 2, opacity: 0.6, dashArray: '6 4' }}
          />
        )}

        {/* Breadcrumb trail */}
        {breadcrumbPoints.length >= 2 && (
          <Polyline
            positions={breadcrumbPoints}
            pathOptions={{ color: '#34d399', weight: 2.5, opacity: 0.5 }}
          />
        )}

        {/* Origin airport */}
        {flight.depLat && flight.depLon && (
          <CircleMarker
            center={[flight.depLat, flight.depLon]}
            radius={5}
            pathOptions={{ color: '#4F6CCD', fillColor: '#4F6CCD', fillOpacity: 0.8, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent>
              <span style={{ fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace', fontSize: 10, fontWeight: 700, color: '#4F6CCD' }}>
                {flight.bid.depIcao}
              </span>
            </Tooltip>
          </CircleMarker>
        )}

        {/* Destination airport */}
        {flight.arrLat && flight.arrLon && (
          <CircleMarker
            center={[flight.arrLat, flight.arrLon]}
            radius={5}
            pathOptions={{ color: '#4F6CCD', fillColor: '#4F6CCD', fillOpacity: 0.8, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent>
              <span style={{ fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace', fontSize: 10, fontWeight: 700, color: '#4F6CCD' }}>
                {flight.bid.arrIcao}
              </span>
            </Tooltip>
          </CircleMarker>
        )}

        {/* Aircraft position */}
        {acPos && (
          <CircleMarker
            center={acPos}
            radius={5}
            pathOptions={{ color: '#34d399', fillColor: '#34d399', fillOpacity: 1, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span style={{ fontFamily: 'ui-monospace, Cascadia Mono, Consolas, monospace', fontSize: 10, color: '#34d399' }}>
                {flight.bid.flightNumber}
              </span>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      {/* Telemetry overlay */}
      <TelemetryBar telemetry={telemetry} />
    </div>
  );
}

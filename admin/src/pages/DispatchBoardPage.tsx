import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import type { ActiveFlightHeartbeat, AcarsMessagePayload, TrackPoint, FlightExceedance } from '@acars/shared';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { FlightListPanel } from '@/components/dispatch/FlightListPanel';
import { FlightMap } from '@/components/dispatch/FlightMap';
import { FlightDetailPanel } from '@/components/dispatch/FlightDetailPanel';

export function DispatchBoardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { connected, connecting, socket, acquire } = useSocketStore();

  const [flights, setFlights] = useState<ActiveFlightHeartbeat[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<ActiveFlightHeartbeat | null>(null);
  const [messages, setMessages] = useState<AcarsMessagePayload[]>([]);
  const [trail, setTrail] = useState<TrackPoint[]>([]);

  // Track current selected bid for dispatch:subscribe / unsubscribe
  const selectedBidRef = useRef<number | null>(null);

  // Connect socket on mount, disconnect when leaving page (via refcount)
  useEffect(() => {
    if (accessToken) return acquire(accessToken);
  }, [accessToken, acquire]);

  // Subscribe to livemap on socket connect
  useSocket<ActiveFlightHeartbeat[]>('flights:active', (data) => {
    setFlights(data);

    // Update selected flight if still present
    if (selectedFlight) {
      const updated = data.find((f) => f.callsign === selectedFlight.callsign);
      if (updated) {
        setSelectedFlight(updated);
      }
    }
  }, {
    subscribeEvent: 'livemap:subscribe',
    unsubscribeEvent: 'livemap:unsubscribe',
  });

  // DB fallback — fetch active flights via API so dispatch board works even without live heartbeats
  useEffect(() => {
    if (flights.length > 0) return; // socket data arrived, no need for fallback
    api.get<Array<{
      bid_id: number; user_id: number; callsign: string; flight_number: string;
      dep_icao: string; arr_icao: string; aircraft_type: string;
      dep_lat: number | null; dep_lon: number | null; arr_lat: number | null; arr_lon: number | null;
    }>>('/api/admin/dashboard/active-flights')
      .then((data) => {
        if (data.length > 0 && flights.length === 0) {
          setFlights(data.map((f) => ({
            userId: f.user_id,
            bidId: f.bid_id,
            callsign: f.callsign,
            flightNumber: f.flight_number,
            aircraftType: f.aircraft_type,
            latitude: f.dep_lat ?? 0,
            longitude: f.dep_lon ?? 0,
            altitude: 0,
            heading: 0,
            groundSpeed: 0,
            phase: 'active',
            timestamp: new Date().toISOString(),
            depIcao: f.dep_icao,
            arrIcao: f.arr_icao,
            depLat: f.dep_lat ?? undefined,
            depLon: f.dep_lon ?? undefined,
            arrLat: f.arr_lat ?? undefined,
            arrLon: f.arr_lon ?? undefined,
          })));
        }
      })
      .catch(() => {});
  }, [flights.length]);

  // Subscribe to dispatch telemetry for the selected flight
  useEffect(() => {
    if (!socket) return;

    // If a previous bid was selected, unsubscribe
    if (selectedBidRef.current != null) {
      socket.emit('dispatch:unsubscribe', selectedBidRef.current);
      selectedBidRef.current = null;
    }

    // Subscribe using the actual bid ID (populated by backend from active_bids table)
    if (selectedFlight?.bidId) {
      selectedBidRef.current = selectedFlight.bidId;
      socket.emit('dispatch:subscribe', selectedFlight.bidId);
    }

    return () => {
      if (selectedBidRef.current != null && socket) {
        socket.emit('dispatch:unsubscribe', selectedBidRef.current);
        selectedBidRef.current = null;
      }
    };
  }, [socket, selectedFlight]);

  // Listen for per-flight telemetry from the heartbeat relay
  useSocket<ActiveFlightHeartbeat>('dispatch:telemetry', (data) => {
    // Update the flight in the flights array
    setFlights((prev) => prev.map((f) => f.bidId === data.bidId ? data : f));
    // Update selected flight if it matches
    if (selectedFlight?.bidId && data.bidId === selectedFlight.bidId) {
      setSelectedFlight(data);
    }
  });

  // Listen for ACARS messages
  useSocket<AcarsMessagePayload>('acars:message', (msg) => {
    setMessages((prev) => [...prev, msg]);
  });

  // Listen for track points
  useSocket<{ bidId: number; point: TrackPoint }>('track:point', (data) => {
    if (selectedFlight?.bidId && data.bidId === selectedFlight.bidId) {
      setTrail((prev) => [...prev, data.point]);
    }
  });

  // Listen for exceedance events
  useSocket<FlightExceedance>('dispatch:exceedance', (data) => {
    const severity = data.severity === 'critical' ? 'error' : 'warning';
    toast[severity](`Exceedance: ${data.message}`);
  });

  const handleSelectFlight = useCallback((flight: ActiveFlightHeartbeat) => {
    setSelectedFlight(flight);
    setMessages([]);
    setTrail([]);
  }, []);

  const bidId = selectedFlight?.bidId ?? null;

  return (
    <motion.div
      className="flex h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Left panel — Flight list (25%) */}
      <motion.div
        className="w-1/4 min-w-[240px] max-w-[360px] shrink-0"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <FlightListPanel
          flights={flights}
          selectedCallsign={selectedFlight?.callsign ?? null}
          onSelectFlight={handleSelectFlight}
          connected={connected}
          connecting={connecting}
        />
      </motion.div>

      {/* Center — Map (50%) */}
      <motion.div
        className="flex-1 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <FlightMap
          flights={flights}
          selectedCallsign={selectedFlight?.callsign ?? null}
          onSelectFlight={handleSelectFlight}
          trail={trail}
        />
        {/* Connection indicator */}
        <motion.div
          className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 rounded bg-[var(--surface-0)]/80 px-2.5 py-1 text-xs"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected
                ? 'bg-[var(--accent-emerald)] pulse-dot'
                : connecting
                  ? 'bg-[var(--accent-amber)] animate-pulse'
                  : 'bg-[var(--accent-red)]'
            }`}
            role="status"
            aria-label={connected ? 'Connected' : connecting ? 'Connecting' : 'Offline'}
          />
          <span className="text-[var(--text-secondary)]">{
            connected
              ? 'Live'
              : connecting
                ? 'Connecting...'
                : 'Offline'
          }</span>
        </motion.div>
      </motion.div>

      {/* Right panel — Flight detail (25%) */}
      <motion.div
        className="w-1/4 min-w-[280px] max-w-[400px] shrink-0"
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <FlightDetailPanel
          flight={selectedFlight}
          bidId={bidId}
          messages={messages}
        />
      </motion.div>
    </motion.div>
  );
}

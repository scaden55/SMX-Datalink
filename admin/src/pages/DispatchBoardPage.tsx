import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import type { ActiveFlightHeartbeat, TelemetrySnapshot, AcarsMessagePayload, TrackPoint, FlightExceedance } from '@acars/shared';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { toast } from '@/stores/toastStore';
import { FlightListPanel } from '@/components/dispatch/FlightListPanel';
import { FlightMap } from '@/components/dispatch/FlightMap';
import { FlightDetailPanel } from '@/components/dispatch/FlightDetailPanel';

export function DispatchBoardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { connected, connecting, socket, acquire } = useSocketStore();

  const [flights, setFlights] = useState<ActiveFlightHeartbeat[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<ActiveFlightHeartbeat | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
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

  // Listen for dispatch telemetry
  useSocket<TelemetrySnapshot>('dispatch:telemetry', (data) => {
    setTelemetry(data);
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
    setTelemetry(null);
    setMessages([]);
    setTrail([]);
  }, []);

  const bidId = selectedFlight?.bidId ?? null;

  return (
    <motion.div
      className="-m-6 flex h-[calc(100vh-3.5rem)]"
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
          <span className={`inline-block h-2 w-2 rounded-full ${
            connected
              ? 'bg-[var(--accent-emerald)] pulse-dot'
              : connecting
                ? 'bg-[var(--accent-amber)] animate-pulse'
                : 'bg-[var(--accent-red)]'
          }`} />
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
          telemetry={telemetry}
          bidId={bidId}
          messages={messages}
        />
      </motion.div>
    </motion.div>
  );
}

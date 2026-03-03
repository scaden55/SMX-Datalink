import { useEffect, useState, useCallback, useRef } from 'react';
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
  const { connect, connected, connecting, socket } = useSocketStore();

  const [flights, setFlights] = useState<ActiveFlightHeartbeat[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<ActiveFlightHeartbeat | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [messages, setMessages] = useState<AcarsMessagePayload[]>([]);
  const [trail, setTrail] = useState<TrackPoint[]>([]);

  // Track current selected bid for dispatch:subscribe / unsubscribe
  const selectedBidRef = useRef<number | null>(null);

  // Connect socket on mount if not already connected
  useEffect(() => {
    if (accessToken && !connected) {
      connect(accessToken);
    }
  }, [accessToken, connected, connect]);

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

    // If we have a selected flight, find its userId to use as bidId
    // ActiveFlightHeartbeat has userId which serves as the bid identifier
    if (selectedFlight) {
      const bidId = selectedFlight.userId;
      selectedBidRef.current = bidId;
      socket.emit('dispatch:subscribe', bidId);
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
    if (selectedFlight && data.bidId === selectedFlight.userId) {
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

  const bidId = selectedFlight?.userId ?? null;

  return (
    <div className="-m-6 flex h-[calc(100vh-3.5rem)]">
      {/* Left panel — Flight list (25%) */}
      <div className="w-1/4 min-w-[240px] max-w-[360px] shrink-0">
        <FlightListPanel
          flights={flights}
          selectedCallsign={selectedFlight?.callsign ?? null}
          onSelectFlight={handleSelectFlight}
          connected={connected}
          connecting={connecting}
        />
      </div>

      {/* Center — Map (50%) */}
      <div className="flex-1 relative">
        <FlightMap
          flights={flights}
          selectedCallsign={selectedFlight?.callsign ?? null}
          onSelectFlight={handleSelectFlight}
          trail={trail}
        />
        {/* Connection indicator */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 rounded bg-[var(--surface-0)]/80 px-2.5 py-1 text-xs">
          <span className={`inline-block h-2 w-2 rounded-full ${
            connected
              ? 'bg-[var(--accent-emerald)]'
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
        </div>
      </div>

      {/* Right panel — Flight detail (25%) */}
      <div className="w-1/4 min-w-[280px] max-w-[400px] shrink-0">
        <FlightDetailPanel
          flight={selectedFlight}
          telemetry={telemetry}
          bidId={bidId}
          messages={messages}
        />
      </div>
    </div>
  );
}

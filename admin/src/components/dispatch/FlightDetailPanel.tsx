import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { DispatchFlight, CargoManifest, AcarsMessagePayload } from '@acars/shared';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { useDispatchEdit, DispatchEditProvider } from './DispatchEditContext';
import FlightHeader from './FlightHeader';
import AircraftSection from './AircraftSection';
import WeightsSummary from './WeightsSummary';
import FuelAccordion from './FuelAccordion';
import RouteAccordion from './RouteAccordion';
import CargoAccordion from './CargoAccordion';
import MelAccordion from './MelAccordion';
import RemarksAccordion from './RemarksAccordion';
import DetailTabPanel from './DetailTabPanel';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';

/* ── Phase Badge ────────────────────────────────────────────────── */

function PhaseBadge({ phase }: { phase: string }) {
  const colors: Record<string, string> = {
    planning: 'bg-amber-500/20 text-amber-400',
    active: 'bg-emerald-500/20 text-emerald-400',
    completed: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-mono ${colors[phase] ?? colors.planning}`}>
      {phase.toUpperCase()}
    </span>
  );
}

/* ── Top Bar ────────────────────────────────────────────────────── */

function PanelTopBar({ flight, onClose }: { flight: DispatchFlight; onClose: () => void }) {
  const { saving, lastSavedAt, hasUnreleasedChanges, releasing, releaseDispatch } = useDispatchEdit();

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--surface-1)] border-b border-[var(--surface-3)]">
      <button
        onClick={onClose}
        className="text-[var(--accent)] text-[11px] flex items-center gap-1 hover:underline"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div className="w-px h-4 bg-[var(--surface-3)]" />

      <span className="font-mono text-sm font-bold text-[var(--accent-blue-bright)]">
        {flight.bid.flightNumber}
      </span>
      <span className="font-mono text-[11px] text-[var(--text-secondary)]">
        {flight.bid.depIcao} → {flight.bid.arrIcao}
      </span>

      <PhaseBadge phase={flight.phase} />

      <span className="text-[10px] text-[var(--text-muted)]">
        {flight.bid.aircraftType} · {flight.pilot.name}
      </span>

      <div className="flex-1" />

      {saving && <span className="text-[9px] text-amber-400">Saving...</span>}
      {!saving && lastSavedAt && <span className="text-[9px] text-emerald-400">Saved</span>}

      <button
        onClick={releaseDispatch}
        disabled={!hasUnreleasedChanges || releasing}
        className="px-3 py-1 text-[10px] font-semibold rounded bg-[var(--accent)] text-white disabled:opacity-40"
      >
        {releasing ? 'Releasing...' : 'Release Changes'}
      </button>
    </div>
  );
}

/* ── Inner content (needs DispatchEditContext) ───────────────────── */

function PanelInner({
  flight,
  cargo,
  messages,
  exceedances,
  track,
  bidId,
  activeTab,
  setActiveTab,
  onClose,
}: {
  flight: DispatchFlight;
  cargo: CargoManifest | null;
  messages: AcarsMessagePayload[];
  exceedances: any[];
  track: any[];
  bidId: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <PanelTopBar flight={flight} onClose={onClose} />

      {/* Scrollable detail content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: 0 }}>
        <FlightHeader flight={flight} />
        <AircraftSection flight={flight} />
        <WeightsSummary flight={flight} />
        <FuelAccordion flight={flight} />
        <RouteAccordion flight={flight} />
        <CargoAccordion cargo={cargo} />
        <MelAccordion flight={flight} />
        <RemarksAccordion flight={flight} />
      </div>

      {/* Bottom tabs */}
      <div className="border-t border-[var(--surface-3)]" style={{ height: '40%', minHeight: 200 }}>
        <DetailTabPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          flight={flight}
          cargo={cargo}
          messages={messages}
          exceedances={exceedances}
          bidId={bidId}
          track={track}
        />
      </div>
    </>
  );
}

/* ── Main Panel Component ───────────────────────────────────────── */

interface FlightDetailPanelProps {
  bidId: number;
  open: boolean;
  onClose: () => void;
}

export default function FlightDetailPanel({ bidId, open, onClose }: FlightDetailPanelProps) {
  const [flight, setFlight] = useState<DispatchFlight | null>(null);
  const [cargo, setCargo] = useState<CargoManifest | null>(null);
  const [messages, setMessages] = useState<AcarsMessagePayload[]>([]);
  const [exceedances, setExceedances] = useState<any[]>([]);
  const [track, setTrack] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('ofp');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const subscribedRef = useRef(false);
  const socket = useSocketStore((s) => s.socket);

  /* ── Fetch flight data when bidId changes ──────────────────────── */

  useEffect(() => {
    if (!open || !bidId) return;

    setLoading(true);
    setError(null);
    setFlight(null);

    api
      .get<{
        flight: DispatchFlight;
        cargo: CargoManifest | null;
        messages: AcarsMessagePayload[];
        exceedances: any[];
        track: any[];
      }>(`/api/dispatch/flights/${bidId}`)
      .then((data) => {
        setFlight(data.flight);
        setCargo(data.cargo);
        setMessages(data.messages ?? []);
        setExceedances(data.exceedances ?? []);
        setTrack(data.track ?? []);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load flight');
        toast.error('Failed to load flight details');
      })
      .finally(() => setLoading(false));
  }, [bidId, open]);

  /* ── Subscribe to dispatch room ────────────────────────────────── */

  useEffect(() => {
    if (!socket || !bidId || !open) return;

    socket.emit('dispatch:subscribe' as any, bidId);
    subscribedRef.current = true;

    return () => {
      if (subscribedRef.current && socket) {
        socket.emit('dispatch:unsubscribe' as any, bidId);
        subscribedRef.current = false;
      }
    };
  }, [socket, bidId, open]);

  /* ── Socket listeners ──────────────────────────────────────────── */

  useSocket<{ bidId: number; point: any }>('track:point', (data) => {
    if (bidId && data.bidId === bidId) {
      setTrack((prev) => [...prev, data.point]);
    }
  });

  useSocket<AcarsMessagePayload>('acars:message', (msg) => {
    setMessages((prev) => [...prev, msg]);
  });

  useSocket<any>('dispatch:exceedance', (data) => {
    setExceedances((prev) => [...prev, data]);
    const severity = data.severity === 'critical' ? 'error' : 'warning';
    (toast as any)[severity](`Exceedance: ${data.message}`);
  });

  useSocket<{ bidId: number; phase: string }>('flight:phaseChange', (data) => {
    if (bidId && data.bidId === bidId) {
      setFlight((prev) => (prev ? { ...prev, phase: data.phase as any } : prev));
    }
  });

  useSocket<{ bidId: number }>('flight:completed', (data) => {
    if (bidId && data.bidId === bidId) {
      setFlight((prev) => (prev ? { ...prev, phase: 'completed' } : prev));
    }
  });

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div
      className="absolute inset-y-0 left-0 z-40 pointer-events-auto flex flex-col overflow-hidden"
      style={{
        width: '40%',
        minWidth: 420,
        background: 'var(--surface-0)',
        borderRight: '1px solid var(--surface-3)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 300ms ease-out',
      }}
    >
      {loading && (
        <div className="flex items-center justify-center h-full">
          <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
        </div>
      )}

      {!loading && (error || !flight) && (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <span className="text-sm text-[var(--text-muted)]">{error ?? 'Flight not found'}</span>
          <button
            onClick={onClose}
            className="text-[var(--accent)] text-[11px] flex items-center gap-1 hover:underline"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      )}

      {!loading && flight && (
        <DispatchEditProvider
          bidId={bidId}
          phase={flight.phase}
          flightPlanData={flight.flightPlanData}
          releasedFields={flight.releasedFields}
        >
          <PanelInner
            flight={flight}
            cargo={cargo}
            messages={messages}
            exceedances={exceedances}
            track={track}
            bidId={bidId}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onClose={onClose}
          />
        </DispatchEditProvider>
      )}
    </div>
  );
}

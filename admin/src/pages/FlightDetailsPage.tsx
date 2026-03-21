import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { DispatchFlight, CargoManifest, AcarsMessagePayload } from '@acars/shared';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import { useDispatchEdit, DispatchEditProvider } from '@/components/dispatch/DispatchEditContext';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';

/* ─── Phase Badge ──────────────────────────────────────────────── */

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

/* ─── Top Bar ──────────────────────────────────────────────────── */

function TopBar({ flight }: { flight: DispatchFlight }) {
  const navigate = useNavigate();
  const { saving, lastSavedAt, hasUnreleasedChanges, releasing, releaseDispatch } = useDispatchEdit();

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--surface-1)] border-b border-[var(--surface-3)]">
      {/* Back link */}
      <button
        onClick={() => navigate('/dispatch')}
        className="text-[var(--accent)] text-[11px] flex items-center gap-1 hover:underline"
      >
        <ArrowLeft size={14} /> Back to Map
      </button>

      <div className="w-px h-4 bg-[var(--surface-3)]" />

      {/* Flight identity */}
      <span className="font-mono text-sm font-bold text-[var(--accent-blue-bright)]">
        {flight.bid.flightNumber}
      </span>
      <span className="font-mono text-[11px] text-[var(--text-secondary)]">
        {flight.bid.depIcao} → {flight.bid.arrIcao}
      </span>

      {/* Phase badge */}
      <PhaseBadge phase={flight.phase} />

      <span className="text-[10px] text-[var(--text-muted)]">
        {flight.bid.aircraftType} · Pilot: {flight.pilot.name}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status */}
      {saving && <span className="text-[9px] text-amber-400">Saving...</span>}
      {!saving && lastSavedAt && <span className="text-[9px] text-emerald-400">Saved</span>}

      {/* Action buttons */}
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

/* ─── Placeholder Section ──────────────────────────────────────── */

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md px-3 py-2">
      <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">{title}</span>
    </div>
  );
}

/* ─── Loading Spinner ──────────────────────────────────────────── */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
    </div>
  );
}

/* ─── Error State ──────────────────────────────────────────────── */

function ErrorState({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <span className="text-sm text-[var(--text-muted)]">{message}</span>
      <button
        onClick={() => navigate('/dispatch')}
        className="text-[var(--accent)] text-[11px] flex items-center gap-1 hover:underline"
      >
        <ArrowLeft size={14} /> Back to Map
      </button>
    </div>
  );
}

/* ─── Inner Page (needs DispatchEditContext) ────────────────────── */

function FlightDetailsInner({
  flight,
  activeTab,
  setActiveTab,
}: {
  flight: DispatchFlight;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <TopBar flight={flight} />

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Flight plan details */}
        <div className="w-[42%] border-r border-[var(--surface-3)] overflow-y-auto p-3 space-y-2">
          {/* Placeholder sections -- replaced in Tasks 9-10 */}
          <PlaceholderSection title="Flight Header" />
          <PlaceholderSection title="Aircraft" />
          <PlaceholderSection title="Weights" />
          <PlaceholderSection title="Fuel" />
          <PlaceholderSection title="Route" />
          <PlaceholderSection title="Cargo" />
          <PlaceholderSection title="MEL" />
          <PlaceholderSection title="Remarks" />
        </div>

        {/* Right column: Map + tabs */}
        <div className="flex-1 flex flex-col">
          {/* Top: Route map -- placeholder for Task 11 */}
          <div className="h-[45%] bg-[var(--surface-0)] border-b border-[var(--surface-3)] flex items-center justify-center">
            <span className="text-[var(--text-muted)] text-xs">Route Map (Task 11)</span>
          </div>

          {/* Bottom: Tab panel -- placeholder for Task 12 */}
          <div className="flex-1 flex flex-col">
            <div className="flex border-b border-[var(--surface-3)] bg-[var(--surface-1)] px-3">
              {['ofp', 'weather', 'acars', 'cargo', 'exceedances', 'log'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2 text-[10px] uppercase tracking-wider ${
                    activeTab === tab
                      ? 'text-[var(--accent-blue-bright)] border-b-2 border-[var(--accent)]'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex-1 p-3 overflow-y-auto">
              <span className="text-[var(--text-muted)] text-xs">Tab content: {activeTab} (Task 12)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page Component ──────────────────────────────────────── */

export default function FlightDetailsPage() {
  const { bidId } = useParams<{ bidId: string }>();
  const accessToken = useAuthStore((s) => s.accessToken);
  const { acquire } = useSocketStore();

  const [flight, setFlight] = useState<DispatchFlight | null>(null);
  const [cargo, setCargo] = useState<CargoManifest | null>(null);
  const [messages, setMessages] = useState<AcarsMessagePayload[]>([]);
  const [exceedances, setExceedances] = useState<any[]>([]);
  const [track, setTrack] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('ofp');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bidIdNum = bidId ? Number(bidId) : null;
  const subscribedRef = useRef(false);

  /* ── Fetch flight data on mount ─────────────────────────────── */

  useEffect(() => {
    if (!bidId) {
      setError('No flight ID provided');
      setLoading(false);
      return;
    }

    api.get<{ flight: DispatchFlight; cargo: CargoManifest | null; messages: AcarsMessagePayload[]; exceedances: any[]; track: any[] }>(
      `/api/dispatch/flights/${bidId}`
    )
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
  }, [bidId]);

  /* ── Socket connection ──────────────────────────────────────── */

  useEffect(() => {
    if (accessToken) return acquire(accessToken);
  }, [accessToken, acquire]);

  /* ── Subscribe to dispatch room ─────────────────────────────── */

  const socket = useSocketStore((s) => s.socket);

  useEffect(() => {
    if (!socket || !bidIdNum) return;

    socket.emit('dispatch:subscribe' as any, bidIdNum);
    subscribedRef.current = true;

    return () => {
      if (subscribedRef.current && socket) {
        socket.emit('dispatch:unsubscribe' as any, bidIdNum);
        subscribedRef.current = false;
      }
    };
  }, [socket, bidIdNum]);

  /* ── Socket listeners ───────────────────────────────────────── */

  useSocket<any>('dispatch:telemetry', (data) => {
    setTelemetry(data);
  });

  useSocket<{ bidId: number; point: any }>('track:point', (data) => {
    if (bidIdNum && data.bidId === bidIdNum) {
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
    if (bidIdNum && data.bidId === bidIdNum) {
      setFlight((prev) => prev ? { ...prev, phase: data.phase as any } : prev);
    }
  });

  useSocket<{ bidId: number }>('flight:completed', (data) => {
    if (bidIdNum && data.bidId === bidIdNum) {
      setFlight((prev) => prev ? { ...prev, phase: 'completed' } : prev);
    }
  });

  /* ── Render ─────────────────────────────────────────────────── */

  if (loading) return <LoadingSpinner />;
  if (error || !flight) return <ErrorState message={error ?? 'Flight not found'} />;

  return (
    <DispatchEditProvider
      bidId={bidIdNum}
      phase={flight.phase}
      flightPlanData={flight.flightPlanData}
      releasedFields={flight.releasedFields}
    >
      <FlightDetailsInner
        flight={flight}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </DispatchEditProvider>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useUIStore, type ViewMode } from '../../stores/uiStore';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { Badge } from '../common/Badge';
import { api } from '../../lib/api';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import type { LogbookEntry } from '@acars/shared';

export function TopBar() {
  const navigate = useNavigate();
  const { flight, connectionStatus } = useTelemetry();
  const viewMode = useUIStore((s) => s.viewMode);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const activeBidId = useFlightPlanStore((s) => s.activeBidId);
  const clearActiveBid = useFlightPlanStore((s) => s.clearActiveBid);

  const [showDialog, setShowDialog] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { canEdit, hasUnreleasedChanges, releasing, releaseDispatch } = useDispatchEdit();

  // Show End Flight button when in TAXI_IN or PARKED with an active bid
  const canEndFlight = activeBidId != null
    && flight != null
    && (flight.phase === 'TAXI_IN' || flight.phase === 'PARKED');

  const handleEndFlight = async () => {
    if (!activeBidId) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.post<{ logbookId: number; entry: LogbookEntry }>(
        `/api/dispatch/flights/${activeBidId}/complete`,
        { remarks: remarks.trim() || undefined },
      );
      clearActiveBid();
      setShowDialog(false);
      navigate(`/logbook/${result.logbookId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to file PIREP');
    } finally {
      setSubmitting(false);
    }
  };

  const modes: { value: ViewMode; label: string }[] = [
    { value: 'planning', label: 'Planning Info' },
    { value: 'map', label: 'Map' },
    { value: 'both', label: 'Both' },
  ];

  return (
    <div className="flex items-center justify-between border-b border-acars-border bg-acars-card px-4 h-8">
      {/* Left: Flight info */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-acars-muted font-sans">
          {new Date().toUTCString().replace('GMT', 'UTC')}
        </span>
        <div className="flex items-center gap-2">
          <Badge variant="blue">ACARS</Badge>
          {connectionStatus.connected ? (
            <Badge variant="green">
              {connectionStatus.simulator.toUpperCase()}
            </Badge>
          ) : (
            <Badge variant="red">DISCONNECTED</Badge>
          )}
          {flight && (
            <Badge variant="amber">{flight.phase.replace('_', ' ')}</Badge>
          )}
        </div>
      </div>

      {/* Center: Release Dispatch + End Flight buttons */}
      <div className="flex items-center gap-3">
        {canEdit && (
          <button
            onClick={releaseDispatch}
            disabled={!hasUnreleasedChanges || releasing}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold rounded border transition-colors ${
              hasUnreleasedChanges && !releasing
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300'
                : 'bg-acars-input text-acars-muted border-acars-border cursor-not-allowed opacity-50'
            }`}
          >
            {releasing ? (
              <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
            {releasing ? 'Releasing...' : 'Release Dispatch'}
          </button>
        )}
        {canEndFlight && (
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold rounded border transition-colors bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:text-red-300"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
            End Flight
          </button>
        )}
      </div>

      {/* Right: View mode pill toggle */}
      <div className="flex rounded-full border border-acars-border overflow-hidden">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setViewMode(m.value)}
            className={`px-3 py-0.5 text-[10px] font-sans uppercase transition-colors ${
              viewMode === m.value
                ? 'bg-[#1b2b3d] text-[#93c5fd]'
                : 'bg-acars-input text-acars-muted hover:text-acars-text'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* End Flight Confirmation Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => !submitting && setShowDialog(false)}
          />
          {/* Dialog */}
          <div className="relative bg-acars-panel border border-acars-border rounded-md shadow-xl p-5 w-96 max-w-[90vw]">
            <h3 className="text-sm font-bold text-acars-text mb-1">End Flight & File PIREP</h3>
            <p className="text-xs text-acars-muted mb-4">
              This will submit your pilot report and end the active flight.
            </p>

            <label className="block text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1">
              Remarks (optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Add any notes about this flight..."
              className="w-full bg-acars-bg border border-acars-border rounded px-3 py-2 text-xs text-acars-text placeholder:text-acars-muted/50 focus:outline-none focus:border-blue-400/50 resize-none"
              disabled={submitting}
            />

            {error && (
              <p className="text-xs text-red-400 mt-2">{error}</p>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowDialog(false); setError(''); }}
                disabled={submitting}
                className="btn-secondary btn-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEndFlight}
                disabled={submitting}
                className="px-3 py-1.5 text-xs font-semibold rounded transition-colors bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting && (
                  <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                )}
                {submitting ? 'Filing PIREP...' : 'End Flight & File PIREP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

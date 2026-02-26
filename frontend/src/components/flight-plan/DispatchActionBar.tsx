import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useCargoStore } from '../../stores/cargoStore';
import { api } from '../../lib/api';
import type { LogbookEntry } from '@acars/shared';

/** Diamond caution icon — filled amber when active, muted when clear */
function DiamondIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-3 h-3 shrink-0 ${active ? 'text-amber-400' : 'text-emerald-500'}`} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l7 7-7 7-7-7z" />
    </svg>
  );
}

/**
 * Action bar between ScenarioBar and RouteSection.
 * Left: status indicators (Suitability, MEL, NOTOC).
 * Right: action buttons (Release Dispatch for admin, End Flight for pilot).
 */
export function DispatchActionBar() {
  const navigate = useNavigate();
  const telemetry = useTelemetry();
  const activeBidId = useFlightPlanStore((s) => s.activeBidId);
  const clearActiveBid = useFlightPlanStore((s) => s.clearActiveBid);
  const { canEdit, isOwnFlight, hasUnreleasedChanges, releasing, releaseDispatch, editableFields } = useDispatchEdit();
  const flight = isOwnFlight ? telemetry.flight : null;
  const manifest = useCargoStore((s) => s.manifest);

  const [showDialog, setShowDialog] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  // Status indicators
  const melText = (editableFields.melRestrictions ?? '').trim();
  const hasMel = melText.length > 0;
  const hasNotoc = manifest?.notocRequired && manifest.notocItems.length > 0;

  return (
    <>
      <div className="border-b border-acars-border px-3 h-8 flex items-center gap-4">
        {/* Left: status indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <DiamondIcon active={hasMel} />
            <span className={`text-[10px] font-sans ${hasMel ? 'text-amber-400' : 'text-acars-muted'}`}>
              MEL & Restrictions
            </span>
          </div>
          {hasNotoc && (
            <div className="flex items-center gap-1.5">
              <DiamondIcon active />
              <span className="text-[10px] font-sans text-amber-400">NOTOC</span>
            </div>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 ml-auto">
          {canEdit && (
            <button
              onClick={releaseDispatch}
              disabled={!hasUnreleasedChanges || releasing}
              className={`flex items-center gap-1.5 px-3 py-0.5 text-[10px] font-semibold rounded border transition-colors duration-150 ${
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
              {releasing ? 'Releasing...' : 'Release/File'}
            </button>
          )}
          {canEndFlight && (
            <button
              onClick={() => setShowDialog(true)}
              className="flex items-center gap-1.5 px-3 py-0.5 text-[10px] font-semibold rounded border transition-colors duration-150 bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:text-red-300"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              End Flight
            </button>
          )}
        </div>
      </div>

      {/* End Flight Confirmation Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => !submitting && setShowDialog(false)}
          />
          <div className="relative bg-acars-panel border border-acars-border rounded-md shadow-xl p-5 w-96 max-w-[90vw]">
            <h3 className="text-[13px] font-semibold text-acars-text mb-1">End Flight & File PIREP</h3>
            <p className="text-[11px] text-acars-muted mb-4">
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
              className="w-full bg-acars-bg border border-acars-border rounded px-3 py-2 text-[11px] text-acars-text placeholder:text-acars-muted/50 focus:outline-none focus:border-blue-400/50 resize-none"
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
    </>
  );
}

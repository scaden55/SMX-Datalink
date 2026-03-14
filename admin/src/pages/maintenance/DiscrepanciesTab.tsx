import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Plus,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Pause,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { tableContainer, tableRow, fadeUp } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────

interface Discrepancy {
  id: number;
  aircraftId: number;
  aircraftRegistration?: string;
  flightNumber: string | null;
  reportedBy: number;
  reportedByName?: string;
  reportedAt: string;
  ataChapter: string;
  ataChapterTitle?: string;
  description: string;
  flightPhase: string | null;
  severity: 'grounding' | 'non_grounding';
  status: 'open' | 'in_review' | 'deferred' | 'resolved' | 'grounded';
  resolvedBy: number | null;
  resolvedByName?: string;
  resolvedAt: string | null;
  resolutionType: string | null;
  correctiveAction: string | null;
  melDeferralId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface DiscrepancyStats {
  open: number;
  inReview: number;
  deferred: number;
  resolved30d: number;
}

interface FleetAircraft {
  aircraftId: number;
  registration: string;
  icaoType: string;
  name: string;
}

interface AtaChapter {
  chapter: string;
  title: string;
}

interface MelMasterItem {
  id: number;
  icaoType: string;
  ataChapter: string;
  itemNumber: string;
  title: string;
  category: string;
  rectificationInterval: number | null;
  remarks: string | null;
}

// ── Helpers ──────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

// ── Badges ──────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: 'grounding' | 'non_grounding' }) {
  const isGnd = severity === 'grounding';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '16px',
        background: isGnd ? 'var(--accent-red-bg)' : 'var(--surface-2)',
        color: isGnd ? 'var(--accent-red)' : 'var(--text-tertiary)',
        whiteSpace: 'nowrap',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      {isGnd ? 'GND' : 'NON'}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/_/g, ' ');
  let bg = 'var(--surface-2)';
  let text = 'var(--text-secondary)';

  if (normalized === 'resolved') {
    bg = 'var(--accent-emerald-bg)';
    text = 'var(--accent-emerald)';
  } else if (normalized === 'grounded') {
    bg = 'var(--accent-red-bg)';
    text = 'var(--accent-red)';
  } else if (normalized === 'open') {
    bg = 'var(--accent-blue-bg)';
    text = 'var(--accent-blue-bright)';
  } else if (normalized === 'in review') {
    bg = 'var(--accent-amber-bg)';
    text = 'var(--accent-amber)';
  } else if (normalized === 'deferred') {
    bg = 'var(--accent-cyan-bg)';
    text = 'var(--accent-cyan)';
  }

  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '16px',
        background: bg,
        color: text,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ── Skeleton ─────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 42,
            background: 'var(--surface-2)',
            borderRadius: 4,
            marginBottom: 4,
            opacity: 0.5,
          }}
          className="animate-pulse"
        />
      ))}
    </div>
  );
}

// ── Shared Styles ────────────────────────────────────────────

const colHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.8,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  userSelect: 'none',
};

const cellStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--border-primary)',
  fontSize: 12,
  color: 'var(--text-secondary)',
  verticalAlign: 'middle',
};

const FLIGHT_PHASES = [
  'preflight',
  'taxi_out',
  'takeoff',
  'climb',
  'cruise',
  'descent',
  'approach',
  'landing',
  'taxi_in',
  'parked',
] as const;

// ═══════════════════════════════════════════════════════════════
// Detail Panel
// ═══════════════════════════════════════════════════════════════

function DetailPanel({
  discrepancy,
  onClose,
  onUpdated,
}: {
  discrepancy: Discrepancy;
  onClose: () => void;
  onUpdated: () => void;
}) {
  // Action expansion
  const [expandedAction, setExpandedAction] = useState<'correct' | 'defer' | null>(null);

  // Correct form
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [createMaintLog, setCreateMaintLog] = useState(false);
  const [correctLoading, setCorrectLoading] = useState(false);

  // Defer form
  const [melItems, setMelItems] = useState<MelMasterItem[]>([]);
  const [melLoading, setMelLoading] = useState(false);
  const [melError, setMelError] = useState<string | null>(null);
  const [selectedMelId, setSelectedMelId] = useState('');
  const [placardInfo, setPlacardInfo] = useState('');
  const [deferRemarks, setDeferRemarks] = useState('');
  const [deferLoading, setDeferLoading] = useState(false);

  // Ground confirm
  const [groundConfirmOpen, setGroundConfirmOpen] = useState(false);
  const [groundLoading, setGroundLoading] = useState(false);

  const canAct = discrepancy.status === 'open' || discrepancy.status === 'in_review';

  // Fetch MEL items when defer is expanded
  useEffect(() => {
    if (expandedAction !== 'defer') return;
    setMelLoading(true);
    setMelError(null);
    setMelItems([]);
    setSelectedMelId('');

    // We need the icaoType for the aircraft. We'll fetch fleet-status to find it.
    (async () => {
      try {
        const fleetRes = await api.get<{ fleet: FleetAircraft[] }>('/api/admin/maintenance/fleet-status');
        const aircraft = fleetRes.fleet.find((a) => a.aircraftId === discrepancy.aircraftId);
        if (!aircraft) {
          setMelError('Aircraft not found in fleet.');
          return;
        }

        const res = await api.get<{ items: MelMasterItem[] }>(
          `/api/admin/maintenance/mel-master?icaoType=${encodeURIComponent(aircraft.icaoType)}`,
        );

        // Filter by ATA chapter
        const ataPrefix = discrepancy.ataChapter.split('-')[0];
        const filtered = res.items.filter((item) => item.ataChapter.startsWith(ataPrefix));

        if (filtered.length === 0) {
          setMelError(
            `This item is not on the approved MEL for ${aircraft.icaoType}. Must be corrected or aircraft grounded.`,
          );
        } else {
          setMelItems(filtered);
        }
      } catch (err) {
        setMelError(err instanceof ApiError ? err.message : 'Failed to load MEL items');
      } finally {
        setMelLoading(false);
      }
    })();
  }, [expandedAction, discrepancy.aircraftId, discrepancy.ataChapter]);

  async function handleCorrect() {
    if (!correctiveAction.trim()) return;
    setCorrectLoading(true);
    try {
      await api.post(`/api/admin/discrepancies/${discrepancy.id}/resolve`, {
        correctiveAction: correctiveAction.trim(),
        createMaintenanceLog: createMaintLog,
      });
      toast.success('Discrepancy resolved');
      onUpdated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to resolve discrepancy');
    } finally {
      setCorrectLoading(false);
    }
  }

  async function handleDefer() {
    if (!selectedMelId) return;
    setDeferLoading(true);
    try {
      await api.post(`/api/admin/discrepancies/${discrepancy.id}/defer`, {
        melMasterId: parseInt(selectedMelId),
        placardInfo: placardInfo.trim() || undefined,
        remarks: deferRemarks.trim() || undefined,
      });
      toast.success('Discrepancy deferred via MEL');
      onUpdated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to defer discrepancy');
    } finally {
      setDeferLoading(false);
    }
  }

  async function handleGround() {
    setGroundLoading(true);
    try {
      await api.post(`/api/admin/discrepancies/${discrepancy.id}/ground`);
      toast.success('Aircraft grounded');
      setGroundConfirmOpen(false);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to ground aircraft');
    } finally {
      setGroundLoading(false);
    }
  }

  const selectedMel = melItems.find((m) => m.id.toString() === selectedMelId);

  return (
    <>
      <motion.div
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 20, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 400,
          background: 'var(--surface-1)',
          borderLeft: '1px solid var(--border-primary)',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.2)',
          overflowY: 'auto',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: 16,
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SeverityBadge severity={discrepancy.severity} />
              <StatusBadge status={discrepancy.status} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              ATA {discrepancy.ataChapter}
              {discrepancy.ataChapterTitle && (
                <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>
                  {discrepancy.ataChapterTitle}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Details */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {/* Aircraft & Flight */}
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Aircraft
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {discrepancy.aircraftRegistration ?? `#${discrepancy.aircraftId}`}
              </div>
            </div>
            {discrepancy.flightNumber && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  Flight
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {discrepancy.flightNumber}
                </div>
              </div>
            )}
          </div>

          {/* Reporter & Date */}
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Reported By
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {discrepancy.reportedByName ?? `User #${discrepancy.reportedBy}`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Reported
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {formatDateTime(discrepancy.reportedAt)}
              </div>
            </div>
          </div>

          {/* Flight Phase */}
          {discrepancy.flightPhase && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Flight Phase
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {discrepancy.flightPhase.replace(/_/g, ' ')}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              Description
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
                background: 'var(--surface-0)',
                padding: 12,
                borderRadius: 6,
                border: '1px solid var(--border-primary)',
              }}
            >
              {discrepancy.description}
            </div>
          </div>

          {/* Resolution info (if resolved) */}
          {discrepancy.resolvedAt && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Resolution
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {discrepancy.resolutionType && (
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {discrepancy.resolutionType.replace(/_/g, ' ')}
                  </span>
                )}
                {' by '}
                {discrepancy.resolvedByName ?? `User #${discrepancy.resolvedBy}`}
                {' on '}
                {formatDate(discrepancy.resolvedAt)}
              </div>
              {discrepancy.correctiveAction && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    lineHeight: 1.6,
                    background: 'var(--surface-0)',
                    padding: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  {discrepancy.correctiveAction}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          {canAct && (
            <>
              <div style={{ borderTop: '1px solid var(--border-primary)', margin: '4px 0' }} />

              {/* Resolution Actions */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Resolution Actions
              </div>

              {/* Mark as Corrected */}
              <div>
                <button
                  onClick={() => setExpandedAction(expandedAction === 'correct' ? null : 'correct')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '8px 12px',
                    background: expandedAction === 'correct' ? 'var(--accent-emerald-bg)' : 'var(--surface-2)',
                    color: expandedAction === 'correct' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 120ms',
                  }}
                >
                  <CheckCircle2 size={14} />
                  Mark as Corrected
                </button>

                {expandedAction === 'correct' && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="space-y-2">
                      <Label style={{ fontSize: 11 }}>Corrective Action *</Label>
                      <Textarea
                        value={correctiveAction}
                        onChange={(e) => setCorrectiveAction(e.target.value)}
                        placeholder="Describe the corrective action taken..."
                        rows={3}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Checkbox
                        id="create-maint-log"
                        checked={createMaintLog}
                        onCheckedChange={(checked) => setCreateMaintLog(checked === true)}
                      />
                      <label
                        htmlFor="create-maint-log"
                        style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        Create maintenance log entry
                      </label>
                    </div>
                    <Button
                      onClick={handleCorrect}
                      disabled={correctLoading || !correctiveAction.trim()}
                      style={{ alignSelf: 'flex-end' }}
                      size="sm"
                    >
                      {correctLoading ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Defer via MEL */}
              <div>
                <button
                  onClick={() => setExpandedAction(expandedAction === 'defer' ? null : 'defer')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '8px 12px',
                    background: expandedAction === 'defer' ? 'var(--accent-amber-bg)' : 'var(--surface-2)',
                    color: expandedAction === 'defer' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 120ms',
                  }}
                >
                  <Clock size={14} />
                  Defer via MEL
                </button>

                {expandedAction === 'defer' && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {melLoading && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 8 }}>
                        Loading MEL items...
                      </div>
                    )}
                    {melError && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--accent-red)',
                          background: 'var(--accent-red-bg)',
                          padding: 12,
                          borderRadius: 6,
                          lineHeight: 1.5,
                        }}
                      >
                        <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
                        {melError}
                      </div>
                    )}
                    {!melLoading && !melError && melItems.length > 0 && (
                      <>
                        <div className="space-y-2">
                          <Label style={{ fontSize: 11 }}>MEL Item *</Label>
                          <Select value={selectedMelId} onValueChange={setSelectedMelId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select MEL item..." />
                            </SelectTrigger>
                            <SelectContent>
                              {melItems.map((item) => (
                                <SelectItem key={item.id} value={item.id.toString()}>
                                  {item.itemNumber} - {item.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedMel && (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-secondary)',
                              background: 'var(--surface-0)',
                              padding: 10,
                              borderRadius: 6,
                              border: '1px solid var(--border-primary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            <div>
                              <span style={{ color: 'var(--text-tertiary)' }}>Category: </span>
                              <span style={{ fontWeight: 600 }}>{selectedMel.category}</span>
                            </div>
                            {selectedMel.rectificationInterval && (
                              <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>Rectification: </span>
                                <span style={{ fontWeight: 600 }}>{selectedMel.rectificationInterval} days</span>
                              </div>
                            )}
                            {selectedMel.remarks && (
                              <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>Remarks: </span>
                                {selectedMel.remarks}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label style={{ fontSize: 11 }}>Placard Override</Label>
                          <Input
                            value={placardInfo}
                            onChange={(e) => setPlacardInfo(e.target.value)}
                            placeholder="Optional placard info..."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label style={{ fontSize: 11 }}>Remarks</Label>
                          <Textarea
                            value={deferRemarks}
                            onChange={(e) => setDeferRemarks(e.target.value)}
                            placeholder="Optional remarks..."
                            rows={2}
                          />
                        </div>

                        <Button
                          onClick={handleDefer}
                          disabled={deferLoading || !selectedMelId}
                          style={{ alignSelf: 'flex-end' }}
                          size="sm"
                        >
                          {deferLoading ? 'Submitting...' : 'Submit'}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Ground Aircraft */}
              <button
                onClick={() => setGroundConfirmOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--accent-red-bg)',
                  color: 'var(--accent-red)',
                  border: '1px solid var(--accent-red)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'opacity 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                <ShieldAlert size={14} />
                Ground Aircraft
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Ground Confirmation Dialog */}
      <Dialog open={groundConfirmOpen} onOpenChange={setGroundConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ground Aircraft</DialogTitle>
            <DialogDescription>
              Are you sure you want to ground {discrepancy.aircraftRegistration ?? `aircraft #${discrepancy.aircraftId}`}?
              This will take the aircraft out of service until the discrepancy is resolved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroundConfirmOpen(false)} disabled={groundLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleGround} disabled={groundLoading}>
              {groundLoading ? 'Grounding...' : 'Ground Aircraft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// New Discrepancy Dialog
// ═══════════════════════════════════════════════════════════════

function NewDiscrepancyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [ataChapters, setAtaChapters] = useState<AtaChapter[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);

  const [aircraftId, setAircraftId] = useState('');
  const [ataChapter, setAtaChapter] = useState('');
  const [description, setDescription] = useState('');
  const [flightPhase, setFlightPhase] = useState('');
  const [severity, setSeverity] = useState<'non_grounding' | 'grounding'>('non_grounding');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFleetLoading(true);
    Promise.all([
      api.get<{ fleet: FleetAircraft[] }>('/api/admin/maintenance/fleet-status'),
      api.get<{ chapters: AtaChapter[] }>('/api/ata-chapters'),
    ])
      .then(([fleetRes, ataRes]) => {
        setFleet(fleetRes.fleet);
        setAtaChapters(ataRes.chapters);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load form data');
      })
      .finally(() => setFleetLoading(false));
  }, [open]);

  function resetForm() {
    setAircraftId('');
    setAtaChapter('');
    setDescription('');
    setFlightPhase('');
    setSeverity('non_grounding');
  }

  async function handleSubmit() {
    if (!aircraftId || !ataChapter || description.trim().length < 10) return;
    setSubmitLoading(true);
    try {
      await api.post('/api/discrepancies', {
        aircraftId: parseInt(aircraftId),
        ataChapter,
        description: description.trim(),
        flightPhase: flightPhase || undefined,
        severity,
      });
      toast.success('Discrepancy reported');
      resetForm();
      onClose();
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create discrepancy');
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Discrepancy</DialogTitle>
          <DialogDescription>Report a new aircraft discrepancy.</DialogDescription>
        </DialogHeader>
        {fleetLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Loading...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Aircraft */}
            <div className="space-y-2">
              <Label>Aircraft *</Label>
              <Select value={aircraftId} onValueChange={setAircraftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select aircraft..." />
                </SelectTrigger>
                <SelectContent>
                  {fleet.map((a) => (
                    <SelectItem key={a.aircraftId} value={a.aircraftId.toString()}>
                      {a.registration} ({a.icaoType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ATA Chapter */}
            <div className="space-y-2">
              <Label>ATA Chapter *</Label>
              <Select value={ataChapter} onValueChange={setAtaChapter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ATA chapter..." />
                </SelectTrigger>
                <SelectContent>
                  {ataChapters.map((c) => (
                    <SelectItem key={c.chapter} value={c.chapter}>
                      {c.chapter} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description * (min 10 characters)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the discrepancy in detail..."
                rows={4}
              />
            </div>

            {/* Flight Phase + Severity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Flight Phase</Label>
                <Select value={flightPhase} onValueChange={setFlightPhase}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {FLIGHT_PHASES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Severity</Label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
                  <button
                    onClick={() => setSeverity('non_grounding')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      background: severity === 'non_grounding' ? 'var(--accent-blue-bg)' : 'var(--surface-2)',
                      color: severity === 'non_grounding' ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
                      transition: 'all 120ms',
                    }}
                  >
                    Non-Grounding
                  </button>
                  <button
                    onClick={() => setSeverity('grounding')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      border: 'none',
                      borderLeft: '1px solid var(--border-primary)',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      background: severity === 'grounding' ? 'var(--accent-red-bg)' : 'var(--surface-2)',
                      color: severity === 'grounding' ? 'var(--accent-red)' : 'var(--text-tertiary)',
                      transition: 'all 120ms',
                    }}
                  >
                    Grounding
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }} disabled={submitLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitLoading || !aircraftId || !ataChapter || description.trim().length < 10}
          >
            {submitLoading ? 'Submitting...' : 'Report Discrepancy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Discrepancies Tab
// ═══════════════════════════════════════════════════════════════

export function DiscrepanciesTab() {
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [stats, setStats] = useState<DiscrepancyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection & Detail
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailDiscrepancy, setDetailDiscrepancy] = useState<Discrepancy | null>(null);

  // New dialog
  const [createOpen, setCreateOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<DiscrepancyStats>('/api/admin/discrepancies/stats');
      setStats(res);
    } catch {
      // Silently fail stats
    }
  }, []);

  const fetchDiscrepancies = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await api.get<{ discrepancies: Discrepancy[]; total: number }>(
        `/api/admin/discrepancies?${params.toString()}`,
      );
      setDiscrepancies(res.discrepancies);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load discrepancies');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, search]);

  useEffect(() => {
    fetchStats();
    fetchDiscrepancies();
  }, [fetchStats, fetchDiscrepancies]);

  function handleRowClick(d: Discrepancy) {
    if (selectedId === d.id) {
      setSelectedId(null);
      setDetailDiscrepancy(null);
    } else {
      setSelectedId(d.id);
      setDetailDiscrepancy(d);
    }
  }

  function handleDetailUpdated() {
    setSelectedId(null);
    setDetailDiscrepancy(null);
    fetchDiscrepancies();
    fetchStats();
  }

  function handleCreated() {
    fetchDiscrepancies();
    fetchStats();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const statCards: { label: string; value: number | undefined; color: string; bg: string; icon: React.ReactNode }[] = [
    {
      label: 'Open',
      value: stats?.open,
      color: 'var(--accent-red)',
      bg: 'var(--accent-red-bg)',
      icon: <AlertTriangle size={14} />,
    },
    {
      label: 'In Review',
      value: stats?.inReview,
      color: 'var(--accent-amber)',
      bg: 'var(--accent-amber-bg)',
      icon: <Pause size={14} />,
    },
    {
      label: 'Deferred',
      value: stats?.deferred,
      color: 'var(--accent-blue-bright)',
      bg: 'var(--accent-blue-bg)',
      icon: <Clock size={14} />,
    },
    {
      label: 'Resolved 30d',
      value: stats?.resolved30d,
      color: 'var(--accent-emerald)',
      bg: 'var(--accent-emerald-bg)',
      icon: <CheckCircle2 size={14} />,
    },
  ];

  const statusPills: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_review', label: 'In Review' },
    { key: 'deferred', label: 'Deferred' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Stats Row ──────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        style={{
          display: 'flex',
          gap: 12,
          padding: '16px 24px',
        }}
      >
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              flex: 1,
              background: 'var(--surface-1)',
              borderRadius: 6,
              padding: 16,
              borderLeft: `3px solid ${card.color}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: card.color,
                fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {card.value ?? '--'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {card.icon}
              {card.label}
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Action Bar ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', width: 220 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            placeholder="Search discrepancies..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-glow"
            style={{
              width: '100%',
              height: 32,
              paddingLeft: 30,
              paddingRight: 10,
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-1)', borderRadius: 6, padding: 2 }}>
          {statusPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => { setStatusFilter(pill.key); setPage(1); }}
              style={{
                padding: '4px 12px',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                background: statusFilter === pill.key ? 'var(--accent-blue-bg)' : 'transparent',
                color: statusFilter === pill.key ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
                transition: 'all 120ms',
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* New Discrepancy */}
        <button
          onClick={() => setCreateOpen(true)}
          className="btn-glow"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 120ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <Plus size={13} />
          New Discrepancy
        </button>
      </div>

      {/* ── Table + Detail Panel ───────────────────────────── */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              overflowX: 'auto',
              paddingRight: detailDiscrepancy ? 400 : 0,
              transition: 'padding-right 200ms ease',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...colHeaderStyle, width: 60 }}>SEV</th>
                  <th style={colHeaderStyle}>AIRCRAFT</th>
                  <th style={{ ...colHeaderStyle, width: 70 }}>ATA</th>
                  <th style={colHeaderStyle}>DESCRIPTION</th>
                  <th style={colHeaderStyle}>REPORTED BY</th>
                  <th style={{ ...colHeaderStyle, width: 80 }}>AGE</th>
                  <th style={{ ...colHeaderStyle, width: 100 }}>STATUS</th>
                </tr>
              </thead>
              <motion.tbody variants={tableContainer} initial="hidden" animate="visible">
                {discrepancies.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: '40px 16px',
                        textAlign: 'center',
                        color: 'var(--text-tertiary)',
                        fontSize: 13,
                      }}
                    >
                      No discrepancies found
                    </td>
                  </tr>
                ) : (
                  discrepancies.map((d) => {
                    const isSelected = selectedId === d.id;
                    return (
                      <motion.tr
                        key={d.id}
                        variants={tableRow}
                        onClick={() => handleRowClick(d)}
                        style={{
                          cursor: 'pointer',
                          outline: isSelected ? '1px solid var(--accent-blue)' : 'none',
                          outlineOffset: -1,
                          background: isSelected ? 'var(--accent-blue-bg)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <td style={cellStyle}>
                          <SeverityBadge severity={d.severity} />
                        </td>
                        <td
                          style={{
                            ...cellStyle,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                            fontSize: 12,
                          }}
                        >
                          {d.aircraftRegistration ?? `#${d.aircraftId}`}
                        </td>
                        <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                          {d.ataChapter}
                        </td>
                        <td
                          style={{
                            ...cellStyle,
                            color: 'var(--text-secondary)',
                            fontSize: 11,
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {truncate(d.description, 60)}
                        </td>
                        <td style={{ ...cellStyle, fontSize: 11 }}>
                          {d.reportedByName ?? `User #${d.reportedBy}`}
                        </td>
                        <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {formatRelativeTime(d.reportedAt)}
                        </td>
                        <td style={cellStyle}>
                          <StatusBadge status={d.status} />
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </motion.tbody>
            </table>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {detailDiscrepancy && (
              <DetailPanel
                key={detailDiscrepancy.id}
                discrepancy={detailDiscrepancy}
                onClose={() => {
                  setSelectedId(null);
                  setDetailDiscrepancy(null);
                }}
                onUpdated={handleDetailUpdated}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────── */}
      {!loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderTop: '1px solid var(--border-primary)',
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          <span>
            {total === 0
              ? 'No results'
              : `${(page - 1) * pageSize + 1}--${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                background: 'none',
                border: '1px solid var(--border-primary)',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                color: page <= 1 ? 'var(--text-quaternary)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ padding: '0 8px', color: 'var(--text-secondary)', fontSize: 12 }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                background: 'none',
                border: '1px solid var(--border-primary)',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                color: page >= totalPages ? 'var(--text-quaternary)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* New Discrepancy Dialog */}
      <NewDiscrepancyDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  );
}

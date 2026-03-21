import React, { useCallback, useEffect, useState } from 'react';
import { Search, Plus, X, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wrench, Clock, ShieldAlert } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  status: 'open' | 'in_review' | 'deferred' | 'resolved' | 'grounded' | 'in_maintenance';
  resolvedBy: number | null;
  resolvedByName?: string;
  resolvedAt: string | null;
  resolutionType: string | null;
  correctiveAction: string | null;
  melDeferralId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface AtaChapter { chapter: string; title: string }
interface MelMasterItem {
  id: number; icaoType: string; ataChapter: string; itemNumber: string;
  title: string; category: string; rectificationInterval: number | null; remarks: string | null;
}
interface FleetAircraft { aircraftId: number; registration: string; icaoType: string; name: string }
interface DiscrepanciesTabProps { aircraftId: number }

// ── Helpers ──────────────────────────────────────────────────

const FLIGHT_PHASES = ['preflight', 'taxi', 'takeoff', 'climb', 'cruise', 'descent', 'approach', 'landing'] as const;

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

function truncate(s: string, n: number) { return s.length <= n ? s : s.slice(0, n) + '...'; }

const hdr: React.CSSProperties = { padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', userSelect: 'none', textAlign: 'left' };
const cell: React.CSSProperties = { padding: '10px 16px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle' };
const subLabel: React.CSSProperties = { marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' };

// ── Badges ──────────────────────────────────────────────────

function SevBadge({ severity }: { severity: 'grounding' | 'non_grounding' }) {
  const g = severity === 'grounding';
  return (
    <span className="font-mono" style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', fontSize: 10, fontWeight: 700,
      lineHeight: '16px', background: g ? 'var(--accent-red-bg)' : 'var(--surface-2)',
      color: g ? 'var(--accent-red)' : 'var(--text-tertiary)', letterSpacing: 0.5, textTransform: 'uppercase',
    }}>{g ? 'GND' : 'NON'}</span>
  );
}

const STATUS_COLORS: Record<string, [string, string]> = {
  open: ['var(--accent-blue-bg)', 'var(--accent-blue-bright)'],
  'in review': ['var(--accent-amber-bg)', 'var(--accent-amber)'],
  deferred: ['var(--accent-cyan-bg)', 'var(--accent-cyan)'],
  resolved: ['var(--accent-emerald-bg)', 'var(--accent-emerald)'],
  grounded: ['var(--accent-red-bg)', 'var(--accent-red)'],
  'in maintenance': ['var(--accent-cyan-bg)', 'var(--accent-cyan)'],
};

function StatBadge({ status }: { status: string }) {
  const norm = status.toLowerCase().replace(/_/g, ' ');
  const [bg, fg] = STATUS_COLORS[norm] ?? ['var(--surface-2)', 'var(--text-secondary)'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', fontSize: 11,
      fontWeight: 600, lineHeight: '16px', background: bg, color: fg, whiteSpace: 'nowrap',
    }}>{norm.charAt(0).toUpperCase() + norm.slice(1)}</span>
  );
}

// ── Create Form ─────────────────────────────────────────────

function CreateForm({ aircraftId, onCreated, onClose }: { aircraftId: number; onCreated: () => void; onClose: () => void }) {
  const [ataChapters, setAtaChapters] = useState<AtaChapter[]>([]);
  const [ataLoading, setAtaLoading] = useState(true);
  const [ata, setAta] = useState('');
  const [desc, setDesc] = useState('');
  const [phase, setPhase] = useState('');
  const [sev, setSev] = useState<'non_grounding' | 'grounding'>('non_grounding');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ chapters: AtaChapter[] }>('/api/ata-chapters')
      .then((r) => setAtaChapters(r.chapters))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load ATA chapters'))
      .finally(() => setAtaLoading(false));
  }, []);

  const valid = ata && desc.trim().length >= 10;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    try {
      await api.post('/api/discrepancies', {
        aircraftId, ataChapter: ata, description: desc.trim(),
        flightPhase: phase || undefined, severity: sev,
      });
      toast.success('Discrepancy reported');
      onCreated();
      onClose();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Failed to create discrepancy'); }
    finally { setBusy(false); }
  }

  const selStyle = { background: 'var(--surface-3)', border: '1px solid var(--border-secondary)' };
  const togBtn = (active: boolean, clr: string, bg: string): React.CSSProperties => ({
    flex: 1, padding: '7px 8px', border: 'none', cursor: 'pointer', fontWeight: 600,
    background: active ? bg : 'var(--surface-3)', color: active ? clr : 'var(--text-tertiary)', transition: 'all 120ms',
  });

  return (
    <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-primary)', padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span className="text-subheading" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Discrepancy</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}><X size={14} /></button>
      </div>
      {ataLoading ? (
        <div className="text-caption" style={{ color: 'var(--text-tertiary)', padding: '8px 0' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 2 }}>
              <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>ATA Chapter *</label>
              <Select value={ata} onValueChange={setAta}>
                <SelectTrigger style={selStyle}><SelectValue placeholder="Select ATA chapter..." /></SelectTrigger>
                <SelectContent>{ataChapters.map((c) => <SelectItem key={c.chapter} value={c.chapter}>{c.chapter} — {c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Severity</label>
              <div style={{ display: 'flex', overflow: 'hidden', border: '1px solid var(--border-secondary)' }}>
                <button onClick={() => setSev('non_grounding')} className="text-caption" style={togBtn(sev === 'non_grounding', 'var(--accent-blue-bright)', 'var(--accent-blue-bg)')}>Non-Grounding</button>
                <button onClick={() => setSev('grounding')} className="text-caption" style={{ ...togBtn(sev === 'grounding', 'var(--accent-red)', 'var(--accent-red-bg)'), borderLeft: '1px solid var(--border-secondary)' }}>Grounding</button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Description * <span style={{ color: 'var(--text-quaternary)' }}>(min 10 chars)</span></label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe the discrepancy..." rows={3} className="text-caption"
              style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)', padding: '8px 10px', resize: 'vertical', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ width: 200 }}>
              <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Flight Phase <span style={{ color: 'var(--text-quaternary)' }}>(optional)</span></label>
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger style={selStyle}><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {FLIGHT_PHASES.map((p) => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={submit} disabled={busy || !valid} className="text-caption" style={{
              padding: '7px 16px', background: 'var(--accent-blue)', color: '#fff', border: 'none', fontWeight: 600,
              cursor: busy || !valid ? 'not-allowed' : 'pointer', opacity: busy || !valid ? 0.5 : 1,
            }}>{busy ? 'Submitting...' : 'Report Discrepancy'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expanded Row ────────────────────────────────────────────

function ExpandedRow({ discrepancy: d, aircraftId, onUpdated }: { discrepancy: Discrepancy; aircraftId: number; onUpdated: () => void }) {
  const canAct = d.status === 'open' || d.status === 'in_review';

  const [deferMode, setDeferMode] = useState(false);
  const [melItems, setMelItems] = useState<MelMasterItem[]>([]);
  const [melLoading, setMelLoading] = useState(false);
  const [melError, setMelError] = useState<string | null>(null);
  const [selMel, setSelMel] = useState('');
  const [placard, setPlacard] = useState('');
  const [deferRmk, setDeferRmk] = useState('');
  const [deferBusy, setDeferBusy] = useState(false);
  const [groundOpen, setGroundOpen] = useState(false);
  const [groundBusy, setGroundBusy] = useState(false);
  const [woBusy, setWoBusy] = useState(false);

  useEffect(() => {
    if (!deferMode) return;
    setMelLoading(true); setMelError(null); setMelItems([]); setSelMel('');
    (async () => {
      try {
        const fleet = await api.get<{ fleet: FleetAircraft[] }>('/api/admin/maintenance/fleet-status');
        const ac = fleet.fleet.find((a) => a.aircraftId === aircraftId);
        if (!ac) { setMelError('Aircraft not found in fleet.'); return; }
        const res = await api.get<{ items: MelMasterItem[] }>(`/api/admin/maintenance/mel-master?icaoType=${encodeURIComponent(ac.icaoType)}`);
        const prefix = d.ataChapter.split('-')[0];
        const filtered = res.items.filter((i) => i.ataChapter.startsWith(prefix));
        if (!filtered.length) setMelError(`Not on approved MEL for ${ac.icaoType} — must correct or ground aircraft.`);
        else setMelItems(filtered);
      } catch (e) { setMelError(e instanceof ApiError ? e.message : 'Failed to load MEL items'); }
      finally { setMelLoading(false); }
    })();
  }, [deferMode, aircraftId, d.ataChapter]);

  async function submitWO() {
    setWoBusy(true);
    try {
      await api.post('/api/admin/maintenance/work-orders', { aircraftId, discrepancyId: d.id, ataChapter: d.ataChapter, severity: d.severity });
      toast.success('Work order created'); onUpdated();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Failed to create work order'); }
    finally { setWoBusy(false); }
  }

  async function submitDefer() {
    if (!selMel) return;
    setDeferBusy(true);
    try {
      await api.post(`/api/admin/discrepancies/${d.id}/defer`, { melMasterId: parseInt(selMel), placardInfo: placard.trim() || undefined, remarks: deferRmk.trim() || undefined });
      toast.success('Discrepancy deferred via MEL'); onUpdated();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Failed to defer'); }
    finally { setDeferBusy(false); }
  }

  async function submitGround() {
    setGroundBusy(true);
    try {
      await api.post(`/api/admin/discrepancies/${d.id}/ground`);
      toast.success('Aircraft grounded'); setGroundOpen(false); onUpdated();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Failed to ground aircraft'); }
    finally { setGroundBusy(false); }
  }

  const melItem = melItems.find((m) => m.id.toString() === selMel);
  const selStyle = { background: 'var(--surface-3)', border: '1px solid var(--border-secondary)' };
  const inpStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', background: 'var(--surface-3)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)', outline: 'none' };
  const actBtn = (bg: string, clr: string, bdr?: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
    background: bg, color: clr, border: bdr ? `1px solid ${bdr}` : 'none', fontWeight: 600, cursor: 'pointer', transition: 'opacity 120ms',
  });

  return (
    <>
      <tr>
        <td colSpan={6} style={{ padding: 0, borderBottom: '1px solid var(--border-primary)', background: 'var(--surface-2)' }}>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Info grid */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div className="text-subheading" style={subLabel}>ATA Chapter</div>
                <div className="data-sm" style={{ color: 'var(--text-primary)' }}>
                  {d.ataChapter}{d.ataChapterTitle && <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontFamily: 'var(--font-sans)' }}>{d.ataChapterTitle}</span>}
                </div>
              </div>
              <div>
                <div className="text-subheading" style={subLabel}>Reported By</div>
                <div className="text-caption" style={{ color: 'var(--text-primary)' }}>{d.reportedByName ?? `User #${d.reportedBy}`}</div>
              </div>
              <div>
                <div className="text-subheading" style={subLabel}>Reported</div>
                <div className="text-caption font-mono" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(d.reportedAt)}</div>
              </div>
              {d.flightPhase && (
                <div>
                  <div className="text-subheading" style={subLabel}>Flight Phase</div>
                  <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>{d.flightPhase.replace(/_/g, ' ')}</div>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="text-subheading" style={{ ...subLabel, marginBottom: 4 }}>Description</div>
              <div className="text-caption" style={{ color: 'var(--text-primary)', lineHeight: 1.6, background: 'var(--surface-0)', padding: 10, border: '1px solid var(--border-primary)' }}>{d.description}</div>
            </div>

            {/* Resolved info */}
            {d.status === 'resolved' && d.resolvedAt && (
              <div>
                <div className="text-subheading" style={{ ...subLabel, marginBottom: 4 }}>Resolution</div>
                <div className="text-caption" style={{ marginBottom: 4 }}>
                  {d.resolutionType && <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.resolutionType.replace(/_/g, ' ')}</span>}
                  {' by '}{d.resolvedByName ?? `User #${d.resolvedBy}`}{' on '}<span className="font-mono">{formatDate(d.resolvedAt)}</span>
                </div>
                {d.correctiveAction && (
                  <div className="text-caption" style={{ color: 'var(--text-primary)', lineHeight: 1.6, background: 'var(--surface-0)', padding: 10, border: '1px solid var(--border-primary)' }}>{d.correctiveAction}</div>
                )}
              </div>
            )}

            {/* In maintenance */}
            {d.status === 'in_maintenance' && (
              <div className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan)', border: '1px solid rgba(34,211,238,0.2)', fontWeight: 600 }}>
                <Wrench size={14} /> Work order in progress — awaiting maintenance completion
              </div>
            )}

            {/* Deferred */}
            {d.status === 'deferred' && d.melDeferralId && (
              <div className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--accent-amber-bg)', color: 'var(--accent-amber)', border: '1px solid rgba(251,191,36,0.2)', fontWeight: 600 }}>
                <Clock size={14} /> Deferred via MEL (deferral #{d.melDeferralId})
              </div>
            )}

            {/* Action buttons */}
            {canAct && !deferMode && (
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                <button onClick={submitWO} disabled={woBusy} className="text-caption" style={{ ...actBtn('var(--accent-blue)', '#fff'), opacity: woBusy ? 0.6 : 1, cursor: woBusy ? 'not-allowed' : 'pointer' }}>
                  <Wrench size={13} /> {woBusy ? 'Submitting...' : 'Submit for Maintenance'}
                </button>
                <button onClick={() => setDeferMode(true)} className="text-caption" style={actBtn('var(--accent-amber-bg)', 'var(--accent-amber)', 'rgba(251,191,36,0.3)')}>
                  <Clock size={13} /> Defer via MEL
                </button>
                <button onClick={() => setGroundOpen(true)} className="text-caption" style={actBtn('var(--accent-red-bg)', 'var(--accent-red)', 'rgba(248,113,113,0.3)')}>
                  <ShieldAlert size={13} /> Ground Aircraft
                </button>
              </div>
            )}

            {/* MEL Defer form */}
            {canAct && deferMode && (
              <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border-primary)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-subheading" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Defer via MEL</span>
                  <button onClick={() => setDeferMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}><X size={14} /></button>
                </div>
                {melLoading && <div className="text-caption" style={{ padding: 8, color: 'var(--text-tertiary)' }}>Loading MEL items...</div>}
                {melError && (
                  <div className="text-caption" style={{ color: 'var(--accent-red)', background: 'var(--accent-red-bg)', padding: 10, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />{melError}
                  </div>
                )}
                {!melLoading && !melError && melItems.length > 0 && (<>
                  <div>
                    <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>MEL Item *</label>
                    <Select value={selMel} onValueChange={setSelMel}>
                      <SelectTrigger style={selStyle}><SelectValue placeholder="Select MEL item..." /></SelectTrigger>
                      <SelectContent>{melItems.map((i) => <SelectItem key={i.id} value={i.id.toString()}>{i.itemNumber} — {i.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {melItem && (
                    <div className="text-caption" style={{ background: 'var(--surface-2)', padding: 8, border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div><span style={{ color: 'var(--text-tertiary)' }}>Category: </span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{melItem.category}</span></div>
                      {melItem.rectificationInterval && <div><span style={{ color: 'var(--text-tertiary)' }}>Rectification: </span><span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{melItem.rectificationInterval} days</span></div>}
                      {melItem.remarks && <div><span style={{ color: 'var(--text-tertiary)' }}>Remarks: </span>{melItem.remarks}</div>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Placard Info <span style={{ color: 'var(--text-quaternary)' }}>(optional)</span></label>
                      <input type="text" value={placard} onChange={(e) => setPlacard(e.target.value)} placeholder="Optional placard info..." className="text-caption" style={inpStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="text-caption" style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>Remarks <span style={{ color: 'var(--text-quaternary)' }}>(optional)</span></label>
                      <input type="text" value={deferRmk} onChange={(e) => setDeferRmk(e.target.value)} placeholder="Optional remarks..." className="text-caption" style={inpStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setDeferMode(false)} className="text-caption" style={{ padding: '6px 14px', background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={submitDefer} disabled={deferBusy || !selMel} className="text-caption" style={{ padding: '6px 14px', background: 'var(--accent-amber)', color: '#000', border: 'none', fontWeight: 600, cursor: deferBusy || !selMel ? 'not-allowed' : 'pointer', opacity: deferBusy || !selMel ? 0.5 : 1 }}>{deferBusy ? 'Deferring...' : 'Submit Deferral'}</button>
                  </div>
                </>)}
              </div>
            )}
          </div>
        </td>
      </tr>

      <Dialog open={groundOpen} onOpenChange={setGroundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ground Aircraft</DialogTitle>
            <DialogDescription>
              Are you sure you want to ground {d.aircraftRegistration ?? `aircraft #${d.aircraftId}`}? This will take the aircraft out of service until the discrepancy is resolved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroundOpen(false)} disabled={groundBusy}>Cancel</Button>
            <Button variant="destructive" onClick={submitGround} disabled={groundBusy}>{groundBusy ? 'Grounding...' : 'Ground Aircraft'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═════════════════════════════════════════════════════════════
// Main DiscrepanciesTab
// ═════════════════════════════════════════════════════════════

export function DiscrepanciesTab({ aircraftId }: DiscrepanciesTabProps) {
  const [rows, setRows] = useState<Discrepancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const p = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString(), aircraftId: aircraftId.toString() });
      if (statusFilter !== 'all') p.set('status', statusFilter);
      if (search) p.set('search', search);
      const res = await api.get<{ discrepancies: Discrepancy[]; total: number }>(`/api/admin/discrepancies?${p}`);
      setRows(res.discrepancies); setTotal(res.total);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Failed to load discrepancies'); }
    finally { setLoading(false); }
  }, [aircraftId, page, pageSize, statusFilter, search]);

  useEffect(() => { fetch(); }, [fetch]);

  function onUpdated() { setExpandedId(null); fetch(); }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pills = [
    { key: 'all', label: 'All' }, { key: 'open', label: 'Open' }, { key: 'in_review', label: 'In Review' },
    { key: 'deferred', label: 'Deferred' }, { key: 'in_maintenance', label: 'In Maint' }, { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderBottom: '1px solid var(--border-primary)' }}>
        <div style={{ position: 'relative', width: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="text-caption"
            style={{ width: '100%', height: 30, paddingLeft: 30, paddingRight: 10, background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-1)', padding: 2 }}>
          {pills.map((p) => (
            <button key={p.key} onClick={() => { setStatusFilter(p.key); setPage(1); }} className="text-caption" style={{
              padding: '3px 10px', border: 'none', cursor: 'pointer', fontWeight: 600,
              background: statusFilter === p.key ? 'var(--accent-blue-bg)' : 'transparent',
              color: statusFilter === p.key ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)', transition: 'all 120ms',
            }}>{p.label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCreateOpen(!createOpen)} className="text-caption" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px',
          background: createOpen ? 'var(--surface-2)' : 'var(--accent-blue)',
          color: createOpen ? 'var(--text-secondary)' : '#fff',
          border: createOpen ? '1px solid var(--border-primary)' : 'none', fontWeight: 600, cursor: 'pointer',
        }}>{createOpen ? <X size={13} /> : <Plus size={13} />}{createOpen ? 'Cancel' : '+ Discrepancy'}</button>
      </div>

      {/* Create form */}
      {createOpen && <CreateForm aircraftId={aircraftId} onCreated={() => { setCreateOpen(false); fetch(); }} onClose={() => setCreateOpen(false)} />}

      {/* Table */}
      {loading ? (
        <div style={{ padding: 24 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 38, border: '1px solid var(--panel-border)', marginBottom: 4, opacity: 0.5 }} className="animate-pulse" />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="text-subheading" style={{ ...hdr, width: 70 }}>ATA</th>
                <th className="text-subheading" style={hdr}>DESCRIPTION</th>
                <th className="text-subheading" style={{ ...hdr, width: 55 }}>SEV</th>
                <th className="text-subheading" style={{ ...hdr, width: 110 }}>STATUS</th>
                <th className="text-subheading" style={{ ...hdr, width: 80 }}>DATE</th>
                <th className="text-subheading" style={{ ...hdr, width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="text-body" style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No discrepancies found</td></tr>
              ) : rows.map((d) => {
                const exp = expandedId === d.id;
                return (
                  <React.Fragment key={d.id}>
                    <tr onClick={() => setExpandedId(exp ? null : d.id)} style={{
                      cursor: 'pointer', background: exp ? 'var(--accent-blue-bg)' : 'transparent',
                      outline: exp ? '1px solid var(--accent-blue)' : 'none', outlineOffset: -1,
                    }} onMouseEnter={(e) => { if (!exp) e.currentTarget.style.background = 'var(--tint-subtle)'; }}
                      onMouseLeave={(e) => { if (!exp) e.currentTarget.style.background = 'transparent'; }}>
                      <td className="text-caption font-mono" style={{ ...cell, fontWeight: 600, color: 'var(--text-primary)' }}>{d.ataChapter}</td>
                      <td className="text-caption" style={{ ...cell, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncate(d.description, 60)}</td>
                      <td className="text-caption" style={cell}><SevBadge severity={d.severity} /></td>
                      <td className="text-caption" style={cell}><StatBadge status={d.status} /></td>
                      <td className="text-caption font-mono" style={{ ...cell, color: 'var(--text-tertiary)' }}>{relTime(d.reportedAt)}</td>
                      <td className="text-caption" style={{ ...cell, textAlign: 'center', color: 'var(--text-quaternary)' }}>{exp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                    </tr>
                    {exp && <ExpandedRow discrepancy={d} aircraftId={aircraftId} onUpdated={onUpdated} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > pageSize && (
        <div className="text-caption" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px', borderTop: '1px solid var(--border-primary)' }}>
          <span>{`${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{
              background: 'none', border: '1px solid var(--border-primary)', padding: '4px 8px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer', color: page <= 1 ? 'var(--text-quaternary)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', opacity: page <= 1 ? 0.5 : 1,
            }}><ChevronLeft size={14} /></button>
            <span className="data-sm" style={{ padding: '0 8px', color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{
              background: 'none', border: '1px solid var(--border-primary)', padding: '4px 8px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: page >= totalPages ? 'var(--text-quaternary)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', opacity: page >= totalPages ? 0.5 : 1,
            }}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

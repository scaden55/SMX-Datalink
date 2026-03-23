import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Plane,
  Search,
  Plus,
  Download,
  Loader2,
  Link2,
  AlertTriangle,
  MoreVertical,
  Trash2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  pageVariants,
  staggerContainer,
  staggerItem,
  fadeUp,
  cardHover,
  cardTap,
} from '@/lib/motion';
import type { CreateFleetAircraftRequest, FleetStatus, SimBriefAircraftType, SimBriefAircraftSearchResponse } from '@acars/shared';

// ── Types ──────────────────────────────────────────────

interface FleetAircraft {
  id: number;
  icaoType: string;
  name: string;
  registration: string;
  rangeNm: number;
  cruiseSpeed: number;
  paxCapacity: number;
  cargoCapacityLbs: number;
  isActive: boolean;
  status: string;
  baseIcao: string | null;
  locationIcao: string | null;
  isCargo: boolean;
  configuration: string | null;
  aircraftClass: 'I' | 'II' | 'III';
  reservedByPilot: string | null;
  bidFlightPhase: string | null;
}

interface AircraftStats {
  totalFlights: number;
  totalHours: number;
  lastFlightDate: string | null;
  avgScore: number | null;
  avgLandingRate: number | null;
}

// ── Helpers ────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case 'active':
      return { bg: 'var(--surface-2)', text: 'var(--text-secondary)', label: 'Active' };
    case 'maintenance':
      return { bg: 'rgba(251, 191, 36, 0.12)', text: 'var(--accent-amber)', label: 'Maintenance' };
    case 'stored':
      return { bg: 'var(--surface-2)', text: 'var(--text-tertiary)', label: 'Stored' };
    case 'retired':
      return { bg: 'var(--accent-red-bg)', text: 'var(--accent-red)', label: 'Retired' };
    default:
      return { bg: 'var(--surface-3)', text: 'var(--text-tertiary)', label: status };
  }
}

const MX_CHECKS = [
  { label: 'A', interval: 100 },
  { label: 'B', interval: 250 },
  { label: 'C', interval: 750 },
] as const;

function checkColor(remaining: number, interval: number): string {
  const pct = remaining / interval;
  if (pct > 0.3) return 'var(--accent-emerald)';
  if (pct > 0.1) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

// ── Component ──────────────────────────────────────────

export function FleetPage() {
  const navigate = useNavigate();
  const [fleet, setFleet] = useState<FleetAircraft[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, AircraftStats>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    icaoType: '',
    name: '',
    registration: '',
    rangeNm: '',
    cruiseSpeed: '',
    paxCapacity: '',
    cargoCapacityLbs: '',
    isCargo: true,
    // Extended fields from SimBrief
    oewLbs: '',
    mzfwLbs: '',
    mtowLbs: '',
    mlwLbs: '',
    maxFuelLbs: '',
    ceilingFt: '',
    engines: '',
    equipCode: '',
    transponderCode: '',
    pbn: '',
    cat: '',
    // Financing fields
    acquisitionType: 'purchased' as 'purchased' | 'loan' | 'dry_lease' | 'wet_lease' | 'acmi',
    acquisitionCost: '',
    usefulLifeYears: '',
    downPayment: '',
    interestRate: '',
    loanTermMonths: '',
    leaseMonthly: '',
    leaseStart: '',
    leaseEnd: '',
    insuranceMonthly: '',
  });

  // SimBrief search state (in Add dialog)
  const [sbQuery, setSbQuery] = useState('');
  const [sbResults, setSbResults] = useState<SimBriefAircraftType[]>([]);
  const [sbSearching, setSbSearching] = useState(false);
  const [sbShowResults, setSbShowResults] = useState(false);

  // SimBrief Import dialog state
  const [importOpen, setImportOpen] = useState(false);
  const [importQuery, setImportQuery] = useState('');
  const [importResults, setImportResults] = useState<SimBriefAircraftType[]>([]);
  const [importSearching, setImportSearching] = useState(false);
  const [importRegs, setImportRegs] = useState<Record<string, string>>({});
  const [importingKey, setImportingKey] = useState<string | null>(null);

  // Share link import state
  const [shareUrl, setShareUrl] = useState('');
  const [shareParsing, setShareParsing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<SimBriefAircraftType | null>(null);
  const [shareReg, setShareReg] = useState('');
  const [shareImporting, setShareImporting] = useState(false);

  // Action menu + delete state
  const [menuAcId, setMenuAcId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FleetAircraft | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchFleet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ fleet: FleetAircraft[]; total: number }>('/api/fleet/manage');
      setFleet(res.fleet);

      const statsEntries = await Promise.all(
        res.fleet.slice(0, 30).map(async (ac) => {
          try {
            const stats = await api.get<AircraftStats>(`/api/fleet/manage/${ac.id}/stats`);
            return [ac.id, stats] as const;
          } catch {
            return null;
          }
        }),
      );
      const map: Record<number, AircraftStats> = {};
      for (const entry of statsEntries) {
        if (entry) map[entry[0]] = entry[1];
      }
      setStatsMap(map);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  const handleAddAircraft = async () => {
    if (!addForm.icaoType || !addForm.name || !addForm.registration) {
      toast.error('ICAO type, name, and registration are required');
      return;
    }
    setAddSaving(true);
    try {
      const body: CreateFleetAircraftRequest = {
        icaoType: addForm.icaoType,
        name: addForm.name,
        registration: addForm.registration,
        rangeNm: Number(addForm.rangeNm) || 0,
        cruiseSpeed: Number(addForm.cruiseSpeed) || 0,
        paxCapacity: Number(addForm.paxCapacity) || 0,
        cargoCapacityLbs: Number(addForm.cargoCapacityLbs) || 0,
        isCargo: addForm.isCargo,
        // Extended specs from SimBrief
        ...(addForm.oewLbs ? { oewLbs: Number(addForm.oewLbs) } : {}),
        ...(addForm.mzfwLbs ? { mzfwLbs: Number(addForm.mzfwLbs) } : {}),
        ...(addForm.mtowLbs ? { mtowLbs: Number(addForm.mtowLbs) } : {}),
        ...(addForm.mlwLbs ? { mlwLbs: Number(addForm.mlwLbs) } : {}),
        ...(addForm.maxFuelLbs ? { maxFuelLbs: Number(addForm.maxFuelLbs) } : {}),
        ...(addForm.ceilingFt ? { ceilingFt: Number(addForm.ceilingFt) } : {}),
        ...(addForm.engines ? { engines: addForm.engines } : {}),
        ...(addForm.equipCode ? { equipCode: addForm.equipCode } : {}),
        ...(addForm.transponderCode ? { transponderCode: addForm.transponderCode } : {}),
        ...(addForm.pbn ? { pbn: addForm.pbn } : {}),
        ...(addForm.cat ? { cat: addForm.cat } : {}),
      };
      const created = await api.post<{ id: number }>('/api/fleet/manage', body);

      // Save financing data if any fields are filled
      const finBody: Record<string, unknown> = { acquisitionType: addForm.acquisitionType };
      const stripCommas = (v: string) => v.replace(/,/g, '');
      if (addForm.acquisitionType === 'purchased') {
        if (addForm.acquisitionCost) finBody.acquisitionCost = Number(stripCommas(addForm.acquisitionCost));
        if (addForm.usefulLifeYears) finBody.usefulLifeYears = Number(addForm.usefulLifeYears);
      } else if (addForm.acquisitionType === 'loan') {
        if (addForm.acquisitionCost) finBody.acquisitionCost = Number(stripCommas(addForm.acquisitionCost));
        if (addForm.downPayment) finBody.downPayment = Number(stripCommas(addForm.downPayment));
        if (addForm.interestRate) finBody.interestRate = Number(addForm.interestRate);
        if (addForm.loanTermMonths) finBody.loanTermMonths = Number(addForm.loanTermMonths);
      } else {
        if (addForm.leaseMonthly) finBody.leaseMonthly = Number(stripCommas(addForm.leaseMonthly));
        if (addForm.leaseStart) finBody.leaseStart = addForm.leaseStart;
        if (addForm.leaseEnd) finBody.leaseEnd = addForm.leaseEnd;
      }
      if (addForm.acquisitionType !== 'acmi' && addForm.insuranceMonthly) {
        finBody.insuranceMonthly = Number(stripCommas(addForm.insuranceMonthly));
      }
      if (Object.keys(finBody).length > 1) {
        try {
          await api.patch(`/api/admin/economics/fleet-financials/${created.id}`, finBody);
        } catch {
          toast.warning('Aircraft created but financing data failed to save');
        }
      }

      toast.success(`Aircraft ${body.registration} created`);
      resetAddDialog();
      fetchFleet();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create aircraft');
    } finally {
      setAddSaving(false);
    }
  };

  const searchSimBrief = useCallback(async (q: string) => {
    setSbQuery(q);
    if (q.length < 2) { setSbResults([]); setSbShowResults(false); return; }
    setSbSearching(true);
    try {
      const res = await api.get<SimBriefAircraftSearchResponse>(`/api/fleet/simbrief/aircraft?q=${encodeURIComponent(q)}`);
      setSbResults(res.aircraft.slice(0, 20));
      setSbShowResults(true);
    } catch {
      setSbResults([]);
    } finally {
      setSbSearching(false);
    }
  }, []);

  const selectSimBriefProfile = (profile: SimBriefAircraftType) => {
    setAddForm((prev) => ({
      ...prev,
      icaoType: profile.aircraftIcao,
      name: profile.aircraftName,
      registration: '', // User must fill
      rangeNm: '',
      cruiseSpeed: String(profile.speed || ''),
      paxCapacity: String(profile.passengers || '0'),
      cargoCapacityLbs: '',
      isCargo: profile.isCargo,
      oewLbs: String(profile.oewLbs || ''),
      mzfwLbs: String(profile.mzfwLbs || ''),
      mtowLbs: String(profile.mtowLbs || ''),
      mlwLbs: String(profile.mlwLbs || ''),
      maxFuelLbs: String(profile.maxFuelLbs || ''),
      ceilingFt: String(profile.ceilingFt || ''),
      engines: profile.engines || '',
      equipCode: profile.equipCode || '',
      transponderCode: profile.transponderCode || '',
      pbn: profile.pbn || '',
      cat: profile.cat || '',
    }));
    setSbShowResults(false);
    setSbQuery('');
    toast.success(`Imported ${profile.aircraftIcao} — ${profile.aircraftName}`);
  };

  const resetAddDialog = () => {
    setAddOpen(false);
    setAddForm({ icaoType: '', name: '', registration: '', rangeNm: '', cruiseSpeed: '', paxCapacity: '', cargoCapacityLbs: '', isCargo: true, oewLbs: '', mzfwLbs: '', mtowLbs: '', mlwLbs: '', maxFuelLbs: '', ceilingFt: '', engines: '', equipCode: '', transponderCode: '', pbn: '', cat: '', acquisitionType: 'purchased', acquisitionCost: '', usefulLifeYears: '', downPayment: '', interestRate: '', loanTermMonths: '', leaseMonthly: '', leaseStart: '', leaseEnd: '', insuranceMonthly: '' });
    setSbQuery('');
    setSbResults([]);
    setSbShowResults(false);
  };

  const searchImportSimBrief = useCallback(async (q: string) => {
    setImportQuery(q);
    if (q.length < 2) { setImportResults([]); return; }
    setImportSearching(true);
    try {
      const res = await api.get<SimBriefAircraftSearchResponse>(`/api/fleet/simbrief/aircraft?q=${encodeURIComponent(q)}`);
      setImportResults(res.aircraft.slice(0, 30));
    } catch {
      setImportResults([]);
    } finally {
      setImportSearching(false);
    }
  }, []);

  const handleImportProfile = async (profile: SimBriefAircraftType) => {
    const key = `${profile.aircraftIcao}-${profile.aircraftName}`;
    const reg = importRegs[key]?.trim();
    if (!reg) { toast.error('Enter a registration for this aircraft'); return; }

    setImportingKey(key);
    try {
      const body: CreateFleetAircraftRequest = {
        icaoType: profile.aircraftIcao,
        name: profile.aircraftName,
        registration: reg,
        rangeNm: 0,
        cruiseSpeed: profile.speed || 0,
        paxCapacity: profile.passengers || 0,
        cargoCapacityLbs: 0,
        isCargo: profile.isCargo,
        oewLbs: profile.oewLbs || undefined,
        mzfwLbs: profile.mzfwLbs || undefined,
        mtowLbs: profile.mtowLbs || undefined,
        mlwLbs: profile.mlwLbs || undefined,
        maxFuelLbs: profile.maxFuelLbs || undefined,
        ceilingFt: profile.ceilingFt || undefined,
        engines: profile.engines || undefined,
        equipCode: profile.equipCode || undefined,
        transponderCode: profile.transponderCode || undefined,
        pbn: profile.pbn || undefined,
        cat: profile.cat || undefined,
      };
      await api.post('/api/fleet/manage', body);
      toast.success(`${reg} (${profile.aircraftIcao}) imported`);
      setImportRegs((p) => { const next = { ...p }; delete next[key]; return next; });
      fetchFleet();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to import aircraft');
    } finally {
      setImportingKey(null);
    }
  };

  const resetImportDialog = () => {
    setImportOpen(false);
    setImportQuery('');
    setImportResults([]);
    setImportRegs({});
    setImportingKey(null);
    setShareUrl('');
    setShareParsing(false);
    setShareError(null);
    setShareResult(null);
    setShareReg('');
    setShareImporting(false);
  };

  const handleParseShareLink = async () => {
    if (!shareUrl.trim()) return;
    setShareParsing(true);
    setShareError(null);
    setShareResult(null);
    try {
      const res = await api.post<{ source: string; aircraft: SimBriefAircraftType & { registration?: string; selcal?: string; hexCode?: string; maxCargo?: number } }>('/api/fleet/simbrief/parse-share', { url: shareUrl });
      setShareResult(res.aircraft);
      if (res.aircraft.registration) setShareReg(res.aircraft.registration);
      toast.success(`Parsed ${res.aircraft.aircraftIcao} — ${res.aircraft.aircraftName}`);
    } catch (err: any) {
      setShareError(err?.message ?? 'Failed to parse share link');
    } finally {
      setShareParsing(false);
    }
  };

  const handleImportShareResult = async () => {
    if (!shareResult) return;
    const reg = shareReg.trim();
    if (!reg) { toast.error('Enter a registration'); return; }
    setShareImporting(true);
    try {
      const body: CreateFleetAircraftRequest = {
        icaoType: shareResult.aircraftIcao,
        name: shareResult.aircraftName,
        registration: reg,
        rangeNm: 0,
        cruiseSpeed: shareResult.speed || 0,
        paxCapacity: shareResult.passengers || 0,
        cargoCapacityLbs: (shareResult as any).maxCargo || 0,
        isCargo: shareResult.isCargo,
        oewLbs: shareResult.oewLbs || undefined,
        mzfwLbs: shareResult.mzfwLbs || undefined,
        mtowLbs: shareResult.mtowLbs || undefined,
        mlwLbs: shareResult.mlwLbs || undefined,
        maxFuelLbs: shareResult.maxFuelLbs || undefined,
        ceilingFt: shareResult.ceilingFt || undefined,
        engines: shareResult.engines || undefined,
        equipCode: shareResult.equipCode || undefined,
        transponderCode: shareResult.transponderCode || undefined,
        pbn: shareResult.pbn || undefined,
        cat: shareResult.cat || undefined,
      };
      await api.post('/api/fleet/manage', body);
      toast.success(`${reg} (${shareResult.aircraftIcao}) imported from share link`);
      setShareResult(null);
      setShareUrl('');
      setShareReg('');
      setShareError(null);
      fetchFleet();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to import aircraft');
    } finally {
      setShareImporting(false);
    }
  };

  // ── CRUD handlers ────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/fleet/manage/${deleteTarget.id}`);
      toast.success(`${deleteTarget.registration} deleted`);
      setDeleteTarget(null);
      fetchFleet();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete aircraft');
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (ac: FleetAircraft, newStatus: FleetStatus) => {
    setMenuAcId(null);
    try {
      await api.patch(`/api/fleet/manage/${ac.id}`, { status: newStatus });
      setFleet((prev) => prev.map((a) => a.id === ac.id ? { ...a, status: newStatus, isActive: newStatus === 'active' || newStatus === 'stored' } : a));
      toast.success(`${ac.registration} → ${newStatus}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update status');
    }
  };

  // Close action menu on click outside
  useEffect(() => {
    if (!menuAcId) return;
    const close = () => setMenuAcId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuAcId]);

  const filtered = useMemo(() => {
    let items = fleet;
    if (statusFilter !== 'all') items = items.filter((a) => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (a) =>
          a.registration.toLowerCase().includes(q) ||
          a.icaoType.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q),
      );
    }
    return items;
  }, [fleet, statusFilter, search]);

  const counts = useMemo(
    () => ({
      total: fleet.length,
      active: fleet.filter((a) => a.status === 'active').length,
      maintenance: fleet.filter((a) => a.status === 'maintenance').length,
      totalHours: Object.values(statsMap).reduce((sum, s) => sum + s.totalHours, 0),
    }),
    [fleet, statsMap],
  );

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div
        className="flex flex-col"
        style={{ padding: '16px 24px 12px', gap: 12 }}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        {/* Title row */}
        <div className="flex items-center" style={{ gap: 12 }}>
          <Plane size={20} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Fleet Management</span>
          <div className="flex-1" />
          {/* Search */}
          <div
            className="flex items-center input-glow"
            style={{
              gap: 8,
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search aircraft..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none"
              style={{ fontSize: 12, color: 'var(--text-primary)', width: 140 }}
            />
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center border-none cursor-pointer btn-glow"
            style={{
              gap: 6,
              padding: '8px 14px',
              borderRadius: 6,
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              border: '1px solid var(--border-primary)',
            }}
          >
            <Download size={14} />
            Import SimBrief
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center border-none cursor-pointer"
            style={{
              gap: 6,
              padding: '8px 14px',
              borderRadius: 6,
              backgroundColor: 'var(--accent-blue)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Plus size={14} />
            Add Aircraft
          </button>
        </div>

        {/* Stat cards */}
        <motion.div
          className="flex"
          style={{ gap: 12 }}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <StatCard label="Total Aircraft" value={counts.total} delay={0} />
          <StatCard label="Active" value={counts.active} color="var(--accent-emerald)" delay={1} />
          <StatCard label="In Maintenance" value={counts.maintenance} color="var(--accent-amber)" delay={2} />
          <StatCard label="Total Hours" value={counts.totalHours.toLocaleString()} delay={3} />
        </motion.div>
      </motion.div>

      {/* Grid */}
      {loading ? (
        <div className="flex-1 overflow-y-auto" style={{ padding: '0 24px 24px 24px' }}>
          <div className="grid grid-cols-3" style={{ gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shimmer"
                style={{ height: 180, borderRadius: 6 }}
              />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          className="flex items-center justify-center flex-1"
          style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          No aircraft found
        </motion.div>
      ) : (
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '0 24px 24px 24px' }}
        >
          <motion.div
            className="grid grid-cols-3"
            style={{ gap: 16 }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {filtered.map((ac) => {
              const stats = statsMap[ac.id];
              const badge = statusBadge(ac.status);

              return (
                <motion.div
                  key={ac.id}
                  className="flex flex-col card-interactive cursor-pointer"
                  style={{
                    borderRadius: 6,
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border-primary)',
                    position: 'relative',
                    zIndex: menuAcId === ac.id ? 10 : 'auto',
                  }}
                  variants={staggerItem}
                  whileHover={cardHover}
                  whileTap={cardTap}
                  onClick={() => navigate(`/fleet/${ac.id}`)}
                >
                  {/* Registration + status + action menu */}
                  <div className="flex items-center" style={{ padding: '10px 16px', gap: 8, position: 'relative' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{ac.registration}</span>
                    <div className="flex-1" />
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        backgroundColor: badge.bg,
                        color: badge.text,
                      }}
                    >
                      {badge.label}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuAcId(menuAcId === ac.id ? null : ac.id); }}
                      className="flex items-center justify-center border-none cursor-pointer"
                      style={{
                        width: 24, height: 24, borderRadius: 4,
                        backgroundColor: menuAcId === ac.id ? 'var(--surface-3)' : 'transparent',
                        color: 'var(--text-tertiary)',
                        padding: 0,
                      }}
                    >
                      <MoreVertical size={14} />
                    </button>

                    {/* Action dropdown */}
                    {menuAcId === ac.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-col"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 12,
                          zIndex: 50,
                          minWidth: 160,
                          borderRadius: 6,
                          backgroundColor: 'var(--surface-3)',
                          border: '1px solid var(--border-primary)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                          padding: '4px 0',
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          onClick={() => { setMenuAcId(null); navigate(`/fleet/${ac.id}`); }}
                          className="flex items-center border-none cursor-pointer"
                          style={{ gap: 8, padding: '8px 12px', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-4)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <ExternalLink size={13} /> Edit Details
                        </button>
                        <div style={{ height: 1, backgroundColor: 'var(--border-primary)', margin: '4px 0' }} />
                        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', padding: '4px 12px', letterSpacing: 0.5 }}>STATUS</span>
                        {(['active', 'maintenance', 'stored', 'retired'] as FleetStatus[]).map((s) => {
                          const b = statusBadge(s);
                          return (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(ac, s)}
                              className="flex items-center border-none cursor-pointer"
                              style={{ gap: 8, padding: '6px 12px', backgroundColor: 'transparent', color: ac.status === s ? b.text : 'var(--text-secondary)', fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: ac.status === s ? 600 : 400, width: '100%', textAlign: 'left' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-4)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <RefreshCw size={11} /> {b.label} {ac.status === s && '✓'}
                            </button>
                          );
                        })}
                        <div style={{ height: 1, backgroundColor: 'var(--border-primary)', margin: '4px 0' }} />
                        <button
                          onClick={() => { setDeleteTarget(ac); setMenuAcId(null); }}
                          className="flex items-center border-none cursor-pointer"
                          style={{ gap: 8, padding: '8px 12px', backgroundColor: 'transparent', color: 'var(--accent-red)', fontSize: 12, fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Trash2 size={13} /> Delete Aircraft
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Aircraft name + type + class */}
                  <div className="flex flex-col" style={{ padding: '0 16px 8px 16px', gap: 2 }}>
                    <div className="flex items-center" style={{ gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ac.name}</span>
                      <span
                        style={{
                          fontSize: 8,
                          padding: '1px 5px',
                          borderRadius: 3,
                          backgroundColor: 'var(--accent-blue-bg)',
                          color: 'var(--accent-blue-bright)',
                          fontWeight: 600,
                          letterSpacing: 0.3,
                          flexShrink: 0,
                        }}
                      >
                        CLASS {ac.aircraftClass}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{ac.icaoType}</span>
                  </div>

                  {/* Stats row */}
                  <div
                    className="flex items-center"
                    style={{ padding: '8px 16px', gap: 12, borderTop: '1px solid var(--border-primary)' }}
                  >
                    <div className="flex flex-col" style={{ gap: 2 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Hours</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {stats?.totalHours.toLocaleString() ?? '0'}
                      </span>
                    </div>
                    <div className="flex flex-col" style={{ gap: 2 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Cycles</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {stats?.totalFlights.toLocaleString() ?? '0'}
                      </span>
                    </div>
                    <div className="flex-1" />
                    <div className="flex flex-col" style={{ gap: 2 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>Range</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ac.rangeNm.toLocaleString()} nm
                      </span>
                    </div>
                  </div>

                  {/* Maintenance checks */}
                  <div className="flex" style={{ padding: '6px 16px 10px 16px', gap: 6 }}>
                    {MX_CHECKS.map(({ label, interval }) => {
                      const hrs = stats?.totalHours ?? 0;
                      const used = hrs % interval;
                      const remaining = interval - used;
                      const pct = (used / interval) * 100;
                      const color = checkColor(remaining, interval);
                      return (
                        <div key={label} className="flex-1 flex flex-col" style={{ gap: 3 }}>
                          <div className="flex items-center justify-between">
                            <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: '0.05em' }}>{label}</span>
                            <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                              {remaining.toFixed(0)}h
                            </span>
                          </div>
                          <div style={{ height: 3, borderRadius: 2, backgroundColor: 'var(--input-bg)' }}>
                            <div
                              className="bar-animate"
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                borderRadius: 2,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
      {/* Add Aircraft Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) resetAddDialog(); else setAddOpen(true); }}>
        <DialogContent
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
            maxWidth: 560,
            maxHeight: '85vh',
            overflowY: 'auto',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontSize: 16, fontWeight: 700 }}>Add Aircraft</DialogTitle>
            <DialogDescription style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Import from SimBrief or fill in manually.
            </DialogDescription>
          </DialogHeader>

          {/* SimBrief Import */}
          <div className="flex flex-col" style={{ gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>IMPORT FROM SIMBRIEF</span>
            <div className="flex items-center" style={{ position: 'relative' }}>
              <div
                className="flex items-center flex-1 input-glow"
                style={{
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 4,
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                }}
              >
                <Download size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search SimBrief airframes... (e.g. B738, A320, 737)"
                  value={sbQuery}
                  onChange={(e) => searchSimBrief(e.target.value)}
                  onFocus={() => { if (sbResults.length > 0) setSbShowResults(true); }}
                  className="bg-transparent border-none outline-none flex-1"
                  style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
                />
                {sbSearching && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />}
              </div>
              {/* Dropdown results */}
              {sbShowResults && sbResults.length > 0 && (
                <div
                  className="flex flex-col"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    maxHeight: 200,
                    overflowY: 'auto',
                    borderRadius: 6,
                    backgroundColor: 'var(--surface-1)',
                    border: '1px solid var(--border-primary)',
                    zIndex: 50,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {sbResults.map((profile, i) => (
                    <button
                      key={`${profile.aircraftIcao}-${i}`}
                      onClick={() => selectSimBriefProfile(profile)}
                      className="flex items-center w-full border-none bg-transparent cursor-pointer row-interactive text-left"
                      style={{
                        gap: 10,
                        padding: '8px 12px',
                        borderBottom: i < sbResults.length - 1 ? '1px solid var(--border-primary)' : 'none',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue-bright)', width: 50, flexShrink: 0 }}>{profile.aircraftIcao}</span>
                      <span className="flex-1" style={{ fontSize: 11, color: 'var(--text-primary)' }}>{profile.aircraftName}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{profile.engines}</span>
                      {profile.isCargo && (
                        <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, backgroundColor: 'rgba(251, 191, 36, 0.12)', color: 'var(--accent-amber)', fontWeight: 600 }}>CARGO</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: 'var(--border-primary)', margin: '4px 0' }} />

          {/* Form fields */}
          <div className="flex flex-col" style={{ gap: 10 }}>
            <div className="flex" style={{ gap: 12 }}>
              <AddField label="Registration *" value={addForm.registration} onChange={(v) => setAddForm((p) => ({ ...p, registration: v }))} placeholder="N821PM" />
              <AddField label="ICAO Type *" value={addForm.icaoType} onChange={(v) => setAddForm((p) => ({ ...p, icaoType: v }))} placeholder="B738" />
            </div>
            <AddField label="Aircraft Name *" value={addForm.name} onChange={(v) => setAddForm((p) => ({ ...p, name: v }))} placeholder="Boeing 737-800 BDSF" />
            <div className="flex" style={{ gap: 12 }}>
              <AddField label="Cruise Speed (kts)" value={addForm.cruiseSpeed} onChange={(v) => setAddForm((p) => ({ ...p, cruiseSpeed: v }))} type="number" placeholder="453" />
              <AddField label="Range (nm)" value={addForm.rangeNm} onChange={(v) => setAddForm((p) => ({ ...p, rangeNm: v }))} type="number" placeholder="2935" />
              <AddField label="Ceiling (ft)" value={addForm.ceilingFt} onChange={(v) => setAddForm((p) => ({ ...p, ceilingFt: v }))} type="number" placeholder="41000" />
            </div>
            <div className="flex" style={{ gap: 12 }}>
              <AddField label="MTOW (lbs)" value={addForm.mtowLbs} onChange={(v) => setAddForm((p) => ({ ...p, mtowLbs: v }))} type="number" placeholder="174200" />
              <AddField label="MLW (lbs)" value={addForm.mlwLbs} onChange={(v) => setAddForm((p) => ({ ...p, mlwLbs: v }))} type="number" placeholder="144000" />
              <AddField label="OEW (lbs)" value={addForm.oewLbs} onChange={(v) => setAddForm((p) => ({ ...p, oewLbs: v }))} type="number" placeholder="91300" />
            </div>
            <div className="flex" style={{ gap: 12 }}>
              <AddField label="MZFW (lbs)" value={addForm.mzfwLbs} onChange={(v) => setAddForm((p) => ({ ...p, mzfwLbs: v }))} type="number" placeholder="138300" />
              <AddField label="Max Fuel (lbs)" value={addForm.maxFuelLbs} onChange={(v) => setAddForm((p) => ({ ...p, maxFuelLbs: v }))} type="number" placeholder="46063" />
              <AddField label="Engines" value={addForm.engines} onChange={(v) => setAddForm((p) => ({ ...p, engines: v }))} placeholder="2x CFM56-7B" />
            </div>
            <div className="flex" style={{ gap: 12 }}>
              <AddField label="Pax Capacity" value={addForm.paxCapacity} onChange={(v) => setAddForm((p) => ({ ...p, paxCapacity: v }))} type="number" placeholder="0" />
              <AddField label="Cargo Capacity (lbs)" value={addForm.cargoCapacityLbs} onChange={(v) => setAddForm((p) => ({ ...p, cargoCapacityLbs: v }))} type="number" placeholder="46000" />
            </div>
            <div className="flex items-center" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={addForm.isCargo}
                onChange={(e) => setAddForm((p) => ({ ...p, isCargo: e.target.checked }))}
                style={{ accentColor: 'var(--accent-blue)' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Cargo aircraft</span>
            </div>
          </div>

          {/* ── Financing Section ─────────────────────────── */}
          <div className="flex items-center" style={{ gap: 10, margin: '4px 0 0 0' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-primary)' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>FINANCING</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-primary)' }} />
          </div>

          <div className="flex flex-col" style={{ gap: 10 }}>
            {/* Acquisition type */}
            <div className="flex flex-col flex-1" style={{ gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>Acquisition Type</span>
              <select
                value={addForm.acquisitionType}
                onChange={(e) => setAddForm((p) => ({ ...p, acquisitionType: e.target.value as typeof addForm.acquisitionType }))}
                className="input-glow"
                style={{
                  padding: '8px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100%',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                }}
              >
                <option value="purchased">Purchased</option>
                <option value="loan">Loan</option>
                <option value="dry_lease">Dry Lease</option>
                <option value="wet_lease">Wet Lease</option>
                <option value="acmi">ACMI</option>
              </select>
            </div>

            {/* Purchased fields */}
            {addForm.acquisitionType === 'purchased' && (
              <div className="flex" style={{ gap: 12 }}>
                <CostField label="Acquisition Cost ($)" value={addForm.acquisitionCost} onChange={(v) => setAddForm((p) => ({ ...p, acquisitionCost: v }))} placeholder="126,483,000" />
                <AddField label="Useful Life (years)" value={addForm.usefulLifeYears} onChange={(v) => setAddForm((p) => ({ ...p, usefulLifeYears: v }))} type="number" placeholder="25" />
              </div>
            )}

            {/* Loan fields */}
            {addForm.acquisitionType === 'loan' && (
              <>
                <div className="flex" style={{ gap: 12 }}>
                  <CostField label="Acquisition Cost ($)" value={addForm.acquisitionCost} onChange={(v) => setAddForm((p) => ({ ...p, acquisitionCost: v }))} placeholder="126,483,000" />
                  <CostField label="Down Payment ($)" value={addForm.downPayment} onChange={(v) => setAddForm((p) => ({ ...p, downPayment: v }))} placeholder="25,000,000" />
                </div>
                <div className="flex" style={{ gap: 12 }}>
                  <AddField label="Interest Rate (%)" value={addForm.interestRate} onChange={(v) => setAddForm((p) => ({ ...p, interestRate: v }))} type="number" placeholder="4.5" />
                  <AddField label="Loan Term (months)" value={addForm.loanTermMonths} onChange={(v) => setAddForm((p) => ({ ...p, loanTermMonths: v }))} type="number" placeholder="180" />
                </div>
              </>
            )}

            {/* Lease fields (dry_lease, wet_lease, acmi) */}
            {(addForm.acquisitionType === 'dry_lease' || addForm.acquisitionType === 'wet_lease' || addForm.acquisitionType === 'acmi') && (
              <>
                <CostField label="Monthly Lease ($)" value={addForm.leaseMonthly} onChange={(v) => setAddForm((p) => ({ ...p, leaseMonthly: v }))} placeholder="350,000" />
                <div className="flex" style={{ gap: 12 }}>
                  <AddField label="Lease Start" value={addForm.leaseStart} onChange={(v) => setAddForm((p) => ({ ...p, leaseStart: v }))} type="date" />
                  <AddField label="Lease End" value={addForm.leaseEnd} onChange={(v) => setAddForm((p) => ({ ...p, leaseEnd: v }))} type="date" />
                </div>
              </>
            )}

            {/* Insurance (shown for all except ACMI) */}
            {addForm.acquisitionType !== 'acmi' && (
              <CostField label="Insurance Monthly ($)" value={addForm.insuranceMonthly} onChange={(v) => setAddForm((p) => ({ ...p, insuranceMonthly: v }))} placeholder="12,500" />
            )}
          </div>

          <div className="flex justify-end" style={{ gap: 8, paddingTop: 4 }}>
            <button
              onClick={resetAddDialog}
              className="flex items-center border-none bg-transparent cursor-pointer btn-glow"
              style={{ padding: '8px 16px', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', border: '1px solid transparent', fontFamily: 'Inter, sans-serif' }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddAircraft}
              disabled={addSaving}
              className="flex items-center border-none cursor-pointer"
              style={{
                gap: 6,
                padding: '8px 16px',
                borderRadius: 6,
                backgroundColor: 'var(--accent-blue)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                opacity: addSaving ? 0.6 : 1,
              }}
            >
              <Plus size={14} />
              {addSaving ? 'Creating...' : 'Create Aircraft'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import SimBrief Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open) resetImportDialog(); else setImportOpen(true); }}>
        <DialogContent
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
            maxWidth: 680,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontSize: 16, fontWeight: 700 }}>
              <span className="flex items-center" style={{ gap: 8 }}>
                <Download size={16} style={{ color: 'var(--accent-blue)' }} />
                Import SimBrief Profiles
              </span>
            </DialogTitle>
            <DialogDescription style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Paste a SimBrief share link or search the airframe database.
            </DialogDescription>
          </DialogHeader>

          {/* Share Link Import */}
          <div className="flex flex-col" style={{ gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>IMPORT FROM SHARE LINK</span>
            <div className="flex items-center" style={{ gap: 8 }}>
              <div
                className="flex items-center flex-1 input-glow"
                style={{
                  gap: 8,
                  padding: '9px 12px',
                  borderRadius: 6,
                  backgroundColor: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                }}
              >
                <Link2 size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Paste SimBrief share link or internal ID..."
                  value={shareUrl}
                  onChange={(e) => { setShareUrl(e.target.value); setShareError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleParseShareLink(); }}
                  className="bg-transparent border-none outline-none flex-1"
                  style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
                  autoFocus
                />
              </div>
              <button
                onClick={handleParseShareLink}
                disabled={shareParsing || !shareUrl.trim()}
                className="flex items-center border-none cursor-pointer"
                style={{
                  gap: 5,
                  padding: '9px 14px',
                  borderRadius: 6,
                  backgroundColor: 'var(--accent-blue)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  opacity: shareParsing || !shareUrl.trim() ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {shareParsing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {shareParsing ? 'Parsing...' : 'Fetch'}
              </button>
            </div>

            {/* Share error */}
            {shareError && (
              <div className="flex items-start" style={{ gap: 8, padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <AlertTriangle size={13} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: 2 }} />
                <div className="flex flex-col" style={{ gap: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--accent-red)', lineHeight: 1.4 }}>{shareError}</span>
                </div>
              </div>
            )}

            {/* Share result card */}
            {shareResult && (
              <div
                className="flex flex-col"
                style={{
                  borderRadius: 6,
                  backgroundColor: 'var(--surface-1)',
                  border: '1px solid var(--accent-blue-border)',
                  overflow: 'hidden',
                }}
              >
                <div className="flex items-center" style={{ padding: '10px 14px', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue-bright)', width: 55, flexShrink: 0 }}>{shareResult.aircraftIcao}</span>
                  <span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{shareResult.aircraftName}</span>
                </div>
                <div className="flex items-center flex-wrap" style={{ padding: '0 14px 10px 14px', gap: 16 }}>
                  <ImportStat label="Engines" value={shareResult.engines || '—'} />
                  <ImportStat label="MTOW" value={shareResult.mtowLbs ? `${shareResult.mtowLbs.toLocaleString()} lbs` : '—'} />
                  <ImportStat label="OEW" value={shareResult.oewLbs ? `${shareResult.oewLbs.toLocaleString()} lbs` : '—'} />
                  <ImportStat label="MLW" value={shareResult.mlwLbs ? `${shareResult.mlwLbs.toLocaleString()} lbs` : '—'} />
                  <ImportStat label="MZFW" value={shareResult.mzfwLbs ? `${shareResult.mzfwLbs.toLocaleString()} lbs` : '—'} />
                  <ImportStat label="Fuel" value={shareResult.maxFuelLbs ? `${shareResult.maxFuelLbs.toLocaleString()} lbs` : '—'} />
                  <ImportStat label="Ceiling" value={shareResult.ceilingFt ? `${shareResult.ceilingFt.toLocaleString()} ft` : '—'} />
                  <ImportStat label="Equip" value={shareResult.equipCode || '—'} />
                  <ImportStat label="PBN" value={shareResult.pbn || '—'} />
                </div>
                <div
                  className="flex items-center"
                  style={{ padding: '8px 14px', gap: 8, borderTop: '1px solid var(--border-primary)', backgroundColor: 'rgba(79, 108, 205, 0.03)' }}
                >
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>Registration:</span>
                  <input
                    type="text"
                    placeholder="N821PM"
                    value={shareReg}
                    onChange={(e) => setShareReg(e.target.value.toUpperCase())}
                    className="input-glow"
                    style={{ flex: 1, padding: '5px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, sans-serif', maxWidth: 140 }}
                  />
                  <button
                    onClick={handleImportShareResult}
                    disabled={shareImporting}
                    className="flex items-center border-none cursor-pointer"
                    style={{ gap: 4, padding: '5px 12px', borderRadius: 4, backgroundColor: 'var(--accent-blue)', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'Inter, sans-serif', opacity: shareImporting ? 0.6 : 1 }}
                  >
                    {shareImporting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    {shareImporting ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center" style={{ gap: 12, margin: '2px 0' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-primary)' }} />
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 0.5 }}>OR SEARCH DATABASE</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-primary)' }} />
          </div>

          {/* Search */}
          <div
            className="flex items-center input-glow"
            style={{
              gap: 8,
              padding: '10px 12px',
              borderRadius: 6,
              backgroundColor: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search by ICAO code or aircraft name... (e.g. B738, A320, 747, Cessna)"
              value={importQuery}
              onChange={(e) => searchImportSimBrief(e.target.value)}
              className="bg-transparent border-none outline-none flex-1"
              style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
            />
            {importSearching && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />}
          </div>

          {/* Results */}
          <div
            className="flex flex-col"
            style={{
              flex: 1,
              overflowY: 'auto',
              gap: 8,
              minHeight: 0,
            }}
          >
            {importResults.length === 0 && importQuery.length >= 2 && !importSearching && (
              <div className="flex items-center justify-center" style={{ padding: 32, fontSize: 11, color: 'var(--text-tertiary)' }}>
                No airframes found for &quot;{importQuery}&quot;
              </div>
            )}
            {importResults.length === 0 && importQuery.length < 2 && (
              <div className="flex items-center justify-center" style={{ padding: 32, fontSize: 11, color: 'var(--text-tertiary)' }}>
                Type at least 2 characters to search SimBrief airframes
              </div>
            )}
            {importResults.map((profile, i) => {
              const key = `${profile.aircraftIcao}-${profile.aircraftName}`;
              const isImporting = importingKey === key;
              return (
                <div
                  key={`${profile.aircraftIcao}-${i}`}
                  className="flex flex-col"
                  style={{
                    borderRadius: 6,
                    backgroundColor: 'var(--surface-1)',
                    border: '1px solid var(--border-primary)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Profile header */}
                  <div className="flex items-center" style={{ padding: '10px 14px', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue-bright)', width: 55, flexShrink: 0 }}>{profile.aircraftIcao}</span>
                    <span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{profile.aircraftName}</span>
                    {profile.isCargo && (
                      <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 3, backgroundColor: 'rgba(251, 191, 36, 0.12)', color: 'var(--accent-amber)', fontWeight: 700, letterSpacing: 0.5 }}>CARGO</span>
                    )}
                  </div>

                  {/* Specs row */}
                  <div className="flex items-center" style={{ padding: '0 14px 10px 14px', gap: 16 }}>
                    <ImportStat label="Engines" value={profile.engines || '—'} />
                    <ImportStat label="MTOW" value={profile.mtowLbs ? `${profile.mtowLbs.toLocaleString()} lbs` : '—'} />
                    <ImportStat label="OEW" value={profile.oewLbs ? `${profile.oewLbs.toLocaleString()} lbs` : '—'} />
                    <ImportStat label="Fuel" value={profile.maxFuelLbs ? `${profile.maxFuelLbs.toLocaleString()} lbs` : '—'} />
                    <ImportStat label="Speed" value={profile.speed ? `${profile.speed} kts` : '—'} />
                    <ImportStat label="Ceiling" value={profile.ceilingFt ? `${profile.ceilingFt.toLocaleString()} ft` : '—'} />
                  </div>

                  {/* Registration + Import */}
                  <div
                    className="flex items-center"
                    style={{
                      padding: '8px 14px',
                      gap: 8,
                      borderTop: '1px solid var(--border-primary)',
                      backgroundColor: 'rgba(79, 108, 205, 0.03)',
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>Registration:</span>
                    <input
                      type="text"
                      placeholder="N821PM"
                      value={importRegs[key] ?? ''}
                      onChange={(e) => setImportRegs((p) => ({ ...p, [key]: e.target.value.toUpperCase() }))}
                      className="input-glow"
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: 'var(--input-bg)',
                        border: '1px solid var(--input-border)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontFamily: 'Inter, sans-serif',
                        maxWidth: 140,
                      }}
                    />
                    <button
                      onClick={() => handleImportProfile(profile)}
                      disabled={isImporting}
                      className="flex items-center border-none cursor-pointer"
                      style={{
                        gap: 4,
                        padding: '5px 12px',
                        borderRadius: 4,
                        backgroundColor: 'var(--accent-blue)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: 'Inter, sans-serif',
                        opacity: isImporting ? 0.6 : 1,
                      }}
                    >
                      {isImporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      {isImporting ? 'Importing...' : 'Import'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end" style={{ paddingTop: 4 }}>
            <button
              onClick={resetImportDialog}
              className="flex items-center border-none bg-transparent cursor-pointer btn-glow"
              style={{ padding: '8px 16px', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', border: '1px solid transparent', fontFamily: 'Inter, sans-serif' }}
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
            maxWidth: 420,
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontSize: 16, fontWeight: 700 }}>Delete Aircraft</DialogTitle>
            <DialogDescription style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="flex flex-col" style={{ gap: 16 }}>
              <div
                className="flex items-center"
                style={{
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                }}
              >
                <Trash2 size={16} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
                <div className="flex flex-col" style={{ gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{deleteTarget.registration}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{deleteTarget.name} · {deleteTarget.icaoType}</span>
                </div>
              </div>

              <div className="flex items-center justify-end" style={{ gap: 8 }}>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="border-none cursor-pointer"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    backgroundColor: 'var(--surface-3)',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="border-none cursor-pointer"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    backgroundColor: 'var(--accent-red)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? 'Deleting...' : 'Delete Aircraft'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function ImportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col" style={{ gap: 1 }}>
      <span style={{ fontSize: 8, color: 'var(--text-tertiary)', letterSpacing: 0.3 }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{value}</span>
    </div>
  );
}

function AddField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col flex-1" style={{ gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-glow"
        style={{
          padding: '8px 10px',
          borderRadius: 4,
          fontSize: 12,
          backgroundColor: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          color: 'var(--text-primary)',
          outline: 'none',
          width: '100%',
          fontFamily: 'Inter, sans-serif',
        }}
      />
    </div>
  );
}

function CostField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const formatWithCommas = (raw: string) => {
    // Strip non-numeric except dots
    const clean = raw.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
  };

  return (
    <div className="flex flex-col flex-1" style={{ gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(formatWithCommas(e.target.value))}
        placeholder={placeholder}
        className="input-glow font-mono"
        style={{
          padding: '8px 10px',
          borderRadius: 4,
          fontSize: 12,
          backgroundColor: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          color: 'var(--text-primary)',
          outline: 'none',
          width: '100%',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </div>
  );
}

function StatCard({ label, value, color, delay }: { label: string; value: string | number; color?: string; delay: number }) {
  return (
    <motion.div
      className="flex flex-col flex-1"
      style={{
        padding: '8px 14px',
        gap: 2,
        borderRadius: 6,
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border-primary)',
      }}
      variants={staggerItem}
    >
      <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="data-lg font-mono" style={{ fontWeight: 700, color: color ?? 'var(--text-primary)' }}>{value}</span>
    </motion.div>
  );
}

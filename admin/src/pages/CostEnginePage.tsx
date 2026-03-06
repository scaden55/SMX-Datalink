import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Calculator,
  DollarSign,
  Plane,
  MapPin,
  Wrench,
  Plus,
  Search,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Package,
  Fuel,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { pageVariants, staggerContainer, staggerItem, cardHover } from '@/lib/motion';
import { StatCard, SectionHeader, StatusBadge } from '@/components/primitives';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { DataTable } from '@/components/shared/DataTable';
import { DataTableColumnHeader } from '@/components/shared/DataTableColumnHeader';
import type {
  FinanceRateConfig,
  CommodityRate,
  FinanceAircraftProfile,
  StationFees,
  MaintThreshold,
  FlightPnL,
} from '@acars/shared';

// ── Helpers ──────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const fmtShort = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${fmtNum.format(n)}%`;

type Tab = 'pnl' | 'rates' | 'aircraft' | 'stations' | 'maintenance';

const TABS: { id: Tab; label: string; icon: typeof Calculator }[] = [
  { id: 'pnl', label: 'P&L Dashboard', icon: TrendingUp },
  { id: 'rates', label: 'Rate Tables', icon: DollarSign },
  { id: 'aircraft', label: 'Aircraft Profiles', icon: Plane },
  { id: 'stations', label: 'Station Fees', icon: MapPin },
  { id: 'maintenance', label: 'Maintenance Costs', icon: Wrench },
];

const BASE = '/api/admin/finance-engine';

// ── Main Page ────────────────────────────────────────────────

export function CostEnginePage() {
  const [tab, setTab] = useState<Tab>('pnl');

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div>
          <h1
            className="font-bold"
            style={{ fontSize: 'var(--text-display-size)', color: 'var(--text-primary)' }}
          >
            Cost Engine
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Cargo revenue rating, cost modeling, and P&L analytics
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex px-6 pb-4 gap-1" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border-none cursor-pointer"
            style={{
              backgroundColor: tab === t.id ? 'var(--accent-blue-bg)' : 'transparent',
              color: tab === t.id ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {tab === 'pnl' && <PnLTab />}
        {tab === 'rates' && <RateTablesTab />}
        {tab === 'aircraft' && <AircraftProfilesTab />}
        {tab === 'stations' && <StationFeesTab />}
        {tab === 'maintenance' && <MaintenanceTab />}
      </div>
    </motion.div>
  );
}

// ── P&L Dashboard Tab ────────────────────────────────────────

interface FlightPnLListItem {
  id: number;
  logbook_id: number;
  flight_number: string;
  dep_icao: string;
  arr_icao: string;
  cargo_revenue: number;
  total_variable_cost: number;
  total_fixed_alloc: number;
  gross_profit: number;
  margin_pct: number;
  load_factor: number;
  block_hours: number;
  event_id: number | null;
  computed_at: string;
}

function PnLTab() {
  const [flights, setFlights] = useState<FlightPnLListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: FlightPnLListItem[]; total: number }>(`${BASE}/flight-pnl`);
      setFlights(res.items);
      setTotal(res.total);
    } catch { toast.error('Failed to load P&L data'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    if (flights.length === 0) return null;
    const totalRev = flights.reduce((s, f) => s + f.cargo_revenue, 0);
    const totalCost = flights.reduce((s, f) => s + f.total_variable_cost + f.total_fixed_alloc, 0);
    const totalProfit = flights.reduce((s, f) => s + f.gross_profit, 0);
    const avgMargin = flights.reduce((s, f) => s + f.margin_pct, 0) / flights.length;
    return { totalRev, totalCost, totalProfit, avgMargin };
  }, [flights]);

  const columns: ColumnDef<FlightPnLListItem>[] = useMemo(() => [
    {
      accessorKey: 'flight_number',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Flight" />,
      cell: ({ row }) => (
        <span className="font-mono font-medium" style={{ color: 'var(--accent-blue-bright)' }}>
          {row.original.flight_number}
        </span>
      ),
    },
    {
      accessorKey: 'dep_icao',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Route" />,
      cell: ({ row }) => `${row.original.dep_icao} → ${row.original.arr_icao}`,
    },
    {
      accessorKey: 'cargo_revenue',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Revenue" />,
      cell: ({ row }) => <span className="font-mono">{fmt.format(row.original.cargo_revenue)}</span>,
    },
    {
      accessorKey: 'gross_profit',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Profit" />,
      cell: ({ row }) => {
        const v = row.original.gross_profit;
        return (
          <span className="font-mono" style={{ color: v >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
            {fmt.format(v)}
          </span>
        );
      },
    },
    {
      accessorKey: 'margin_pct',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Margin" />,
      cell: ({ row }) => {
        const v = row.original.margin_pct;
        return (
          <span className="font-mono" style={{ color: v >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
            {fmtPct(v)}
          </span>
        );
      },
    },
    {
      accessorKey: 'load_factor',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Load Factor" />,
      cell: ({ row }) => <span className="font-mono">{fmtPct(row.original.load_factor)}</span>,
    },
    {
      accessorKey: 'block_hours',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Block Hrs" />,
      cell: ({ row }) => <span className="font-mono">{fmtNum.format(row.original.block_hours)}</span>,
    },
    {
      accessorKey: 'event_id',
      header: 'Event',
      cell: ({ row }) => row.original.event_id ? (
        <AlertTriangle size={14} style={{ color: 'var(--accent-amber)' }} />
      ) : null,
    },
  ], []);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-4">
      {/* Stats */}
      {stats && (
        <motion.div variants={staggerItem} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={DollarSign} label="Total Revenue" value={fmtShort.format(stats.totalRev)} accent="blue" />
          <StatCard icon={Package} label="Total Costs" value={fmtShort.format(stats.totalCost)} accent="amber" />
          <StatCard icon={TrendingUp} label="Total Profit" value={fmtShort.format(stats.totalProfit)} accent={stats.totalProfit >= 0 ? 'emerald' : 'red'} />
          <StatCard icon={Calculator} label="Avg Margin" value={fmtPct(stats.avgMargin)} accent="cyan" />
        </motion.div>
      )}

      {/* Flight P&L table */}
      <motion.div variants={staggerItem}>
        <Surface>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Flight P&L" count={total} />
          </div>
          <DataTable columns={columns} data={flights} />
        </Surface>
      </motion.div>
    </motion.div>
  );
}

// ── Rate Tables Tab ──────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  general_freight: 'General Freight',
  pharmaceuticals: 'Pharmaceuticals',
  seafood: 'Seafood & Perishables',
  electronics: 'Electronics',
  industrial_machinery: 'Industrial Machinery',
  automotive: 'Automotive Parts',
  textiles: 'Textiles & Garments',
  dangerous_goods: 'Dangerous Goods',
  live_animals: 'Live Animals',
  ecommerce: 'E-Commerce',
};

function RateTablesTab() {
  const [rateConfig, setRateConfig] = useState<FinanceRateConfig | null>(null);
  const [commodityRates, setCommodityRates] = useState<CommodityRate[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [rc, cr] = await Promise.all([
        api.get<FinanceRateConfig>(`${BASE}/rate-config`),
        api.get<CommodityRate[]>(`${BASE}/commodity-rates`),
      ]);
      setRateConfig(rc);
      setCommodityRates(cr);
    } catch { toast.error('Failed to load rate data'); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const updateConfig = async (field: keyof FinanceRateConfig, value: number) => {
    try {
      const res = await api.put<FinanceRateConfig>(`${BASE}/rate-config`, { [field]: value });
      setRateConfig(res);
      toast.success('Rate config updated');
    } catch { toast.error('Failed to update rate config'); }
  };

  const updateCommodity = async (code: string, ratePerLb: number) => {
    try {
      await api.patch(`${BASE}/commodity-rates/${code}`, { ratePerLb });
      loadAll();
      toast.success('Commodity rate updated');
    } catch { toast.error('Failed to update commodity rate'); }
  };

  // Derive unique categories from data
  const categories = useMemo(() => {
    const cats = [...new Set(commodityRates.map(r => r.category))];
    return cats.sort((a, b) => (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b));
  }, [commodityRates]);

  // Filter by category + search
  const filteredRates = useMemo(() => {
    let filtered = commodityRates;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(r => r.category === categoryFilter);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      filtered = filtered.filter(r =>
        r.commodityName.toLowerCase().includes(q) ||
        r.commodityCode.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [commodityRates, categoryFilter, searchFilter]);

  // Stats per category
  const categoryStats = useMemo(() => {
    const map = new Map<string, { count: number; avgRate: number; minRate: number; maxRate: number }>();
    for (const r of commodityRates) {
      const s = map.get(r.category) || { count: 0, avgRate: 0, minRate: Infinity, maxRate: -Infinity };
      s.count++;
      s.avgRate += r.ratePerLb;
      s.minRate = Math.min(s.minRate, r.ratePerLb);
      s.maxRate = Math.max(s.maxRate, r.ratePerLb);
      map.set(r.category, s);
    }
    for (const [, s] of map) s.avgRate = s.avgRate / s.count;
    return map;
  }, [commodityRates]);

  const commodityColumns: ColumnDef<CommodityRate>[] = useMemo(() => [
    {
      accessorKey: 'commodityCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {row.original.commodityCode}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'commodityName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Commodity" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>
            {row.original.commodityName}
          </span>
          {row.original.hazmat && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
              background: 'var(--accent-amber-bg)', color: 'var(--accent-amber)',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              HAZMAT
            </span>
          )}
          {row.original.tempControlled && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
              background: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan)',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              TEMP
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {CATEGORY_LABELS[row.original.category] ?? row.original.category}
        </span>
      ),
    },
    {
      accessorKey: 'ratePerLb',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Rate / lb" />,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.ratePerLb}
          onSave={(v) => updateCommodity(row.original.commodityCode, v)}
          prefix="$"
        />
      ),
      size: 120,
    },
  ], []);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
      {/* Global Config */}
      {rateConfig && (
        <motion.div variants={staggerItem}>
          <Surface>
            <SectionHeader title="Global Rate Configuration" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
              <ConfigField label="Fuel Surcharge %" value={rateConfig.fuelSurchargePct * 100} suffix="%" onChange={(v) => updateConfig('fuelSurchargePct', v / 100)} />
              <ConfigField label="Security Fee" value={rateConfig.securityFee} prefix="$" onChange={(v) => updateConfig('securityFee', v)} />
              <ConfigField label="Charter Multiplier" value={rateConfig.charterMultiplier} suffix="x" onChange={(v) => updateConfig('charterMultiplier', v)} />
              <ConfigField label="Default Rate / lb" value={rateConfig.defaultLaneRate} prefix="$" onChange={(v) => updateConfig('defaultLaneRate', v)} />
              <ConfigField label="Valuation Charge %" value={rateConfig.valuationChargePct * 100} suffix="%" onChange={(v) => updateConfig('valuationChargePct', v / 100)} />
              <ConfigField label="Default Fuel Price / gal" value={rateConfig.defaultFuelPrice} prefix="$" onChange={(v) => updateConfig('defaultFuelPrice', v)} />
            </div>
          </Surface>
        </motion.div>
      )}

      {/* Commodity Rates */}
      <motion.div variants={staggerItem}>
        <Surface>
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Commodity Rates" count={filteredRates.length} />
          </div>

          {/* Filter bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
            padding: '10px 12px', borderRadius: 6,
            background: 'var(--surface-0)', border: '1px solid var(--border-primary)',
          }}>
            <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search commodities..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="input-glow"
              style={{
                flex: 1, border: 'none', background: 'transparent', outline: 'none',
                fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit',
              }}
            />
            <div style={{ width: 1, height: 20, background: 'var(--border-primary)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button
                onClick={() => setCategoryFilter('all')}
                style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  background: categoryFilter === 'all' ? 'var(--accent-blue-dim)' : 'transparent',
                  color: categoryFilter === 'all' ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
                }}
              >
                All ({commodityRates.length})
              </button>
              {categories.map(cat => {
                const stats = categoryStats.get(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === categoryFilter ? 'all' : cat)}
                    style={{
                      padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
                      background: categoryFilter === cat ? 'var(--accent-blue-dim)' : 'transparent',
                      color: categoryFilter === cat ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
                    }}
                  >
                    {CATEGORY_LABELS[cat] ?? cat} ({stats?.count ?? 0})
                  </button>
                );
              })}
            </div>
          </div>

          <DataTable columns={commodityColumns} data={filteredRates} />
        </Surface>
      </motion.div>
    </motion.div>
  );
}

// ── Aircraft Profiles Tab ────────────────────────────────────

function AircraftProfilesTab() {
  const [profiles, setProfiles] = useState<FinanceAircraftProfile[]>([]);
  const [fleetOptions, setFleetOptions] = useState<{ id: number; registration: string; icaoType: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    aircraftId: '',
    leaseType: 'dry',
    leaseMonthly: '0',
    insuranceHullValue: '0',
    insuranceHullPct: '0.015',
    insuranceLiability: '0',
    insuranceWarRisk: '0',
    baseFuelGph: '800',
    payloadFuelSensitivity: '0.5',
    maintReservePerFh: '150',
    crewPerDiem: '4.50',
    crewHotelRate: '150',
  });

  const loadAll = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([
        api.get<FinanceAircraftProfile[]>(`${BASE}/aircraft-profiles`),
        api.get<{ id: number; registration: string; icaoType: string }[]>('/api/admin/fleet'),
      ]);
      setProfiles(p);
      setFleetOptions(f.filter((a: { id: number }) => !p.some((pr) => pr.aircraftId === a.id)));
    } catch { toast.error('Failed to load aircraft profiles'); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openCreate = () => {
    setEditId(null);
    setForm({
      aircraftId: '', leaseType: 'dry', leaseMonthly: '0', insuranceHullValue: '0',
      insuranceHullPct: '0.015', insuranceLiability: '0', insuranceWarRisk: '0',
      baseFuelGph: '800', payloadFuelSensitivity: '0.5', maintReservePerFh: '150',
      crewPerDiem: '4.50', crewHotelRate: '150',
    });
    setDialogOpen(true);
  };

  const openEdit = (p: FinanceAircraftProfile) => {
    setEditId(p.id);
    setForm({
      aircraftId: String(p.aircraftId),
      leaseType: p.leaseType,
      leaseMonthly: String(p.leaseMonthly),
      insuranceHullValue: String(p.insuranceHullValue),
      insuranceHullPct: String(p.insuranceHullPct),
      insuranceLiability: String(p.insuranceLiability),
      insuranceWarRisk: String(p.insuranceWarRisk),
      baseFuelGph: String(p.baseFuelGph),
      payloadFuelSensitivity: String(p.payloadFuelSensitivity),
      maintReservePerFh: String(p.maintReservePerFh),
      crewPerDiem: String(p.crewPerDiem),
      crewHotelRate: String(p.crewHotelRate),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const body = {
        aircraftId: parseInt(form.aircraftId),
        leaseType: form.leaseType,
        leaseMonthly: parseFloat(form.leaseMonthly),
        insuranceHullValue: parseFloat(form.insuranceHullValue),
        insuranceHullPct: parseFloat(form.insuranceHullPct),
        insuranceLiability: parseFloat(form.insuranceLiability),
        insuranceWarRisk: parseFloat(form.insuranceWarRisk),
        baseFuelGph: parseFloat(form.baseFuelGph),
        payloadFuelSensitivity: parseFloat(form.payloadFuelSensitivity),
        maintReservePerFh: parseFloat(form.maintReservePerFh),
        crewPerDiem: parseFloat(form.crewPerDiem),
        crewHotelRate: parseFloat(form.crewHotelRate),
      };
      if (editId) {
        await api.patch(`${BASE}/aircraft-profiles/${editId}`, body);
      } else {
        await api.post(`${BASE}/aircraft-profiles`, body);
      }
      setDialogOpen(false);
      loadAll();
      toast.success(editId ? 'Profile updated' : 'Profile created');
    } catch { toast.error('Failed to save profile'); }
  };

  const deleteProfile = async (id: number) => {
    try {
      await api.delete(`${BASE}/aircraft-profiles/${id}`);
      loadAll();
      toast.success('Profile deleted');
    } catch { toast.error('Failed to delete profile'); }
  };

  const columns: ColumnDef<FinanceAircraftProfile>[] = useMemo(() => [
    {
      accessorKey: 'registration',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Registration" />,
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.registration}</span>,
    },
    {
      accessorKey: 'icaoType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    },
    {
      accessorKey: 'leaseType',
      header: 'Lease',
      cell: ({ row }) => (
        <StatusBadge status={row.original.leaseType === 'wet' ? 'active' : 'inactive'} label={row.original.leaseType.toUpperCase()} />
      ),
    },
    {
      accessorKey: 'leaseMonthly',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lease $/mo" />,
      cell: ({ row }) => <span className="font-mono">{fmtShort.format(row.original.leaseMonthly)}</span>,
    },
    {
      accessorKey: 'baseFuelGph',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fuel GPH" />,
      cell: ({ row }) => <span className="font-mono">{fmtNum.format(row.original.baseFuelGph)}</span>,
    },
    {
      accessorKey: 'maintReservePerFh',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Maint $/FH" />,
      cell: ({ row }) => <span className="font-mono">{fmt.format(row.original.maintReservePerFh)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => deleteProfile(row.original.id)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ], []);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-4">
      <motion.div variants={staggerItem}>
        <Surface>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Aircraft Financial Profiles" />
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} className="mr-1" /> Add Profile
            </Button>
          </div>
          <DataTable columns={columns} data={profiles} />
        </Surface>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-lg"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-primary)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>
              {editId ? 'Edit Aircraft Profile' : 'New Aircraft Profile'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-3 max-h-[60vh] overflow-y-auto">
            {!editId && (
              <div>
                <Label style={{ color: 'var(--text-secondary)' }}>Aircraft</Label>
                <Select value={form.aircraftId} onValueChange={(v) => setForm({ ...form, aircraftId: v })}>
                  <SelectTrigger style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                    <SelectValue placeholder="Select aircraft" />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-primary)' }}>
                    {fleetOptions.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.registration} ({a.icaoType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Lease Type">
                <Select value={form.leaseType} onValueChange={(v) => setForm({ ...form, leaseType: v })}>
                  <SelectTrigger style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-primary)' }}>
                    <SelectItem value="dry">Dry</SelectItem>
                    <SelectItem value="wet">Wet</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Lease $/mo">
                <Input type="number" value={form.leaseMonthly} onChange={(e) => setForm({ ...form, leaseMonthly: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Hull Value ($)">
                <Input type="number" value={form.insuranceHullValue} onChange={(e) => setForm({ ...form, insuranceHullValue: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Hull %">
                <Input type="number" step="0.001" value={form.insuranceHullPct} onChange={(e) => setForm({ ...form, insuranceHullPct: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Liability ($/yr)">
                <Input type="number" value={form.insuranceLiability} onChange={(e) => setForm({ ...form, insuranceLiability: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="War Risk ($/yr)">
                <Input type="number" value={form.insuranceWarRisk} onChange={(e) => setForm({ ...form, insuranceWarRisk: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Base Fuel GPH">
                <Input type="number" value={form.baseFuelGph} onChange={(e) => setForm({ ...form, baseFuelGph: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Payload Fuel Sensitivity">
                <Input type="number" step="0.1" value={form.payloadFuelSensitivity} onChange={(e) => setForm({ ...form, payloadFuelSensitivity: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Maint Reserve $/FH">
                <Input type="number" value={form.maintReservePerFh} onChange={(e) => setForm({ ...form, maintReservePerFh: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Crew Per Diem $/hr">
                <Input type="number" step="0.50" value={form.crewPerDiem} onChange={(e) => setForm({ ...form, crewPerDiem: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Crew Hotel Rate ($)">
                <Input type="number" value={form.crewHotelRate} onChange={(e) => setForm({ ...form, crewHotelRate: e.target.value })} style={inputStyle} />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editId ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── Station Fees Tab ─────────────────────────────────────────

function StationFeesTab() {
  const [stations, setStations] = useState<StationFees[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    icao: '', landingRate: '5.50', parkingRate: '25', groundHandling: '350',
    fuelPriceGal: '5.50', navFeePerNm: '0.12', deiceFee: '0', uldHandling: '15',
  });

  const loadAll = useCallback(async () => {
    try {
      setStations(await api.get<StationFees[]>(`${BASE}/station-fees`));
    } catch { toast.error('Failed to load station fees'); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    if (!search) return stations;
    const q = search.toUpperCase();
    return stations.filter((s) => s.icao.includes(q));
  }, [stations, search]);

  const openCreate = () => {
    setEditId(null);
    setForm({ icao: '', landingRate: '5.50', parkingRate: '25', groundHandling: '350', fuelPriceGal: '5.50', navFeePerNm: '0.12', deiceFee: '0', uldHandling: '15' });
    setDialogOpen(true);
  };

  const openEdit = (s: StationFees) => {
    setEditId(s.id);
    setForm({
      icao: s.icao,
      landingRate: String(s.landingRate),
      parkingRate: String(s.parkingRate),
      groundHandling: String(s.groundHandling),
      fuelPriceGal: String(s.fuelPriceGal),
      navFeePerNm: String(s.navFeePerNm),
      deiceFee: String(s.deiceFee),
      uldHandling: String(s.uldHandling),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const body = {
        icao: form.icao.toUpperCase(),
        landingRate: parseFloat(form.landingRate),
        parkingRate: parseFloat(form.parkingRate),
        groundHandling: parseFloat(form.groundHandling),
        fuelPriceGal: parseFloat(form.fuelPriceGal),
        navFeePerNm: parseFloat(form.navFeePerNm),
        deiceFee: parseFloat(form.deiceFee),
        uldHandling: parseFloat(form.uldHandling),
      };
      if (editId) {
        await api.patch(`${BASE}/station-fees/${editId}`, body);
      } else {
        await api.post(`${BASE}/station-fees`, body);
      }
      setDialogOpen(false);
      loadAll();
      toast.success(editId ? 'Station updated' : 'Station created');
    } catch { toast.error('Failed to save station fees'); }
  };

  const deleteStation = async (id: number) => {
    try {
      await api.delete(`${BASE}/station-fees/${id}`);
      loadAll();
      toast.success('Station deleted');
    } catch { toast.error('Failed to delete station'); }
  };

  const columns: ColumnDef<StationFees>[] = useMemo(() => [
    {
      accessorKey: 'icao',
      header: ({ column }) => <DataTableColumnHeader column={column} title="ICAO" />,
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.icao}</span>,
    },
    {
      accessorKey: 'landingRate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Landing $/1k lbs" />,
      cell: ({ row }) => <span className="font-mono">{fmt.format(row.original.landingRate)}</span>,
    },
    {
      accessorKey: 'fuelPriceGal',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fuel $/gal" />,
      cell: ({ row }) => <span className="font-mono">{fmt.format(row.original.fuelPriceGal)}</span>,
    },
    {
      accessorKey: 'groundHandling',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Handling" />,
      cell: ({ row }) => <span className="font-mono">{fmt.format(row.original.groundHandling)}</span>,
    },
    {
      accessorKey: 'parkingRate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Parking" />,
      cell: ({ row }) => <span className="font-mono">{fmt.format(row.original.parkingRate)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}><Pencil size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={() => deleteStation(row.original.id)}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ], []);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-4">
      <motion.div variants={staggerItem}>
        <Surface>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader title="Station Fee Schedule" />
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: 'var(--text-tertiary)' }} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter ICAO..."
                  className="pl-8 w-40"
                  style={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)', height: 32, fontSize: 13 }}
                />
              </div>
              <Button size="sm" onClick={openCreate}>
                <Plus size={14} className="mr-1" /> Add Station
              </Button>
            </div>
          </div>
          <DataTable columns={columns} data={filtered} />
        </Surface>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-primary)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--text-primary)' }}>
              {editId ? 'Edit Station Fees' : 'New Station'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            {!editId && (
              <div>
                <Label style={{ color: 'var(--text-secondary)' }}>ICAO Code</Label>
                <Input
                  value={form.icao}
                  onChange={(e) => setForm({ ...form, icao: e.target.value })}
                  placeholder="KMEM"
                  maxLength={4}
                  style={inputStyle}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Landing Rate ($/1k lbs)">
                <Input type="number" step="0.50" value={form.landingRate} onChange={(e) => setForm({ ...form, landingRate: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Parking ($)">
                <Input type="number" value={form.parkingRate} onChange={(e) => setForm({ ...form, parkingRate: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Ground Handling ($)">
                <Input type="number" value={form.groundHandling} onChange={(e) => setForm({ ...form, groundHandling: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Fuel Price ($/gal)">
                <Input type="number" step="0.10" value={form.fuelPriceGal} onChange={(e) => setForm({ ...form, fuelPriceGal: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="Nav Fee ($/nm)">
                <Input type="number" step="0.01" value={form.navFeePerNm} onChange={(e) => setForm({ ...form, navFeePerNm: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="De-Ice Fee ($)">
                <Input type="number" value={form.deiceFee} onChange={(e) => setForm({ ...form, deiceFee: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="ULD Handling ($)">
                <Input type="number" value={form.uldHandling} onChange={(e) => setForm({ ...form, uldHandling: e.target.value })} style={inputStyle} />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editId ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ── Maintenance Tab ──────────────────────────────────────────

function MaintenanceTab() {
  const [thresholds, setThresholds] = useState<MaintThreshold[]>([]);

  const load = useCallback(async () => {
    try {
      setThresholds(await api.get<MaintThreshold[]>(`${BASE}/maint-thresholds`));
    } catch { toast.error('Failed to load maintenance thresholds'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateThreshold = async (id: number, field: string, value: number) => {
    try {
      await api.patch(`${BASE}/maint-thresholds/${id}`, { [field]: value });
      load();
      toast.success('Threshold updated');
    } catch { toast.error('Failed to update threshold'); }
  };

  const columns: ColumnDef<MaintThreshold>[] = useMemo(() => [
    {
      accessorKey: 'checkType',
      header: 'Check Type',
      cell: ({ row }) => (
        <span className="font-mono font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          {row.original.checkType}
        </span>
      ),
    },
    {
      accessorKey: 'intervalHours',
      header: 'Interval (hrs)',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.intervalHours ?? 0}
          onSave={(v) => updateThreshold(row.original.id, 'intervalHours', v)}
        />
      ),
    },
    {
      accessorKey: 'intervalYears',
      header: 'Interval (yrs)',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.intervalYears ?? 0}
          onSave={(v) => updateThreshold(row.original.id, 'intervalYears', v)}
        />
      ),
    },
    {
      accessorKey: 'costMin',
      header: 'Cost Min',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.costMin}
          onSave={(v) => updateThreshold(row.original.id, 'costMin', v)}
          prefix="$"
        />
      ),
    },
    {
      accessorKey: 'costMax',
      header: 'Cost Max',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.costMax}
          onSave={(v) => updateThreshold(row.original.id, 'costMax', v)}
          prefix="$"
        />
      ),
    },
    {
      accessorKey: 'downtimeDaysMin',
      header: 'Downtime Min',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.downtimeDaysMin}
          onSave={(v) => updateThreshold(row.original.id, 'downtimeDaysMin', v)}
          suffix=" days"
        />
      ),
    },
    {
      accessorKey: 'downtimeDaysMax',
      header: 'Downtime Max',
      cell: ({ row }) => (
        <EditableCell
          value={row.original.downtimeDaysMax}
          onSave={(v) => updateThreshold(row.original.id, 'downtimeDaysMax', v)}
          suffix=" days"
        />
      ),
    },
  ], []);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-4">
      <motion.div variants={staggerItem}>
        <Surface>
          <SectionHeader title="Maintenance Check Thresholds" />
          <p className="text-[12px] mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Click any value to edit. These thresholds determine maintenance reserve rates and AOG event probability.
          </p>
          <DataTable columns={columns} data={thresholds} />
        </Surface>
      </motion.div>
    </motion.div>
  );
}

// ── Shared UI Components ─────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface-1)',
  borderColor: 'var(--border-primary)',
  color: 'var(--text-primary)',
};

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--surface-2)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{label}</Label>
      {children}
    </div>
  );
}

function ConfigField({
  label, value, prefix, suffix, onChange,
}: {
  label: string; value: number; prefix?: string; suffix?: string;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n !== value) onChange(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <Label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</Label>
        <Input
          type="number"
          step="0.01"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          style={{ ...inputStyle, marginTop: 4 }}
        />
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer rounded-md p-2 hover:bg-[var(--surface-3)]"
      onClick={() => { setDraft(String(value)); setEditing(true); }}
    >
      <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="font-mono text-lg font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
        {prefix}{fmtNum.format(value)}{suffix}
      </p>
    </div>
  );
}

function EditableCell({
  value, onSave, prefix, suffix,
}: {
  value: number; onSave: (v: number) => void; prefix?: string; suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <Input
        type="number"
        step="any"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { const n = parseFloat(draft); if (!isNaN(n)) onSave(n); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { const n = parseFloat(draft); if (!isNaN(n)) onSave(n); setEditing(false); } }}
        className="w-24 h-7 text-xs font-mono"
        style={inputStyle}
      />
    );
  }

  return (
    <span
      className="font-mono cursor-pointer hover:underline"
      style={{ color: 'var(--text-primary)' }}
      onClick={() => { setDraft(String(value)); setEditing(true); }}
    >
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  );
}

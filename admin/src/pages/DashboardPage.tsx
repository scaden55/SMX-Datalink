import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import {
  Package,
  Wrench,
  FileText,
  TrendingUp,
  ArrowDownRight,
} from 'lucide-react';
import type { ActiveFlightHeartbeat } from '@acars/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useSocket } from '@/hooks/useSocket';
import {
  pageVariants,
  staggerContainer,
  staggerItem,
  fadeIn,
  fadeUp,
  tableContainer,
  tableRow,
} from '@/lib/motion';

const FlightMap = lazy(() =>
  import('@/components/dispatch/FlightMap').then((m) => ({ default: m.FlightMap })),
);

// ── Types ──────────────────────────────────────────────

interface RecentFlight {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  status: string;
  pilotCallsign: string;
  landingRate: number | null;
  createdAt: string;
}

interface MaintenanceAlert {
  type: string;
  aircraftReg: string;
  description: string;
  severity: string;
}

interface FinancialSummary {
  months: string[];
  income: number[];
  costs: number[];
  profit: number[];
}

interface DashboardData {
  activeFlights: number;
  pendingPireps: number;
  fleetHealthPct: number;
  monthlyRevenue: number;
  recentFlights: RecentFlight[];
  maintenanceAlerts: MaintenanceAlert[];
  pilotActivity: { callsign: string; firstName: string; lastName: string; hoursThisMonth: number }[];
  financialSummary: FinancialSummary;
}

// ── Helpers ────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function statusBadge(status: string) {
  switch (status) {
    case 'approved':
      return { bg: 'rgba(74, 222, 128, 0.12)', text: 'var(--accent-emerald)', label: 'Approved' };
    case 'pending':
      return { bg: 'rgba(251, 191, 36, 0.12)', text: 'var(--accent-amber)', label: 'Pending' };
    case 'rejected':
      return { bg: 'rgba(248, 113, 113, 0.12)', text: 'var(--accent-red)', label: 'Rejected' };
    default:
      return { bg: 'var(--surface-3)', text: 'var(--text-tertiary)', label: status };
  }
}

// ── Animated number counter ────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = display;
    const diff = value - start;
    const duration = 800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{prefix}{display.toLocaleString()}{suffix}</>;
}

// ── Component ──────────────────────────────────────────

export function DashboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { connected, acquire } = useSocketStore();
  const [flights, setFlights] = useState<ActiveFlightHeartbeat[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (accessToken) return acquire(accessToken);
  }, [accessToken, acquire]);

  useSocket<ActiveFlightHeartbeat[]>('flights:active', setFlights, {
    subscribeEvent: 'livemap:subscribe',
    unsubscribeEvent: 'livemap:unsubscribe',
  });

  const fetchDashboard = useCallback(async () => {
    try {
      setData(await api.get<DashboardData>('/api/admin/dashboard'));
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const fin = data?.financialSummary;
  const totalBalance = fin ? fin.income.reduce((a, b) => a + b, 0) - fin.costs.reduce((a, b) => a + b, 0) : 0;
  const curIncome = fin?.income[fin.income.length - 1] ?? 0;
  const curCosts = fin?.costs[fin.costs.length - 1] ?? 0;
  const prevIncome = fin?.income[fin.income.length - 2] ?? 0;
  const prevCosts = fin?.costs[fin.costs.length - 2] ?? 0;
  const incPct = prevIncome ? (((curIncome - prevIncome) / prevIncome) * 100).toFixed(1) : '0';
  const costPct = prevCosts ? (((curCosts - prevCosts) / prevCosts) * 100).toFixed(1) : '0';

  return (
    <motion.div
      className="flex flex-col h-full"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Entity Header ─────────────────────────────── */}
      <motion.div
        className="flex items-center"
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-primary)',
        }}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col" style={{ gap: 6 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <img
              src="/admin/logos/chevron-light.png"
              alt=""
              style={{ width: 27, height: 27 }}
              className="object-contain"
            />
            <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
              Special Missions Air
            </span>
          </div>
          <motion.div
            className="flex items-center"
            style={{ gap: 8 }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.span
              className="inline-flex items-center"
              style={{
                gap: 4,
                padding: '3px 8px',
                borderRadius: 2,
                backgroundColor: 'var(--accent-emerald-bg)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.5,
                color: 'var(--accent-emerald)',
              }}
              variants={staggerItem}
            >
              <span
                className="pulse-dot"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-emerald)',
                }}
              />
              OPERATIONAL
            </motion.span>
            <motion.span
              style={{
                padding: '3px 8px',
                borderRadius: 2,
                backgroundColor: 'var(--accent-blue-dim)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.5,
                color: 'var(--accent-blue-bright)',
              }}
              variants={staggerItem}
            >
              FAA-121
            </motion.span>
            <motion.span
              style={{
                padding: '3px 8px',
                borderRadius: 2,
                backgroundColor: '#171e30',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.5,
                color: 'var(--text-secondary)',
              }}
              variants={staggerItem}
            >
              EST. 2021
            </motion.span>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Content: Two columns ──────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
        <div className="flex" style={{ gap: 16 }}>
          {/* ── Left Column ────────────────────────────── */}
          <motion.div
            className="flex flex-col flex-1 min-w-0"
            style={{ gap: 16 }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Finance Card */}
            <motion.div
              className="flex overflow-hidden"
              style={{
                height: 220,
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-primary)',
              }}
              variants={staggerItem}
            >
              {/* Chart side */}
              <div className="flex flex-col flex-1 min-w-0" style={{ padding: '16px 20px', gap: 4 }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Total Balance</span>
                  <div className="flex items-center" style={{ gap: 4 }}>
                    {['Weekly', 'Monthly', 'Yearly'].map((tab, i) => (
                      <motion.span
                        key={tab}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 2,
                          fontSize: 9,
                          fontWeight: 500,
                          cursor: 'pointer',
                          backgroundColor: i === 1 ? 'var(--accent-blue-dim)' : 'transparent',
                          color: i === 1 ? 'var(--accent-blue-bright)' : 'var(--text-tertiary)',
                        }}
                        whileHover={{ backgroundColor: 'var(--accent-blue-dim)', color: 'var(--accent-blue-bright)' }}
                        transition={{ duration: 0.15 }}
                      >
                        {tab}
                      </motion.span>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {data ? fmtCurrency(totalBalance) : <span className="shimmer" style={{ display: 'inline-block', width: 120, height: 24, borderRadius: 4 }} />}
                </span>
                {/* Simple SVG line chart */}
                <div className="flex-1 relative">
                  <BalanceChart data={fin} />
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 1, backgroundColor: 'var(--border-primary)' }} />

              {/* Income / Expense side */}
              <div className="flex flex-col" style={{ width: 200 }}>
                <div className="flex flex-col flex-1" style={{ padding: 16, gap: 6 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 1 }}>
                      INCOME
                    </span>
                    <TrendingUp size={12} style={{ color: 'var(--accent-emerald)' }} />
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmtCurrency(curIncome)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-emerald)' }}>
                    +{incPct}% vs last month
                  </span>
                </div>
                <div style={{ height: 1, backgroundColor: 'var(--border-primary)' }} />
                <div className="flex flex-col flex-1" style={{ padding: 16, gap: 6 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: 1 }}>
                      EXPENSES
                    </span>
                    <ArrowDownRight size={12} style={{ color: 'var(--accent-red)' }} />
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmtCurrency(curCosts)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-red)' }}>
                    +{costPct}% vs last month
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Live Map */}
            <motion.div
              className="relative overflow-hidden"
              style={{
                height: 420,
                border: '1px solid var(--border-primary)',
                backgroundColor: '#0a0e1a',
              }}
              variants={fadeIn}
              initial="hidden"
              animate="visible"
            >
              <Suspense fallback={<div className="h-full w-full shimmer" />}>
                <FlightMap flights={flights} selectedCallsign={null} onSelectFlight={() => {}} trail={[]} />
              </Suspense>
              {/* Map overlay: live tracking label */}
              <motion.div
                className="absolute flex items-center"
                style={{
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 2,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  zIndex: 10,
                }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.3 }}
              >
                <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent-emerald)' }} />
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-primary)' }}>
                  LIVE TRACKING
                </span>
                <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  · {flights.length} active
                </span>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* ── Right Column ───────────────────────────── */}
          <motion.div
            className="flex flex-col"
            style={{ width: '42%', gap: 16 }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {/* Cargo Operations Card */}
            <motion.div variants={staggerItem}>
              <CardShell icon={Package} title="Cargo Operations" date="March 2026">
                {/* Top metrics row */}
                <div className="flex" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <div className="flex-1 flex flex-col" style={{ padding: '12px 16px', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-tertiary)' }}>RATM</span>
                    <div className="flex items-end" style={{ gap: 3 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>$0.42</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingBottom: 3 }}>/ton·nm</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-emerald)' }}>+3.1% vs last month</span>
                  </div>
                  <div style={{ width: 1, backgroundColor: 'var(--border-primary)' }} />
                  <div className="flex-1 flex flex-col" style={{ padding: '12px 16px', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-tertiary)' }}>ON-TIME DELIVERY</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>96.8%</span>
                    <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--divider)' }}>
                      <div className="bar-animate" style={{ height: '100%', width: '96.8%', borderRadius: 3, backgroundColor: 'var(--accent-emerald)' }} />
                    </div>
                  </div>
                </div>
                {/* Bottom metrics row */}
                <div className="flex">
                  <div className="flex-1 flex flex-col" style={{ padding: '12px 16px', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-tertiary)' }}>LOAD FACTOR</span>
                    <BarMetric label="Weight" value={78} color="var(--accent-blue)" />
                    <BarMetric label="Volume" value={65} color="var(--accent-cyan)" />
                  </div>
                  <div style={{ width: 1, backgroundColor: 'var(--border-primary)' }} />
                  <div className="flex-1 flex flex-col" style={{ padding: '12px 16px', gap: 4 }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-tertiary)' }}>LOADS / MONTH</span>
                    </div>
                    <div className="flex items-end" style={{ gap: 3 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                        <AnimatedNumber value={1247} />
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingBottom: 3 }}>tons</span>
                    </div>
                    {/* Mini bar chart */}
                    <div className="flex items-end" style={{ gap: 3, height: 40 }}>
                      {[45, 55, 60, 70, 65, 80, 75, 90, 85, 95, 88, 100].map((v, i) => (
                        <motion.div
                          key={i}
                          className="flex-1"
                          style={{ borderRadius: 1, backgroundColor: 'var(--accent-blue)', opacity: 0.6 + (i / 30) }}
                          initial={{ height: 0 }}
                          animate={{ height: `${v}%` }}
                          transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-emerald)' }}>+18.3% vs last month</span>
                  </div>
                </div>
              </CardShell>
            </motion.div>

            {/* Maintenance Card */}
            <motion.div variants={staggerItem}>
              <CardShell icon={Wrench} title="Maintenance" date="March 2026">
                {/* Top row */}
                <div className="flex" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <div className="flex-1 flex flex-col" style={{ padding: '12px 16px', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-tertiary)' }}>AIRCRAFT AVAILABILITY</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                      <AnimatedNumber value={data?.fleetHealthPct ?? 0} suffix="%" />
                    </span>
                    <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--divider)' }}>
                      <div className="bar-animate" style={{ height: '100%', width: `${data?.fleetHealthPct ?? 0}%`, borderRadius: 3, backgroundColor: 'var(--accent-emerald)' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-emerald)' }}>+1.2% vs last month</span>
                  </div>
                  <div style={{ width: 1, backgroundColor: 'var(--border-primary)' }} />
                  <div className="flex-1 flex flex-col" style={{ padding: '12px 16px', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-tertiary)' }}>MEL OPEN ITEMS</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-amber)' }}>
                      <AnimatedNumber value={data?.maintenanceAlerts.length ?? 0} />
                    </span>
                    <div className="flex items-center" style={{ gap: 6 }}>
                      {data?.maintenanceAlerts.slice(0, 3).map((a, i) => (
                        <motion.span
                          key={i}
                          style={{
                            padding: '2px 6px',
                            borderRadius: 2,
                            fontSize: 9,
                            fontWeight: 600,
                            backgroundColor: a.severity === 'critical' ? 'var(--accent-red-bg)' : 'var(--accent-amber-bg)',
                            color: a.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)',
                          }}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                        >
                          {a.type}
                        </motion.span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Bottom row */}
                <div className="flex">
                  <div className="flex-1 flex flex-col" style={{ padding: '12px 16px', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-tertiary)' }}>UNSCHED. MAINTENANCE</span>
                    <div className="flex items-end" style={{ gap: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>2</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingBottom: 3 }}>events</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-emerald)' }}>-33% vs last month</span>
                  </div>
                  <div style={{ width: 1, backgroundColor: 'var(--border-primary)' }} />
                  <div className="flex-1 flex flex-col" style={{ padding: '12px 16px', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'var(--text-tertiary)' }}>LINE MX DELAYS</span>
                    <div className="flex items-end" style={{ gap: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>4</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', paddingBottom: 3 }}>delays</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent-emerald)' }}>-2 vs last month</span>
                  </div>
                </div>
              </CardShell>
            </motion.div>

            {/* Recent PIREPs */}
            <motion.div
              className="flex flex-col overflow-hidden"
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border-primary)',
              }}
              variants={staggerItem}
            >
              <div className="flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <FileText size={16} style={{ color: 'var(--accent-blue-bright)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent PIREPs</span>
                </div>
                <span
                  className="btn-glow"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--accent-blue-bright)',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 3,
                    border: '1px solid transparent',
                  }}
                >
                  View All →
                </span>
              </div>
              {/* Column headers */}
              <div className="flex items-center" style={{ padding: '6px 16px', borderBottom: '1px solid var(--border-primary)', gap: 12 }}>
                <span style={{ width: 70, fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-tertiary)' }}>FLIGHT</span>
                <span style={{ flex: 1, fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-tertiary)' }}>ROUTE</span>
                <span style={{ width: 90, fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-tertiary)' }}>PILOT</span>
                <span style={{ width: 80, fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: 'var(--text-tertiary)' }}>STATUS</span>
              </div>
              {/* Rows */}
              <motion.div variants={tableContainer} initial="hidden" animate="visible">
                {data?.recentFlights.slice(0, 5).map((f) => {
                  const badge = statusBadge(f.status);
                  return (
                    <motion.div
                      key={f.id}
                      className="flex items-center"
                      style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-primary)', gap: 12 }}
                      variants={tableRow}
                    >
                      <span style={{ width: 70, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{f.flightNumber}</span>
                      <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {f.depIcao} → {f.arrIcao}
                      </span>
                      <span style={{ width: 90, fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>{f.pilotCallsign}</span>
                      <span
                        style={{
                          width: 80,
                          textAlign: 'center',
                          padding: '2px 8px',
                          borderRadius: 2,
                          fontSize: 9,
                          fontWeight: 600,
                          backgroundColor: badge.bg,
                          color: badge.text,
                        }}
                      >
                        {badge.label}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
              {(!data || data.recentFlights.length === 0) && (
                <div className="flex items-center justify-center" style={{ padding: 24, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  No recent PIREPs
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Sub-components ──────────────────────────────────────

function CardShell({ icon: Icon, title, date, children }: {
  icon: typeof Package;
  title: string;
  date: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col"
      style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)' }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Icon size={16} style={{ color: 'var(--accent-blue-bright)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{date}</span>
      </div>
      {children}
    </div>
  );
}

function BarMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center" style={{ gap: 8, width: '100%' }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 50, flexShrink: 0 }}>{label}</span>
      <div className="flex-1" style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--divider)' }}>
        <div className="bar-animate" style={{ height: '100%', width: `${value}%`, borderRadius: 3, backgroundColor: color }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)', width: 30, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

function BalanceChart({ data }: { data: FinancialSummary | undefined }) {
  if (!data || data.months.length === 0) return null;

  const cumulative: number[] = [];
  let running = 0;
  for (let i = 0; i < data.income.length; i++) {
    running += data.income[i] - data.costs[i];
    cumulative.push(running);
  }

  const min = Math.min(...cumulative);
  const max = Math.max(...cumulative);
  const range = max - min || 1;
  const w = 300;
  const h = 100;

  const points = cumulative.map((v, i) => {
    const x = (i / (cumulative.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 10);
    return `${x},${y}`;
  });

  const areaPoints = `0,${h} ${points.join(' ')} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0, 0.33, 0.66].map((p) => (
        <line key={p} x1="0" y1={h * p + 5} x2={w} y2={h * p + 5} stroke="var(--divider)" strokeWidth="0.5" opacity="0.5" />
      ))}
      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#balGrad)" className="chart-area-fade" />
      {/* Line */}
      <polyline points={points.join(' ')} fill="none" stroke="#4ade80" strokeWidth="1.5" className="chart-line-draw" />
    </svg>
  );
}

import { useNavigate } from 'react-router-dom';
import {
  Plane,
  Users,
  CalendarDays,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Route,
  BookOpen,
  Radio,
  Maximize2,
  Award,
  MapPin,
  Activity,
  UserPlus,
  ChevronRight,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

// ─── Mock Data ───────────────────────────────────────────────────

const STATS = [
  { label: 'Active Flights', value: 12, trend: +3, icon: Plane, iconBox: 'bg-acars-green/10 border-acars-green/20', iconColor: 'text-acars-green' },
  { label: 'Pilots Online', value: 8, trend: +2, icon: Users, iconBox: 'bg-acars-blue/10 border-acars-blue/20', iconColor: 'text-acars-blue' },
  { label: 'Flights This Month', value: 147, trend: +12, icon: CalendarDays, iconBox: 'bg-acars-amber/10 border-acars-amber/20', iconColor: 'text-acars-amber' },
  { label: 'Total Flight Hours', value: '24,831', trend: +186, icon: Clock, iconBox: 'bg-acars-cyan/10 border-acars-cyan/20', iconColor: 'text-acars-cyan' },
] as const;

type BidStatus = 'Scheduled' | 'Boarding' | 'Delayed';

interface ActiveBid {
  id: string;
  flightNo: string;
  route: string;
  aircraft: string;
  depTime: string;
  pilot: string;
  status: BidStatus;
}

const ACTIVE_BIDS: ActiveBid[] = [
  { id: '1', flightNo: 'UAL79', route: 'KIAH → KDEN', aircraft: 'B738', depTime: '07:50Z', pilot: 'J. Mitchell', status: 'Scheduled' },
  { id: '2', flightNo: 'UAL202', route: 'KLAX → KSFO', aircraft: 'A320', depTime: '08:15Z', pilot: 'S. Nakamura', status: 'Boarding' },
  { id: '3', flightNo: 'DAL412', route: 'KATL → KJFK', aircraft: 'B739', depTime: '09:00Z', pilot: 'R. Chen', status: 'Scheduled' },
  { id: '4', flightNo: 'AAL881', route: 'KDFW → KORD', aircraft: 'A321', depTime: '09:30Z', pilot: 'M. Torres', status: 'Delayed' },
  { id: '5', flightNo: 'SWA33', route: 'KLAS → KPHX', aircraft: 'B738', depTime: '10:00Z', pilot: 'A. Patel', status: 'Scheduled' },
  { id: '6', flightNo: 'UAL517', route: 'KSFO → KORD', aircraft: 'B772', depTime: '10:45Z', pilot: 'L. Davis', status: 'Scheduled' },
];

const QUICK_ACTIONS = [
  { label: 'Bid a Flight', icon: CalendarDays, to: '/schedule', iconBox: 'bg-acars-blue/10 border-acars-blue/20', iconColor: 'text-acars-blue' },
  { label: 'File Flight Plan', icon: Route, to: '/planning', iconBox: 'bg-acars-magenta/10 border-acars-magenta/20', iconColor: 'text-acars-magenta' },
  { label: 'View Logbook', icon: BookOpen, to: '/logbook', iconBox: 'bg-acars-amber/10 border-acars-amber/20', iconColor: 'text-acars-amber' },
  { label: 'Open Dispatch', icon: Radio, to: '/dispatch', iconBox: 'bg-acars-green/10 border-acars-green/20', iconColor: 'text-acars-green' },
] as const;

const LAST_FLIGHTS = [
  { date: 'Feb 16', route: 'KJFK → KLAX', duration: '5h 12m', landing: -142 },
  { date: 'Feb 14', route: 'KORD → KMIA', duration: '3h 08m', landing: -187 },
  { date: 'Feb 12', route: 'KSFO → KDEN', duration: '2h 41m', landing: -98 },
];

interface FeedEvent {
  id: string;
  type: 'completed' | 'bid' | 'joined' | 'groundstop';
  text: string;
  time: string;
}

const ACTIVITY_FEED: FeedEvent[] = [
  { id: '1', type: 'completed', text: 'J. Mitchell completed KIAH → KDEN — 3h 24m — Landing: -187fpm', time: '12 min ago' },
  { id: '2', type: 'bid', text: 'S. Nakamura bid on UAL202 KLAX → KSFO', time: '28 min ago' },
  { id: '3', type: 'completed', text: 'R. Chen completed KATL → KJFK — 2h 11m — Landing: -142fpm', time: '1h ago' },
  { id: '4', type: 'joined', text: 'A. Patel joined the VA', time: '2h ago' },
  { id: '5', type: 'groundstop', text: 'Ground Stop lifted at KDEN', time: '3h ago' },
  { id: '6', type: 'completed', text: 'L. Davis completed KSFO → KORD — 4h 02m — Landing: -205fpm', time: '4h ago' },
  { id: '7', type: 'bid', text: 'M. Torres bid on AAL881 KDFW → KORD', time: '5h ago' },
  { id: '8', type: 'completed', text: 'K. Brown completed KMIA → KBOS — 3h 18m — Landing: -113fpm', time: '6h ago' },
];

// ─── Map Flights (for the preview) ──────────────────────────────

interface MapFlight {
  id: string;
  callsign: string;
  lat: number;
  lng: number;
  heading: number;
}

const MAP_FLIGHTS: MapFlight[] = [
  { id: '1', callsign: 'UAL79', lat: 37.5, lng: -101.2, heading: 315 },
  { id: '2', callsign: 'UAL202', lat: 35.8, lng: -119.5, heading: 340 },
  { id: '3', callsign: 'DAL412', lat: 35.2, lng: -79.4, heading: 45 },
  { id: '4', callsign: 'AAL881', lat: 35.5, lng: -94.3, heading: 10 },
  { id: '5', callsign: 'SWA33', lat: 35.0, lng: -113.5, heading: 200 },
];

// ─── Sub-Components ─────────────────────────────────────────────

const STATUS_COLORS: Record<BidStatus, string> = {
  Scheduled: 'bg-acars-blue/20 text-acars-blue border-acars-blue/30',
  Boarding: 'bg-acars-amber/20 text-acars-amber border-acars-amber/30',
  Delayed: 'bg-acars-red/20 text-acars-red border-acars-red/30',
};

function StatCard({ label, value, trend, icon: Icon, iconBox, iconColor }: typeof STATS[number]) {
  const isPositive = trend > 0;
  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className={`flex items-center justify-center w-11 h-11 rounded-xl border ${iconBox}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-acars-muted font-medium">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-acars-text tabular-nums">{value}</span>
          <span className={`flex items-center gap-0.5 text-[11px] font-medium ${isPositive ? 'text-acars-green' : 'text-acars-red'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{trend}
          </span>
        </div>
      </div>
    </div>
  );
}

function ActiveBidsTable() {
  const navigate = useNavigate();

  return (
    <div className="panel flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <h3 className="text-sm font-semibold text-acars-text">Active Bids</h3>
        <button
          onClick={() => navigate('/schedule')}
          className="flex items-center gap-1 text-[11px] font-medium text-acars-blue hover:text-acars-text transition-colors"
        >
          Bid a Flight <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-acars-muted border-b border-acars-border">
              <th className="text-left px-4 py-2 font-medium">Flight #</th>
              <th className="text-left px-4 py-2 font-medium">Route</th>
              <th className="text-left px-4 py-2 font-medium hidden xl:table-cell">Aircraft</th>
              <th className="text-left px-4 py-2 font-medium">Dep (Z)</th>
              <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Pilot</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVE_BIDS.map((bid, i) => (
              <tr
                key={bid.id}
                className={`border-b border-acars-border/50 hover:bg-[#1c2433] transition-colors ${
                  i % 2 === 0 ? 'bg-acars-panel' : 'bg-acars-bg'
                }`}
              >
                <td className="px-4 py-2.5 font-mono font-medium text-acars-text">{bid.flightNo}</td>
                <td className="px-4 py-2.5 text-acars-muted">{bid.route}</td>
                <td className="px-4 py-2.5 text-acars-muted hidden xl:table-cell">{bid.aircraft}</td>
                <td className="px-4 py-2.5 font-mono text-acars-muted tabular-nums">{bid.depTime}</td>
                <td className="px-4 py-2.5 text-acars-muted hidden lg:table-cell">{bid.pilot}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.05em] border ${STATUS_COLORS[bid.status]}`}>
                    {bid.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button className="text-acars-blue hover:text-acars-text text-[11px] font-medium transition-colors">
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="panel flex flex-col h-full">
      <div className="px-4 py-3 border-b border-acars-border">
        <h3 className="text-sm font-semibold text-acars-text">Quick Actions</h3>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 p-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className="flex flex-col items-center justify-center gap-2.5 rounded-lg border border-acars-border bg-acars-bg hover:border-acars-blue hover:bg-[#1c2433] transition-all duration-200 p-4"
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl border ${action.iconBox}`}>
                <Icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <span className="text-xs font-medium text-acars-muted">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LiveMapPreview() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Dark background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw grid lines (subtle)
    ctx.strokeStyle = '#161b22';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < rect.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, rect.height);
      ctx.stroke();
    }
    for (let i = 0; i < rect.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(rect.width, i);
      ctx.stroke();
    }

    // Draw simplified US outline (rough coastline)
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rect.width * 0.15, rect.height * 0.3);
    ctx.lineTo(rect.width * 0.3, rect.height * 0.25);
    ctx.lineTo(rect.width * 0.5, rect.height * 0.2);
    ctx.lineTo(rect.width * 0.7, rect.height * 0.25);
    ctx.lineTo(rect.width * 0.85, rect.height * 0.3);
    ctx.lineTo(rect.width * 0.88, rect.height * 0.5);
    ctx.lineTo(rect.width * 0.82, rect.height * 0.75);
    ctx.lineTo(rect.width * 0.6, rect.height * 0.8);
    ctx.lineTo(rect.width * 0.4, rect.height * 0.78);
    ctx.lineTo(rect.width * 0.2, rect.height * 0.7);
    ctx.lineTo(rect.width * 0.12, rect.height * 0.5);
    ctx.closePath();
    ctx.stroke();

    // Project flights onto canvas (rough mercator)
    const lonToX = (lng: number) => ((lng + 125) / 60) * rect.width;
    const latToY = (lat: number) => ((50 - lat) / 22) * rect.height;

    MAP_FLIGHTS.forEach((f) => {
      const x = lonToX(f.lng);
      const y = latToY(f.lat);

      // Aircraft dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#58a6ff';
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(88, 166, 255, 0.15)';
      ctx.fill();

      // Callsign label
      ctx.fillStyle = '#8b949e';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(f.callsign, x + 8, y + 3);
    });
  }, []);

  return (
    <div className="panel flex flex-col h-[320px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <h3 className="text-sm font-semibold text-acars-text">Live Map</h3>
        <button
          onClick={() => navigate('/map')}
          className="flex items-center gap-1 text-[11px] font-medium text-acars-blue hover:text-acars-text transition-colors"
        >
          Expand <Maximize2 className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute bottom-2 left-2 text-[9px] text-acars-muted bg-acars-bg/80 px-2 py-1 rounded">
          {MAP_FLIGHTS.length} active flights
        </div>
      </div>
    </div>
  );
}

function MyInfoCard() {
  return (
    <div className="panel flex flex-col h-[320px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <h3 className="text-sm font-semibold text-acars-text">My Info</h3>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
        {/* Profile header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-full bg-acars-blue/20 text-acars-blue text-sm font-semibold shrink-0">
            PA
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-acars-text">Pilot Admin</p>
            <div className="flex items-center gap-2 text-[11px] text-acars-muted">
              <span>SMA-001</span>
              <span className="text-acars-border">|</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> KJFK</span>
            </div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-acars-amber bg-acars-amber/10 border border-acars-amber/20 px-2 py-0.5 rounded-full">
            <Award className="w-3 h-3" /> Senior F/O
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Hours', value: '847' },
            { label: 'Flights', value: '312' },
            { label: 'Landings', value: '308' },
            { label: 'Streak', value: '14d' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-sm font-semibold text-acars-text tabular-nums">{s.value}</p>
              <p className="text-[9px] uppercase tracking-wider text-acars-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rank progress */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-acars-muted">Senior First Officer</span>
            <span className="text-acars-muted tabular-nums">847 / 1,000 hrs</span>
          </div>
          <div className="h-1.5 rounded-full bg-acars-border/50 overflow-hidden">
            <div className="h-full rounded-full bg-acars-amber" style={{ width: '84.7%' }} />
          </div>
          <p className="text-[10px] text-acars-muted mt-1">153 hrs to <span className="text-acars-amber font-medium">Captain</span></p>
        </div>

        {/* Last flights */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-2">Recent Flights</p>
          <div className="space-y-1.5">
            {LAST_FLIGHTS.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-acars-border/30 last:border-0">
                <span className="text-acars-muted w-14">{f.date}</span>
                <span className="text-acars-text font-mono">{f.route}</span>
                <span className="text-acars-muted tabular-nums">{f.duration}</span>
                <span className={`font-mono tabular-nums ${Math.abs(f.landing) <= 150 ? 'text-acars-green' : 'text-acars-amber'}`}>
                  {f.landing}fpm
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FEED_ICONS: Record<FeedEvent['type'], { icon: typeof Plane; color: string }> = {
  completed: { icon: Plane, color: 'text-acars-green' },
  bid: { icon: CalendarDays, color: 'text-acars-blue' },
  joined: { icon: UserPlus, color: 'text-acars-magenta' },
  groundstop: { icon: Activity, color: 'text-acars-amber' },
};

function ActivityFeed() {
  return (
    <div className="panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-acars-border">
        <h3 className="text-sm font-semibold text-acars-text">Recent Activity</h3>
        <span className="text-[10px] text-acars-muted uppercase tracking-wider">VA-Wide Feed</span>
      </div>
      <div className="divide-y divide-acars-border/30">
        {ACTIVITY_FEED.map((event) => {
          const { icon: Icon, color } = FEED_ICONS[event.type];
          return (
            <div
              key={event.id}
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-[#1c2433] transition-colors group"
            >
              <div className={`mt-0.5 ${color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <p className="flex-1 text-xs text-acars-muted leading-relaxed">
                {event.text}
              </p>
              <span className="text-[10px] text-acars-muted/60 whitespace-nowrap shrink-0 tabular-nums">
                {event.time}
              </span>
              <ChevronRight className="w-3 h-3 text-acars-muted/30 group-hover:text-acars-muted transition-colors shrink-0 mt-0.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────

export function DashboardPage() {
  return (
    <div className="p-5 space-y-5 overflow-auto h-full">
      {/* Row 1: Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Row 2: Active Bids + Quick Actions */}
      <div className="grid grid-cols-[1fr_340px] gap-4">
        <ActiveBidsTable />
        <QuickActions />
      </div>

      {/* Row 3: Live Map Preview + My Info */}
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <LiveMapPreview />
        <MyInfoCard />
      </div>

      {/* Row 4: Activity Feed */}
      <ActivityFeed />
    </div>
  );
}

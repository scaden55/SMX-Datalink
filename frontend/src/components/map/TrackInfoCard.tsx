import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { Plane, Clock, Route, ArrowUpDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { altitudeToColor } from '@acars/shared';
import type { TrackPoint } from '@acars/shared';

// ── Helpers ──────────────────────────────────────────────────

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

// ── Component ───────────────────────────────────────────────

interface Props {
  points: TrackPoint[];
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
}

/**
 * Floating overlay card showing track statistics and altitude sparkline.
 * Positioned at the bottom-center of the map when a bid is selected.
 */
export function TrackInfoCard({ points, flightNumber, depIcao, arrIcao }: Props) {
  const stats = useMemo(() => {
    if (points.length === 0) return null;

    const first = points[0];
    const last = points[points.length - 1];
    const duration = last.recordedAt - first.recordedAt;

    // Total distance flown
    let totalNm = 0;
    for (let i = 1; i < points.length; i++) {
      totalNm += haversineNm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    }

    // Max altitude
    let maxAlt = 0;
    for (const p of points) {
      if (p.altitudeFt > maxAlt) maxAlt = p.altitudeFt;
    }

    // Current VS trend
    const currentAlt = last.altitudeFt;
    const currentVs = last.vsFpm;

    // Sparkline data (downsample to ~60 points max)
    const step = Math.max(1, Math.floor(points.length / 60));
    const sparkData: { alt: number }[] = [];
    for (let i = 0; i < points.length; i += step) {
      sparkData.push({ alt: points[i].altitudeFt });
    }
    // Always include last point
    if (sparkData.length > 0 && sparkData[sparkData.length - 1].alt !== last.altitudeFt) {
      sparkData.push({ alt: last.altitudeFt });
    }

    return { duration, totalNm, maxAlt, currentAlt, currentVs, sparkData };
  }, [points]);

  if (!stats) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-acars-panel rounded-md border border-acars-border px-4 py-2">
        <span className="text-xs text-acars-muted">No track data yet</span>
      </div>
    );
  }

  const altColor = altitudeToColor(stats.currentAlt);
  const VsIcon = stats.currentVs > 200 ? TrendingUp : stats.currentVs < -200 ? TrendingDown : Minus;
  const vsColor = stats.currentVs > 200 ? 'text-green-400' : stats.currentVs < -200 ? 'text-orange-400' : 'text-acars-muted';

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-acars-panel rounded-md border border-acars-border overflow-hidden" style={{ width: 420 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-acars-border">
        <div className="flex items-center gap-2">
          <Plane className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-bold text-acars-text font-mono tracking-wide">{flightNumber}</span>
          <span className="text-[10px] text-acars-muted font-mono">{depIcao} → {arrIcao}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: altColor }} />
          <span className="text-[10px] font-mono text-acars-text">{stats.currentAlt.toLocaleString()} ft</span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-12 px-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trackAltGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a9eff" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#4a9eff" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Area
              type="monotone"
              dataKey="alt"
              stroke="#4a9eff"
              strokeWidth={1.5}
              fill="url(#trackAltGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-around px-2 py-1.5 border-t border-acars-border text-[10px]">
        <div className="flex items-center gap-1 text-acars-muted">
          <Clock className="w-3 h-3" />
          <span className="text-acars-text font-mono">{formatDuration(stats.duration)}</span>
        </div>
        <div className="flex items-center gap-1 text-acars-muted">
          <Route className="w-3 h-3" />
          <span className="text-acars-text font-mono">{Math.round(stats.totalNm)} nm</span>
        </div>
        <div className="flex items-center gap-1 text-acars-muted">
          <ArrowUpDown className="w-3 h-3" />
          <span className="text-acars-text font-mono">{stats.maxAlt.toLocaleString()} ft max</span>
        </div>
        <div className="flex items-center gap-1 text-acars-muted">
          <VsIcon className={`w-3 h-3 ${vsColor}`} />
          <span className={`font-mono ${vsColor}`}>
            {stats.currentVs > 0 ? '+' : ''}{Math.round(stats.currentVs)} fpm
          </span>
        </div>
      </div>
    </div>
  );
}

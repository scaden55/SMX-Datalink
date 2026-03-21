import { memo } from 'react';

/** Filled area chart (balance history) */
export const AreaChart = memo(function AreaChart({
  data,
  height = 36,
  color = 'rgba(74,222,128,0.18)',
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * height}`).join(' ');
  const fillPoints = `0,${height} ${points} ${w},${height}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polygon fill={color} points={fillPoints} />
      <polyline fill="none" stroke={color.replace(/[\d.]+\)$/, '0.6)')} strokeWidth="1.5" points={points} />
    </svg>
  );
});

/** 6-bar trend chart (RATM/CATM monthly) */
export const BarTrend = memo(function BarTrend({
  data,
  height = 24,
  color = 'var(--accent-emerald)',
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 0.01);
  const gap = 2;
  const barCount = data.length;

  return (
    <div style={{ display: 'flex', gap: `${gap}px`, alignItems: 'end', height }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            background: color,
            opacity: i === barCount - 1 ? 0.7 : 0.25,
            borderRadius: 2,
            minHeight: 2,
          }}
        />
      ))}
    </div>
  );
});

/** Polyline sparkline */
export const Sparkline = memo(function Sparkline({
  data,
  height = 18,
  color = 'var(--accent-blue)',
  strokeWidth = 1.5,
}: {
  data: number[];
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 0.01);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 2) - 1}`).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline fill="none" stroke={color} strokeWidth={strokeWidth} points={points} />
    </svg>
  );
});

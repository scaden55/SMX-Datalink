import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

const MARGIN = { top: 10, right: 40, bottom: 25, left: 50 };

const CLR_CLIMB = '#d2a8ff';
const CLR_CRUISE = '#58a6ff';
const CLR_DESCENT = '#3fb950';

/** Observe element size via ResizeObserver, returning [width, height]. */
function useSize(ref: React.RefObject<HTMLElement | null>): [number, number] {
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize((prev) => (prev[0] === width && prev[1] === height ? prev : [width, height]));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

export function VerticalProfile() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, containerH] = useSize(containerRef);
  const telemetry = useTelemetry();
  const { isOwnFlight } = useDispatchEdit();
  const aircraft = isOwnFlight ? telemetry.aircraft : null;
  const connected = isOwnFlight ? telemetry.connected : false;
  const isStale = isOwnFlight ? telemetry.isStale : true;
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  useEffect(() => {
    if (!svgRef.current || containerW <= 0 || containerH <= 0) return;

    const width = containerW;
    const height = containerH;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', height);

    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    if (innerW <= 0 || innerH <= 0) return;

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // If no flight plan, show placeholder
    if (!flightPlan || flightPlan.waypoints.length < 2) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgb(var(--text-secondary-rgb))')
        .attr('font-size', '11px')
        .text('No flight plan loaded — vertical profile unavailable');
      return;
    }

    // Build points array with index-based x positioning
    const points = flightPlan.waypoints.map((wp) => ({
      alt: wp.altitude ?? 0,
      ident: wp.ident,
      wpType: wp.type,
    }));

    // Evenly-spaced x scale by waypoint index (avoids curve artifacts from clustered distances)
    const xScale = d3
      .scalePoint<number>()
      .domain(points.map((_, i) => i))
      .range([0, innerW]);

    const yScale = d3
      .scaleLinear()
      .domain([0, (d3.max(points, (d) => d.alt) ?? 40000) + 10000])
      .range([innerH, 0]);

    // Find TOC/TOD
    const maxAlt = d3.max(points, (d) => d.alt) ?? 0;
    const threshold = maxAlt * 0.90;
    let tocIndex = 0;
    let todIndex = points.length - 1;
    for (let i = 0; i < points.length; i++) {
      if (points[i].alt >= threshold) { tocIndex = i; break; }
    }
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].alt >= threshold) { todIndex = i; break; }
    }

    // Terrain silhouette (simplified — flat terrain placeholder)
    g.append('rect')
      .attr('x', 0)
      .attr('y', innerH - 2)
      .attr('width', innerW)
      .attr('height', 2)
      .attr('fill', '#3fb950')
      .attr('opacity', 0.3);

    // Index-aware point type for line generators
    type IxPt = { idx: number; alt: number };

    // Draw segmented altitude profile lines
    const lineFn = d3
      .line<IxPt>()
      .x((d) => xScale(d.idx) ?? 0)
      .y((d) => yScale(d.alt))
      .curve(d3.curveLinear);

    const ixPoints: IxPt[] = points.map((p, i) => ({ idx: i, alt: p.alt }));

    // Climb segment (0 → TOC inclusive)
    const climbPts = ixPoints.slice(0, tocIndex + 1);
    if (climbPts.length >= 2) {
      g.append('path')
        .datum(climbPts)
        .attr('d', lineFn)
        .attr('fill', 'none')
        .attr('stroke', CLR_CLIMB)
        .attr('stroke-width', 2);
    }

    // Cruise segment (TOC → TOD inclusive)
    const cruisePts = ixPoints.slice(tocIndex, todIndex + 1);
    if (cruisePts.length >= 2) {
      g.append('path')
        .datum(cruisePts)
        .attr('d', lineFn)
        .attr('fill', 'none')
        .attr('stroke', CLR_CRUISE)
        .attr('stroke-width', 2);
    }

    // Descent segment (TOD → end inclusive)
    const descentPts = ixPoints.slice(todIndex);
    if (descentPts.length >= 2) {
      g.append('path')
        .datum(descentPts)
        .attr('d', lineFn)
        .attr('fill', 'none')
        .attr('stroke', CLR_DESCENT)
        .attr('stroke-width', 2);
    }

    // Waypoint dots — shape by type, color by phase
    const R = 4;
    const hexPath = (cx: number, cy: number) =>
      Array.from({ length: 6 }, (_, k) => {
        const a = (Math.PI / 3) * k - Math.PI / 2;
        return `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`;
      }).join(' ');

    points.forEach((pt, i) => {
      const cx = xScale(i) ?? 0;
      const cy = yScale(pt.alt);
      const color = i < tocIndex ? CLR_CLIMB : i > todIndex ? CLR_DESCENT : CLR_CRUISE;
      const fill = 'var(--bg-app)';

      switch (pt.wpType) {
        case 'airport': // Square
          g.append('rect').attr('x', cx - R).attr('y', cy - R).attr('width', R * 2).attr('height', R * 2)
            .attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
          break;
        case 'vor': // Hexagon
          g.append('polygon').attr('points', hexPath(cx, cy))
            .attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
          break;
        case 'gps': // Diamond
          g.append('polygon').attr('points', `${cx},${cy - R} ${cx + R},${cy} ${cx},${cy + R} ${cx - R},${cy}`)
            .attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
          break;
        case 'ndb': // Circle
          g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', R)
            .attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
          break;
        default: // Triangle — intersection/fix
          g.append('polygon').attr('points', `${cx},${cy - R} ${cx + R},${cy + R} ${cx - R},${cy + R}`)
            .attr('fill', fill).attr('stroke', color).attr('stroke-width', 1.5);
          break;
      }
    });

    // Waypoint labels on x-axis — thin to avoid overcrowding
    const maxLabelsCount = Math.max(4, Math.floor(innerW / 55));
    const labelInterval = Math.max(1, Math.ceil(points.length / maxLabelsCount));
    const labelIndices = points
      .map((p, i) => ({ ...p, i }))
      .filter((_, i) => i === 0 || i === points.length - 1 || i % labelInterval === 0);

    g.selectAll('.wp-label')
      .data(labelIndices)
      .enter()
      .append('text')
      .attr('x', (d) => xScale(d.i) ?? 0)
      .attr('y', innerH + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgb(var(--text-secondary-rgb))')
      .attr('font-size', '8px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text((d) => d.ident);

    // Y-axis (FL labels)
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(Math.max(2, Math.floor(innerH / 30)))
      .tickFormat((d) => `FL${(+d / 100).toFixed(0)}`);

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', 'rgb(var(--text-secondary-rgb))')
      .attr('font-size', '9px');

    g.selectAll('.domain, .tick line').attr('stroke', 'var(--border-panel)');

    // Current altitude indicator — only when SimConnect is actively returning data
    if (aircraft && connected && !isStale) {
      const currentAlt = aircraft.position.altitude;
      // Placeholder x position (30% of chart) — needs real waypoint progress tracking
      const currentX = innerW * 0.3;
      const sz = 16;

      // Drop shadow
      const defs = svg.select('defs').empty()
        ? svg.insert('defs', ':first-child')
        : svg.select('defs');
      defs.append('filter')
        .attr('id', 'aircraft-shadow')
        .append('feDropShadow')
        .attr('dx', 0).attr('dy', 1)
        .attr('stdDeviation', 1.5)
        .attr('flood-color', '#000')
        .attr('flood-opacity', 0.5);

      // Clean top-down airplane silhouette facing right
      g.append('svg')
        .attr('x', currentX - sz / 2)
        .attr('y', yScale(currentAlt) - sz / 2)
        .attr('width', sz)
        .attr('height', sz)
        .attr('viewBox', '0 0 24 24')
        .attr('style', 'overflow:visible')
        .append('path')
        .attr('d', 'M22,12 L16,6 L15,7 L16,11 L4,7.5 L2,9 L14,12 L2,15 L4,16.5 L16,13 L15,17 L16,18 Z')
        .attr('fill', 'white')
        .attr('filter', 'url(#aircraft-shadow)');
    }
  }, [flightPlan, aircraft, connected, isStale, containerW, containerH]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-acars-panel border-t border-acars-border"
    >
      <svg ref={svgRef} className="block" />
    </div>
  );
}

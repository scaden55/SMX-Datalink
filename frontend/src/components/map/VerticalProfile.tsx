import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

const MARGIN = { top: 10, right: 40, bottom: 25, left: 50 };
const HEIGHT = 120;

export function VerticalProfile() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { aircraft } = useTelemetry();
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', HEIGHT);

    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // If no flight plan, show placeholder
    if (!flightPlan || flightPlan.waypoints.length < 2) {
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#8b949e')
        .attr('font-size', '11px')
        .text('No flight plan loaded — vertical profile unavailable');
      return;
    }

    // Build cumulative distance array
    let cumDist = 0;
    const points = flightPlan.waypoints.map((wp, i) => {
      if (i > 0) cumDist += wp.distanceFromPrevious;
      return { dist: cumDist, alt: wp.altitude ?? 0, ident: wp.ident };
    });

    const xScale = d3.scaleLinear().domain([0, cumDist]).range([0, innerW]);
    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(points, (d) => d.alt) ?? 40000])
      .range([innerH, 0]);

    // Terrain silhouette (simplified — flat terrain placeholder)
    g.append('rect')
      .attr('x', 0)
      .attr('y', innerH - 2)
      .attr('width', innerW)
      .attr('height', 2)
      .attr('fill', '#3fb950')
      .attr('opacity', 0.3);

    // Altitude profile line
    const line = d3
      .line<(typeof points)[number]>()
      .x((d) => xScale(d.dist))
      .y((d) => yScale(d.alt))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(points)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#d2a8ff')
      .attr('stroke-width', 2);

    // Waypoint dots
    g.selectAll('.wp-dot')
      .data(points)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d.dist))
      .attr('cy', (d) => yScale(d.alt))
      .attr('r', 3)
      .attr('fill', '#d2a8ff');

    // Waypoint labels on x-axis
    g.selectAll('.wp-label')
      .data(points)
      .enter()
      .append('text')
      .attr('x', (d) => xScale(d.dist))
      .attr('y', innerH + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', '#8b949e')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .text((d) => d.ident);

    // Y-axis (FL labels)
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickFormat((d) => `FL${(+d / 100).toFixed(0)}`);

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#8b949e')
      .attr('font-size', '9px');

    g.selectAll('.domain, .tick line').attr('stroke', '#30363d');

    // Current altitude dot
    if (aircraft) {
      const currentAlt = aircraft.position.altitude;
      // Approximate current position on profile (simple linear interpolation)
      const currentX = innerW * 0.3; // placeholder — needs real distance tracking
      g.append('circle')
        .attr('cx', currentX)
        .attr('cy', yScale(currentAlt))
        .attr('r', 5)
        .attr('fill', '#79c0ff')
        .attr('stroke', '#0d1117')
        .attr('stroke-width', 1.5);
    }
  }, [flightPlan, aircraft]);

  return (
    <div
      ref={containerRef}
      className="bg-acars-panel/90 border-t border-acars-border backdrop-blur-sm"
    >
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}

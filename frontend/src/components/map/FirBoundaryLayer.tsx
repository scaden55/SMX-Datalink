import { useEffect, useState, useMemo, useCallback } from 'react';
import { GeoJSON, Tooltip } from 'react-leaflet';
import type { PathOptions, Layer } from 'leaflet';
import type { VatsimControllerWithPosition } from '@acars/shared';

interface Props {
  controllers: VatsimControllerWithPosition[];
  visible: boolean;
}

interface GeoJsonFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: any;
}

interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/**
 * Renders FIR boundary polygons on the map.
 * Online FIRs (with an active CTR controller) get a cyan highlight.
 * Offline FIRs get a thin gray border.
 */
export function FirBoundaryLayer({ controllers, visible }: Props) {
  const [geoJson, setGeoJson] = useState<GeoJsonCollection | null>(null);

  useEffect(() => {
    fetch('/api/vatsim/boundaries/fir')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGeoJson(data);
      })
      .catch(() => {});
  }, []);

  // Build set of online FIR IDs from CTR/FSS controllers
  const onlineFirIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ctrl of controllers) {
      if ((ctrl.facility === 6 || ctrl.facility === 1) && ctrl.boundaryId) {
        ids.add(ctrl.boundaryId);
      }
    }
    return ids;
  }, [controllers]);

  // Build callsign + frequency map for tooltips
  const firControllerInfo = useMemo(() => {
    const map = new Map<string, { callsign: string; frequency: string }>();
    for (const ctrl of controllers) {
      if ((ctrl.facility === 6 || ctrl.facility === 1) && ctrl.boundaryId) {
        map.set(ctrl.boundaryId, { callsign: ctrl.callsign, frequency: ctrl.frequency });
      }
    }
    return map;
  }, [controllers]);

  const style = useCallback(
    (feature?: GeoJsonFeature): PathOptions => {
      if (!feature) return {};
      const id = feature.properties.id || feature.properties.icao || feature.properties.ICAO || '';
      const isOnline = onlineFirIds.has(id);
      return {
        color: isOnline ? '#22d3ee' : '#2e3138',
        weight: isOnline ? 2 : 0.8,
        opacity: isOnline ? 0.8 : 0.4,
        fillColor: isOnline ? '#22d3ee' : 'transparent',
        fillOpacity: isOnline ? 0.08 : 0,
      };
    },
    [onlineFirIds],
  );

  const onEachFeature = useCallback(
    (feature: GeoJsonFeature, layer: Layer) => {
      const id = feature.properties.id || feature.properties.icao || feature.properties.ICAO || '';
      const name = feature.properties.name || feature.properties.NAME || id;
      const info = firControllerInfo.get(id);
      const tooltip = info
        ? `${name}\n${info.callsign} — ${info.frequency}`
        : name;
      layer.bindTooltip(tooltip, {
        sticky: true,
        className: 'vatsim-boundary-tooltip',
        direction: 'top',
      });
    },
    [firControllerInfo],
  );

  if (!visible || !geoJson) return null;

  return (
    <GeoJSON
      key={`fir-${onlineFirIds.size}`}
      data={geoJson}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

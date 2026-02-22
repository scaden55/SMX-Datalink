import { useEffect, useState, useMemo, useCallback } from 'react';
import { GeoJSON } from 'react-leaflet';
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
 * Renders TRACON/APP boundary polygons on the map.
 * Only shows boundaries that have an active APP/DEP controller.
 * Amber/orange color scheme to distinguish from cyan FIR boundaries.
 */
export function TraconBoundaryLayer({ controllers, visible }: Props) {
  const [geoJson, setGeoJson] = useState<GeoJsonCollection | null>(null);

  useEffect(() => {
    fetch('/api/vatsim/boundaries/tracon')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setGeoJson(data);
      })
      .catch(() => {});
  }, []);

  // Build set of online TRACON IDs from APP controllers
  const onlineTraconIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ctrl of controllers) {
      if (ctrl.facility === 5 && ctrl.boundaryId) {
        ids.add(ctrl.boundaryId);
      }
    }
    return ids;
  }, [controllers]);

  // Controller info for tooltips
  const traconControllerInfo = useMemo(() => {
    const map = new Map<string, { callsign: string; frequency: string }>();
    for (const ctrl of controllers) {
      if (ctrl.facility === 5 && ctrl.boundaryId) {
        map.set(ctrl.boundaryId, { callsign: ctrl.callsign, frequency: ctrl.frequency });
      }
    }
    return map;
  }, [controllers]);

  const style = useCallback(
    (feature?: GeoJsonFeature): PathOptions => {
      if (!feature) return {};
      const id = feature.properties.id || feature.properties.prefix || feature.properties.ICAO || '';
      const isOnline = onlineTraconIds.has(id);
      if (!isOnline) return { opacity: 0, fillOpacity: 0 }; // hide inactive TRACONs
      return {
        color: '#f59e0b',
        weight: 1.5,
        opacity: 0.7,
        fillColor: '#f59e0b',
        fillOpacity: 0.06,
      };
    },
    [onlineTraconIds],
  );

  const onEachFeature = useCallback(
    (feature: GeoJsonFeature, layer: Layer) => {
      const id = feature.properties.id || feature.properties.prefix || feature.properties.ICAO || '';
      const name = feature.properties.name || feature.properties.NAME || id;
      const info = traconControllerInfo.get(id);
      if (info) {
        layer.bindTooltip(`${name}\n${info.callsign} — ${info.frequency}`, {
          sticky: true,
          className: 'vatsim-boundary-tooltip',
          direction: 'top',
        });
      }
    },
    [traconControllerInfo],
  );

  if (!visible || !geoJson) return null;

  return (
    <GeoJSON
      key={`tracon-${onlineTraconIds.size}`}
      data={geoJson}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

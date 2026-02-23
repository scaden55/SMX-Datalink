import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import type { PathOptions, Layer } from 'leaflet';
import type { VatsimControllerWithPosition } from '@acars/shared';
import { getApiBase } from '../../lib/api';

interface Props {
  controllers: VatsimControllerWithPosition[];
  visible: boolean;
  hoveredAirspaceId: string | null;
  onHoverAirspace: (id: string | null, feature: GeoJSON.Feature | null, event: L.LeafletMouseEvent | null) => void;
  onSelectAirspace: (id: string, feature: GeoJSON.Feature) => void;
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
export function TraconBoundaryLayer({ controllers, visible, hoveredAirspaceId, onHoverAirspace, onSelectAirspace }: Props) {
  const [geoJson, setGeoJson] = useState<GeoJsonCollection | null>(null);

  useEffect(() => {
    fetch(`${getApiBase()}/api/vatsim/boundaries/tracon`)
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

  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  // Update styles reactively when hoveredAirspaceId changes (avoids full GeoJSON remount)
  useEffect(() => {
    if (!geoJsonRef.current) return;
    geoJsonRef.current.eachLayer((layer: any) => {
      const feature = layer.feature as GeoJsonFeature | undefined;
      if (!feature) return;
      const id = feature.properties.id || feature.properties.prefix || feature.properties.ICAO || '';
      const isOnline = onlineTraconIds.has(id);
      const isHovered = hoveredAirspaceId === id;
      if (!isOnline) {
        (layer as L.Path).setStyle({ opacity: 0, fillOpacity: 0 });
        return;
      }
      (layer as L.Path).setStyle({
        color: '#f59e0b',
        weight: isHovered ? 2.5 : 1.5,
        opacity: isHovered ? 1 : 0.7,
        fillColor: '#f59e0b',
        fillOpacity: isHovered ? 0.15 : 0.06,
      });
    });
  }, [hoveredAirspaceId, onlineTraconIds]);

  const style = useCallback(
    (feature?: GeoJsonFeature): PathOptions => {
      if (!feature) return {};
      const id = feature.properties.id || feature.properties.prefix || feature.properties.ICAO || '';
      const isOnline = onlineTraconIds.has(id);
      if (!isOnline) return { opacity: 0, fillOpacity: 0 };
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
        (layer as L.Path).getElement()?.classList.add('leaflet-interactive');
        layer.on('mouseover', (e: L.LeafletMouseEvent) => {
          onHoverAirspace(id, feature as GeoJSON.Feature, e);
        });
        layer.on('mouseout', () => {
          onHoverAirspace(null, null, null);
        });
        layer.on('click', () => {
          onSelectAirspace(id, feature as GeoJSON.Feature);
        });

        layer.bindTooltip(`${name}\n${info.callsign} — ${info.frequency}`, {
          sticky: true,
          className: 'vatsim-boundary-tooltip',
          direction: 'top',
        });
      }
    },
    [traconControllerInfo, onHoverAirspace, onSelectAirspace],
  );

  if (!visible || !geoJson) return null;

  return (
    <GeoJSON
      key={`tracon-${onlineTraconIds.size}`}
      ref={(r) => { geoJsonRef.current = r as L.GeoJSON | null; }}
      data={geoJson}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

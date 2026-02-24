import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
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
 * Renders FIR boundary polygons on the map with interactive badge markers.
 * Online FIRs get a cyan highlight + a clickable badge at label_lat/label_lon.
 * Offline FIRs get a thin gray border.
 */
export function FirBoundaryLayer({ controllers, visible, hoveredAirspaceId, onHoverAirspace, onSelectAirspace }: Props) {
  const map = useMap();
  const [geoJson, setGeoJson] = useState<GeoJsonCollection | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const badgeGroupRef = useRef<L.LayerGroup | null>(null);
  const badgeMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    fetch(`${getApiBase()}/api/vatsim/boundaries/fir`)
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

  // Build callsign + frequency map for badge tooltips
  const firControllerInfo = useMemo(() => {
    const infoMap = new Map<string, { callsign: string; frequency: string }>();
    for (const ctrl of controllers) {
      if ((ctrl.facility === 6 || ctrl.facility === 1) && ctrl.boundaryId) {
        infoMap.set(ctrl.boundaryId, { callsign: ctrl.callsign, frequency: ctrl.frequency });
      }
    }
    return infoMap;
  }, [controllers]);

  // ── Polygon styles (reactive hover highlight) ──────────────
  useEffect(() => {
    if (!geoJsonRef.current) return;
    geoJsonRef.current.eachLayer((layer: any) => {
      const feature = layer.feature as GeoJsonFeature | undefined;
      if (!feature) return;
      const id = feature.properties.id || feature.properties.icao || feature.properties.ICAO || '';
      const isOnline = onlineFirIds.has(id);
      const isHovered = hoveredAirspaceId === id;
      (layer as L.Path).setStyle({
        color: isOnline ? '#22d3ee' : '#2e3138',
        weight: isOnline ? (isHovered ? 1.5 : 1) : 0.5,
        opacity: isOnline ? (isHovered ? 1 : 0.7) : 0.3,
        fillColor: isOnline ? '#22d3ee' : 'transparent',
        fillOpacity: isOnline ? (isHovered ? 0.15 : 0.08) : 0,
        interactive: false,
      });
    });
  }, [hoveredAirspaceId, onlineFirIds]);

  const style = useCallback(
    (feature?: GeoJsonFeature): PathOptions => {
      if (!feature) return {};
      const id = feature.properties.id || feature.properties.icao || feature.properties.ICAO || '';
      const isOnline = onlineFirIds.has(id);
      return {
        color: isOnline ? '#22d3ee' : '#2e3138',
        weight: isOnline ? 1 : 0.5,
        opacity: isOnline ? 0.7 : 0.3,
        fillColor: isOnline ? '#22d3ee' : 'transparent',
        fillOpacity: isOnline ? 0.08 : 0,
        interactive: false,
      };
    },
    [onlineFirIds],
  );

  // ── Badge markers for online FIRs ──────────────────────────
  useEffect(() => {
    // Remove previous badges
    if (badgeGroupRef.current) {
      map.removeLayer(badgeGroupRef.current);
      badgeGroupRef.current = null;
    }
    badgeMarkersRef.current.clear();

    if (!visible || !geoJson) return;

    const group = L.layerGroup();

    for (const feature of geoJson.features) {
      const id = feature.properties.id || feature.properties.icao || feature.properties.ICAO || '';
      if (!onlineFirIds.has(id)) continue;

      const labelLat = parseFloat(feature.properties.label_lat);
      const labelLon = parseFloat(feature.properties.label_lon);
      if (isNaN(labelLat) || isNaN(labelLon)) continue;

      const info = firControllerInfo.get(id);

      const icon = L.divIcon({
        className: 'airspace-badge-wrapper',
        html: `<div class="airspace-badge airspace-badge--fir">${id}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 8],
      });

      const marker = L.marker([labelLat, labelLon], { icon, interactive: true, zIndexOffset: 500 });

      marker.on('mouseover', (e: L.LeafletMouseEvent) => {
        onHoverAirspace(id, feature as GeoJSON.Feature, e);
      });
      marker.on('mouseout', () => {
        onHoverAirspace(null, null, null);
      });
      marker.on('click', () => {
        onSelectAirspace(id, feature as GeoJSON.Feature);
      });

      if (info) {
        marker.bindTooltip(`${info.callsign} — ${info.frequency}`, {
          direction: 'top',
          offset: [0, -4],
          className: 'vatsim-boundary-tooltip',
        });
      }

      marker.addTo(group);
      badgeMarkersRef.current.set(id, marker);
    }

    group.addTo(map);
    badgeGroupRef.current = group;

    return () => {
      if (badgeGroupRef.current) {
        map.removeLayer(badgeGroupRef.current);
        badgeGroupRef.current = null;
      }
      badgeMarkersRef.current.clear();
    };
  }, [visible, geoJson, onlineFirIds, firControllerInfo, map, onHoverAirspace, onSelectAirspace]);

  // ── Update badge hover class without recreating markers ────
  useEffect(() => {
    for (const [id, marker] of badgeMarkersRef.current) {
      const el = marker.getElement();
      if (!el) continue;
      const badge = el.querySelector('.airspace-badge') as HTMLElement | null;
      if (badge) {
        badge.classList.toggle('airspace-badge--hover', id === hoveredAirspaceId);
      }
    }
  }, [hoveredAirspaceId]);

  if (!visible || !geoJson) return null;

  return (
    <GeoJSON
      key={`fir-${onlineFirIds.size}`}
      ref={(r) => { geoJsonRef.current = r as L.GeoJSON | null; }}
      data={geoJson}
      style={style}
    />
  );
}

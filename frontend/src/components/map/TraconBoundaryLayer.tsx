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

/** Compute a rough centroid from the first ring of a polygon */
function getCentroid(geometry: any): [number, number] | null {
  let coords: number[][] | undefined;
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates[0]?.[0];
  }
  if (!coords || coords.length === 0) return null;
  let sumLat = 0, sumLon = 0;
  for (const c of coords) {
    sumLon += c[0];
    sumLat += c[1];
  }
  return [sumLat / coords.length, sumLon / coords.length];
}

/**
 * Renders TRACON/APP boundary polygons on the map with interactive badge markers.
 * Only shows boundaries that have an active APP/DEP controller.
 * Amber/orange color scheme to distinguish from cyan FIR boundaries.
 */
export function TraconBoundaryLayer({ controllers, visible, hoveredAirspaceId, onHoverAirspace, onSelectAirspace }: Props) {
  const map = useMap();
  const [geoJson, setGeoJson] = useState<GeoJsonCollection | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const badgeGroupRef = useRef<L.LayerGroup | null>(null);
  const badgeMarkersRef = useRef<Map<string, L.Marker>>(new Map());

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

  // Controller info for badge tooltips
  const traconControllerInfo = useMemo(() => {
    const infoMap = new Map<string, { callsign: string; frequency: string }>();
    for (const ctrl of controllers) {
      if (ctrl.facility === 5 && ctrl.boundaryId) {
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
      const id = feature.properties.id || feature.properties.prefix || feature.properties.ICAO || '';
      const isOnline = onlineTraconIds.has(id);
      const isHovered = hoveredAirspaceId === id;
      if (!isOnline) {
        (layer as L.Path).setStyle({ opacity: 0, fillOpacity: 0, interactive: false });
        return;
      }
      (layer as L.Path).setStyle({
        color: '#f59e0b',
        weight: isHovered ? 1.5 : 0.75,
        opacity: isHovered ? 1 : 0.6,
        fillColor: '#f59e0b',
        fillOpacity: isHovered ? 0.12 : 0.06,
        interactive: false,
      });
    });
  }, [hoveredAirspaceId, onlineTraconIds]);

  const style = useCallback(
    (feature?: GeoJsonFeature): PathOptions => {
      if (!feature) return {};
      const id = feature.properties.id || feature.properties.prefix || feature.properties.ICAO || '';
      const isOnline = onlineTraconIds.has(id);
      if (!isOnline) return { opacity: 0, fillOpacity: 0, interactive: false };
      return {
        color: '#f59e0b',
        weight: 0.75,
        opacity: 0.6,
        fillColor: '#f59e0b',
        fillOpacity: 0.06,
        interactive: false,
      };
    },
    [onlineTraconIds],
  );

  // ── Badge markers for online TRACONs ──────────────────────
  // Deduplicate features by ID (TRACON GeoJSON may have multiple features per ID)
  const onlineFeatureMap = useMemo(() => {
    if (!geoJson) return new Map<string, GeoJsonFeature>();
    const fMap = new Map<string, GeoJsonFeature>();
    for (const feature of geoJson.features) {
      const id = feature.properties.id || feature.properties.prefix || feature.properties.ICAO || '';
      if (onlineTraconIds.has(id) && !fMap.has(id)) {
        fMap.set(id, feature);
      }
    }
    return fMap;
  }, [geoJson, onlineTraconIds]);

  useEffect(() => {
    if (badgeGroupRef.current) {
      map.removeLayer(badgeGroupRef.current);
      badgeGroupRef.current = null;
    }
    badgeMarkersRef.current.clear();

    if (!visible || onlineFeatureMap.size === 0) return;

    const group = L.layerGroup();

    for (const [id, feature] of onlineFeatureMap) {
      // Use label_lat/label_lon if available, otherwise compute centroid
      let lat = parseFloat(feature.properties.label_lat);
      let lon = parseFloat(feature.properties.label_lon);
      if (isNaN(lat) || isNaN(lon)) {
        const centroid = getCentroid(feature.geometry);
        if (!centroid) continue;
        [lat, lon] = centroid;
      }

      const info = traconControllerInfo.get(id);
      const name = feature.properties.name || feature.properties.NAME || id;

      const icon = L.divIcon({
        className: 'airspace-badge-wrapper',
        html: `<div class="airspace-badge airspace-badge--tracon">${id}</div>`,
        iconSize: undefined as any,
        iconAnchor: [0, 8],
      });

      const marker = L.marker([lat, lon], { icon, interactive: true, zIndexOffset: 500 });

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
        marker.bindTooltip(`${name}\n${info.callsign} — ${info.frequency}`, {
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
  }, [visible, onlineFeatureMap, traconControllerInfo, map, onHoverAirspace, onSelectAirspace]);

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
      key={`tracon-${onlineTraconIds.size}`}
      ref={(r) => { geoJsonRef.current = r as L.GeoJSON | null; }}
      data={geoJson}
      style={style}
    />
  );
}

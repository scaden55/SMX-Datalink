import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../lib/api';
import { fetchGroundChart, type GroundChartData } from '../../lib/ground-chart-api';

// ── Types ────────────────────────────────────────────────────

interface SeedAirport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

interface OaAirport {
  ident: string;
  type: string;
  latitude_deg: number;
  longitude_deg: number;
}

interface NormalizedAirport {
  icao: string;
  lat: number;
  lon: number;
}

// ── Constants ────────────────────────────────────────────────

const MIN_ZOOM = 12;
const AIRPORT_RANGE_NM = 10;
const NM_TO_DEG = 1 / 60; // rough: 1 nm ≈ 1/60 degree

// ── Feature styles ───────────────────────────────────────────

function getFeatureStyle(feature: GeoJSON.Feature): L.PathOptions {
  const ft = feature.properties?.featureType as string;
  const geomType = feature.geometry.type;

  switch (ft) {
    case 'runway':
      if (geomType === 'LineString') {
        return { color: '#2a2a2a', weight: 12, opacity: 1, lineCap: 'butt' };
      }
      return { fillColor: '#2a2a2a', fillOpacity: 1, color: '#ffffff', weight: 1.5, opacity: 0.8 };

    case 'taxiway':
      if (geomType === 'LineString') {
        return { color: '#1a1a1a', weight: 5, opacity: 1, lineCap: 'butt' };
      }
      return { fillColor: '#1a1a1a', fillOpacity: 1, color: '#eab308', weight: 1, opacity: 0.7 };

    case 'apron':
      return { fillColor: '#242424', fillOpacity: 1, color: '#333333', weight: 0.5, opacity: 0.5 };

    case 'terminal':
      return { fillColor: '#4f46e5', fillOpacity: 0.4, color: '#6366f1', weight: 1.5, opacity: 0.8 };

    case 'hangar':
      return { fillColor: '#334155', fillOpacity: 0.5, color: '#475569', weight: 1, opacity: 0.6 };

    default:
      return { fillColor: '#1a1a1a', fillOpacity: 0.3, color: '#333333', weight: 0.5, opacity: 0.3 };
  }
}

function createPointMarker(feature: GeoJSON.Feature, latlng: L.LatLng): L.CircleMarker {
  const ft = feature.properties?.featureType as string;

  if (ft === 'gate' || ft === 'parking_position') {
    return L.circleMarker(latlng, {
      radius: 4,
      fillColor: '#0ea5e9',
      fillOpacity: 0.3,
      color: '#0ea5e9',
      weight: 1,
      opacity: 0.8,
    });
  }

  if (ft === 'holding_position') {
    return L.circleMarker(latlng, {
      radius: 3,
      fillColor: '#ec4899',
      fillOpacity: 0.4,
      color: '#ec4899',
      weight: 1,
      opacity: 0.8,
    });
  }

  return L.circleMarker(latlng, {
    radius: 2,
    fillColor: '#666',
    fillOpacity: 0.3,
    color: '#666',
    weight: 1,
  });
}

// ── Label helpers ────────────────────────────────────────────

function addLabels(feature: GeoJSON.Feature, layer: L.Layer): void {
  const ref = feature.properties?.ref as string | undefined;
  if (!ref) return;

  const ft = feature.properties?.featureType as string;

  if (ft === 'runway') {
    (layer as L.Path).bindTooltip(ref, {
      permanent: true,
      direction: 'center',
      className: 'ground-chart-runway-label',
    });
  } else if (ft === 'taxiway') {
    (layer as L.Path).bindTooltip(ref, {
      permanent: true,
      direction: 'center',
      className: 'ground-chart-taxiway-label',
    });
  }
}

// ── Runway edge + centerline overlays ────────────────────────

function createRunwayOverlays(geojson: GeoJSON.FeatureCollection): L.LayerGroup {
  const group = L.layerGroup();

  for (const feature of geojson.features) {
    if (feature.properties?.featureType !== 'runway') continue;

    // Add white edge lines for polygons
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      L.geoJSON(feature as any, {
        style: { color: '#ffffff', weight: 1.5, opacity: 0.6, fill: false },
      }).addTo(group);
    }

    // Add dashed centerline
    L.geoJSON(feature as any, {
      style: {
        color: '#ffffff',
        weight: 1,
        opacity: 0.5,
        dashArray: '6 6',
        fill: false,
      },
    }).addTo(group);
  }

  return group;
}

// ── Taxiway edge overlays ────────────────────────────────────

function createTaxiwayEdgeOverlays(geojson: GeoJSON.FeatureCollection): L.LayerGroup {
  const group = L.layerGroup();

  for (const feature of geojson.features) {
    if (feature.properties?.featureType !== 'taxiway') continue;
    if (feature.geometry.type !== 'LineString') continue;

    // Yellow edge line on top of the dark taxiway line
    L.geoJSON(feature as any, {
      style: { color: '#eab308', weight: 1, opacity: 0.6, fill: false },
    }).addTo(group);
  }

  return group;
}

// ── Component ────────────────────────────────────────────────

export function GroundChartOverlay() {
  const map = useMap();
  const [airports, setAirports] = useState<NormalizedAirport[]>([]);
  const [activeIcao, setActiveIcao] = useState<string | null>(null);
  const [chartData, setChartData] = useState<GroundChartData | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const fetchedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch airports list once — try OurAirports first, fall back to seed airports
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    api.get<OaAirport[]>('/api/airports/map')
      .then((data) => {
        if (data.length > 0) {
          setAirports(data.map((a) => ({ icao: a.ident, lat: a.latitude_deg, lon: a.longitude_deg })));
        } else {
          // OurAirports table empty — fall back to seed airports
          return api.get<SeedAirport[]>('/api/airports').then((seeds) => {
            setAirports(seeds.map((a) => ({ icao: a.icao, lat: a.lat, lon: a.lon })));
          });
        }
      })
      .catch(() => {
        // Last resort — try seed airports
        api.get<SeedAirport[]>('/api/airports')
          .then((seeds) => {
            setAirports(seeds.map((a) => ({ icao: a.icao, lat: a.lat, lon: a.lon })));
          })
          .catch(() => {});
      });
  }, []);

  // Find nearest airport to map center when zoomed in
  const updateActiveAirport = useCallback(() => {
    const zoom = map.getZoom();

    if (zoom < MIN_ZOOM) {
      setActiveIcao(null);
      return;
    }

    const center = map.getCenter();
    const maxDeg = AIRPORT_RANGE_NM * NM_TO_DEG;

    let nearest: NormalizedAirport | null = null;
    let nearestDist = Infinity;

    for (const apt of airports) {
      const dLat = apt.lat - center.lat;
      const dLon = apt.lon - center.lng;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < nearestDist && Math.abs(dLat) < maxDeg && Math.abs(dLon) < maxDeg) {
        nearest = apt;
        nearestDist = dist;
      }
    }

    setActiveIcao(nearest ? nearest.icao : null);
  }, [map, airports]);

  // Listen for zoom/pan events
  useMapEvents({
    zoomend: updateActiveAirport,
    moveend: updateActiveAirport,
  });

  // Trigger initial check when airports load
  useEffect(() => {
    if (airports.length > 0) updateActiveAirport();
  }, [airports, updateActiveAirport]);

  // Fetch ground chart data when active ICAO changes
  useEffect(() => {
    if (!activeIcao) {
      setChartData(null);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchGroundChart(activeIcao, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setChartData(data);
        }
      });

    return () => controller.abort();
  }, [activeIcao]);

  // Render/remove Leaflet layers when chart data changes
  useEffect(() => {
    // Remove existing layers
    if (layersRef.current) {
      map.removeLayer(layersRef.current);
      layersRef.current = null;
    }

    if (!chartData || chartData.geojson.features.length === 0) return;

    const group = L.layerGroup();

    // Main GeoJSON layer (fills + base lines)
    const mainLayer = L.geoJSON(chartData.geojson, {
      style: (feature) => feature ? getFeatureStyle(feature) : {},
      pointToLayer: (feature, latlng) => createPointMarker(feature, latlng),
      onEachFeature: (feature, layer) => addLabels(feature, layer),
    });
    mainLayer.addTo(group);

    // Runway overlays (edges + centerlines on top)
    createRunwayOverlays(chartData.geojson).addTo(group);

    // Taxiway edge overlays
    createTaxiwayEdgeOverlays(chartData.geojson).addTo(group);

    group.addTo(map);
    layersRef.current = group;

    return () => {
      if (layersRef.current) {
        map.removeLayer(layersRef.current);
        layersRef.current = null;
      }
    };
  }, [chartData, map]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (layersRef.current) {
        map.removeLayer(layersRef.current);
        layersRef.current = null;
      }
    };
  }, [map]);

  return null;
}

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGroundChart } from '../../hooks/useGroundChart';
import { cn } from '../../lib/utils';

interface AirportGroundChartProps {
  icao: string;
  aircraftPosition?: { latitude: number; longitude: number; heading: number } | null;
  className?: string;
}

// SVG aircraft icon as data URL (blue #3b82f6)
const AIRCRAFT_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="M16 2 L19 12 L28 14 L19 16 L19 26 L16 24 L13 26 L13 16 L4 14 L13 12 Z"
        fill="#3b82f6" stroke="#1e3a5f" stroke-width="1"/>
</svg>
`)}`;

const AIRCRAFT_IMAGE_ID = 'aircraft-icon';
const AIRCRAFT_SOURCE_ID = 'aircraft-position';
const DATA_SOURCE_ID = 'ground-chart-data';

export function AirportGroundChart({ icao, aircraftPosition, className }: AirportGroundChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { data, loading, error } = useGroundChart(icao);
  const [mapReady, setMapReady] = useState(false);

  // Initialize MapLibre map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        name: 'Ground Chart',
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#000000' },
          },
        ],
      },
      center: [0, 0],
      zoom: 14,
      attributionControl: false,
    });

    let destroyed = false;

    map.on('load', () => {
      const img = new Image(32, 32);
      img.onload = () => {
        if (destroyed) return;
        if (!map.hasImage(AIRCRAFT_IMAGE_ID)) {
          map.addImage(AIRCRAFT_IMAGE_ID, img);
        }
        mapRef.current = map;
        setMapReady(true);
      };
      img.src = AIRCRAFT_SVG;
    });

    return () => {
      destroyed = true;
      mapRef.current = null;
      setMapReady(false);
      map.remove();
    };
  }, []);

  // Add/update GeoJSON data and layers when data arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !data) return;

    const geojson = data.geojson;

    // Update or add the data source
    const existingSource = map.getSource(DATA_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
    } else {
      map.addSource(DATA_SOURCE_ID, {
        type: 'geojson',
        data: geojson,
      });

      addLayers(map);
    }

    // Fit bounds to data
    if (geojson.features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const feature of geojson.features) {
        const geom = feature.geometry;
        if (geom.type === 'Point') {
          bounds.extend(geom.coordinates as [number, number]);
        } else if (geom.type === 'LineString') {
          for (const coord of geom.coordinates) {
            bounds.extend(coord as [number, number]);
          }
        } else if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
          const coords =
            geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
          for (const ring of coords) {
            for (const coord of ring) {
              bounds.extend(coord as [number, number]);
            }
          }
        }
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 40, maxZoom: 17 });
      }
    } else if (data.center[0] !== 0 || data.center[1] !== 0) {
      // No features but have center — zoom to airport location
      map.flyTo({ center: data.center, zoom: 15 });
    }
  }, [data, mapReady]);

  // Update aircraft position overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const posData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: aircraftPosition
        ? [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [aircraftPosition.longitude, aircraftPosition.latitude],
              },
              properties: { heading: aircraftPosition.heading },
            },
          ]
        : [],
    };

    const existingSource = map.getSource(AIRCRAFT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(posData);
    } else {
      map.addSource(AIRCRAFT_SOURCE_ID, {
        type: 'geojson',
        data: posData,
      });

      map.addLayer({
        id: 'aircraft-symbol',
        type: 'symbol',
        source: AIRCRAFT_SOURCE_ID,
        layout: {
          'icon-image': AIRCRAFT_IMAGE_ID,
          'icon-size': 1,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
        },
      });
    }
  }, [aircraftPosition, mapReady]);

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-xs text-acars-muted tabular-nums">Loading ground chart...</div>
        </div>
      )}

      {/* Error overlay */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-xs text-red-400 tabular-nums">Failed to load chart</div>
        </div>
      )}

      {/* Empty state */}
      {data && data.geojson.features.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center">
            <div className="text-xs text-acars-muted tabular-nums">No ground chart data</div>
            <div className="text-[10px] text-acars-muted/60 mt-1">OSM data unavailable for {icao}</div>
          </div>
        </div>
      )}

      {/* ICAO badge */}
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-[10px] tabular-nums font-bold text-acars-text">
        {icao}
      </div>
    </div>
  );
}

/** Add all styled layers to the map (called once when source is first added) */
function addLayers(map: maplibregl.Map) {
  // ── Fills (bottom) ──────────────────────────────────

  // Apron fill
  map.addLayer({
    id: 'apron-fill',
    type: 'fill',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'apron'],
      ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    ],
    paint: {
      'fill-color': '#242424',
    },
  });

  // Taxiway fill (polygons)
  map.addLayer({
    id: 'taxiway-fill',
    type: 'fill',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'taxiway'],
      ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    ],
    paint: {
      'fill-color': '#1a1a1a',
    },
  });

  // Taxiway line (LineStrings)
  map.addLayer({
    id: 'taxiway-line',
    type: 'line',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'taxiway'],
      ['==', ['geometry-type'], 'LineString'],
    ],
    paint: {
      'line-color': '#1a1a1a',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        12, 2,
        16, 10,
        18, 20,
      ],
    },
  });

  // Taxiway edge
  map.addLayer({
    id: 'taxiway-edge',
    type: 'line',
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'featureType'], 'taxiway'],
    paint: {
      'line-color': '#eab308',
      'line-width': 1,
    },
  });

  // Runway fill (polygons)
  map.addLayer({
    id: 'runway-fill',
    type: 'fill',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'runway'],
      ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    ],
    paint: {
      'fill-color': '#2a2a2a',
    },
  });

  // Runway line (LineStrings)
  map.addLayer({
    id: 'runway-line',
    type: 'line',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'runway'],
      ['==', ['geometry-type'], 'LineString'],
    ],
    paint: {
      'line-color': '#2a2a2a',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        12, 4,
        16, 20,
        18, 40,
      ],
    },
  });

  // Runway centerline
  map.addLayer({
    id: 'runway-centerline',
    type: 'line',
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'featureType'], 'runway'],
    paint: {
      'line-color': '#ffffff',
      'line-width': 1,
      'line-dasharray': [4, 4],
    },
  });

  // Runway edge
  map.addLayer({
    id: 'runway-edge',
    type: 'line',
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'featureType'], 'runway'],
    paint: {
      'line-color': '#ffffff',
      'line-width': 1.5,
    },
  });

  // ── Buildings ───────────────────────────────────────

  // Terminal fill
  map.addLayer({
    id: 'terminal-fill',
    type: 'fill',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'terminal'],
      ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    ],
    paint: {
      'fill-color': '#4f46e5',
      'fill-opacity': 0.4,
    },
  });

  // Terminal outline
  map.addLayer({
    id: 'terminal-outline',
    type: 'line',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'terminal'],
      ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    ],
    paint: {
      'line-color': '#6366f1',
      'line-width': 1.5,
    },
  });

  // Hangar fill
  map.addLayer({
    id: 'hangar-fill',
    type: 'fill',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'hangar'],
      ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    ],
    paint: {
      'fill-color': '#334155',
      'fill-opacity': 0.5,
    },
  });

  // ── Points ──────────────────────────────────────────

  // Gate circles
  map.addLayer({
    id: 'gate-circle',
    type: 'circle',
    source: DATA_SOURCE_ID,
    filter: ['any',
      ['==', ['get', 'featureType'], 'gate'],
      ['==', ['get', 'featureType'], 'parking_position'],
    ],
    paint: {
      'circle-radius': 4,
      'circle-color': 'rgba(14, 165, 233, 0.3)',
      'circle-stroke-color': '#0ea5e9',
      'circle-stroke-width': 1,
    },
  });

  // Holding positions
  map.addLayer({
    id: 'holding-position',
    type: 'circle',
    source: DATA_SOURCE_ID,
    filter: ['==', ['get', 'featureType'], 'holding_position'],
    paint: {
      'circle-radius': 3,
      'circle-color': 'rgba(236, 72, 153, 0.4)',
      'circle-stroke-color': '#ec4899',
      'circle-stroke-width': 1,
    },
  });

  // ── Labels (top) ────────────────────────────────────

  // Taxiway labels
  map.addLayer({
    id: 'taxiway-labels',
    type: 'symbol',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'taxiway'],
      ['has', 'ref'],
    ],
    layout: {
      'text-field': ['get', 'ref'],
      'text-size': 11,
      'text-font': ['Open Sans Regular'],
      'symbol-placement': 'line',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#eab308',
      'text-halo-color': '#1a1a00',
      'text-halo-width': 1.5,
    },
  });

  // Runway labels
  map.addLayer({
    id: 'runway-labels',
    type: 'symbol',
    source: DATA_SOURCE_ID,
    filter: ['all',
      ['==', ['get', 'featureType'], 'runway'],
      ['has', 'ref'],
    ],
    layout: {
      'text-field': ['get', 'ref'],
      'text-size': 14,
      'text-font': ['Open Sans Bold'],
      'symbol-placement': 'line',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 2,
    },
  });
}

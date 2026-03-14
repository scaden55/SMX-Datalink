import { memo, useState, useCallback } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldMapProps {
  hubs?: { lat: number; lon: number }[];
  flights?: { latitude: number; longitude: number; callsign: string }[];
}

const CENTER: [number, number] = [0, 0];

export const WorldMap = memo(function WorldMap({ hubs = [], flights = [] }: WorldMapProps) {
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: CENTER,
    zoom: 1,
  });

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    if (pos.zoom <= 1) {
      setPosition({ coordinates: CENTER, zoom: 1 });
    } else {
      setPosition(pos);
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 160 }}
        width={960}
        height={500}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={8}
          translateExtent={[[-100, -50], [1060, 550]]}
        >
          <Graticule stroke="rgba(255, 255, 255, 0.06)" strokeWidth={0.4} />

          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#111418"
                  stroke="#252a33"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#181c22', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {hubs.map((hub, i) => (
            <Marker key={`hub-${i}`} coordinates={[hub.lon, hub.lat]}>
              <circle r={1.5} fill="var(--accent-blue)" opacity={0.9} />
              <circle r={3} fill="var(--accent-blue)" opacity={0.15} />
            </Marker>
          ))}

          {flights.map((f, i) => (
            <Marker key={`flight-${i}`} coordinates={[f.longitude, f.latitude]}>
              <circle r={2.5} fill="var(--accent-emerald)" opacity={0.9} />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
});

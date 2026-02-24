declare module 'osmtogeojson' {
  function osmtogeojson(data: unknown): GeoJSON.FeatureCollection;
  export = osmtogeojson;
}

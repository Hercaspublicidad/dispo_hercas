// Puntos de referencia municipales para registros sin coordenadas de la valla.
// Nunca se presentan como ubicación exacta de una estructura publicitaria.
const CITY_CENTERS = {
  'Bogotá': [4.711, -74.072],
  'Medellín': [6.245, -75.571],
  'Medellín y Antioquia': [6.245, -75.571],
  'Cali': [3.431, -76.520],
  'Barranquilla': [10.969, -74.781],
  'Cartagena': [10.391, -75.479],
  'Envigado': [6.175, -75.591],
  'Rionegro': [6.155, -75.373],
  'Sabaneta': [6.151, -75.616],
  'Bello': [6.336, -75.559],
  'El Retiro': [6.057, -75.502],
  'Yumbo': [3.582, -76.492],
  'Marinilla': [6.174, -75.339],
  'La Estrella': [6.158, -75.644],
  'Buenaventura': [3.883, -77.026],
  'Itagüí': [6.184, -75.599],
  'Caldas': [6.090, -75.637],
  'Buga': [3.900, -76.298],
  'San Jerónimo': [6.442, -75.728],
};

export function mapLocations(records) {
  const exact = [], approximateByCity = new Map(), withoutLocation = [];
  for (const record of records) {
    if (Number.isFinite(record.lat) && Number.isFinite(record.lon)) {
      exact.push(record);
    } else {
      const center = CITY_CENTERS[record.ciudad];
      if (!center) {
        withoutLocation.push(record);
      } else {
        if (!approximateByCity.has(record.ciudad)) {
          approximateByCity.set(record.ciudad, { city: record.ciudad, lat: center[0], lon: center[1], records: [] });
        }
        approximateByCity.get(record.ciudad).records.push(record);
      }
    }
  }
  return { exact, approximate: [...approximateByCity.values()], withoutLocation };
}

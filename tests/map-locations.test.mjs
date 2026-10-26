import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLocations } from '../lib/map-locations.mjs';

test('el mapa incluye ciudades sin coordenadas como grupos aproximados', () => {
  const records = [
    { codigo: 'CLO-001', ciudad: 'Cali', lat: null, lon: null },
    { codigo: 'CLO-002', ciudad: 'Cali', lat: null, lon: null },
    { codigo: 'BAQ-001', ciudad: 'Barranquilla', lat: null, lon: null },
    { codigo: 'BOG-001', ciudad: 'Bogotá', lat: 4.7, lon: -74.1 },
  ];
  const { exact, approximate, withoutLocation } = mapLocations(records);
  assert.deepEqual(exact.map(r => r.codigo), ['BOG-001']);
  assert.equal(approximate.find(g => g.city === 'Cali').records.length, 2);
  assert.equal(approximate.find(g => g.city === 'Barranquilla').records.length, 1);
  assert.equal(withoutLocation.length, 0);
  assert.ok(approximate.find(g => g.city === 'Cali').lat > 3);
});

test('una ciudad desconocida no recibe coordenadas inventadas', () => {
  const record = { codigo: 'X-001', ciudad: 'Municipio por confirmar', lat: null, lon: null };
  const result = mapLocations([record]);
  assert.equal(result.approximate.length, 0);
  assert.deepEqual(result.withoutLocation, [record]);
});

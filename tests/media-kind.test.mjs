import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaKind, markerKind } from '../lib/media-kind.mjs';
import { mapLocations } from '../lib/map-locations.mjs';

test('los filtros combinan tecnología y entorno', () => {
  assert.deepEqual(mediaKind({ categoria: 'Valla exterior', formato: 'Valla 12 x 4' }), { entorno: 'exterior', soporte: 'estatica' });
  assert.deepEqual(mediaKind({ categoria: 'Pantalla en centro comercial', formato: 'LED' }), { entorno: 'centro_comercial', soporte: 'led' });
  assert.equal(markerKind({ entorno: 'aeropuerto', formato: 'Pantalla LED' }), 'airport');
  assert.equal(markerKind({ formato: 'Pantalla LED' }), 'led');
  assert.equal(markerKind({ categoria: 'Valla exterior', ubicacion: 'Frente a centro comercial' }), 'static');
});

test('el mapa separa símbolos por tipo en una misma ciudad', () => {
  const { approximate } = mapLocations([
    { codigo: 'A', ciudad: 'Bogotá', formato: 'Valla', lat: null, lon: null },
    { codigo: 'B', ciudad: 'Bogotá', formato: 'LED', lat: null, lon: null },
    { codigo: 'C', ciudad: 'Bogotá', entorno: 'aeropuerto', formato: 'LED', lat: null, lon: null },
  ]);
  assert.deepEqual(approximate.map(group => group.kind), ['static', 'led', 'airport']);
});

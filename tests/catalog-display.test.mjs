import test from 'node:test';
import assert from 'node:assert/strict';
import { displayRecords } from '../lib/catalog-display.mjs';

test('muestra todas las fichas con montaje y PowerPoint, sin límite de 120', () => {
  const ready = Array.from({ length: 468 }, (_, i) => ({ codigo: `V-${i}`, foto: true, ficha: true, estadoFicha: 'completo' }));
  const pending = { codigo: 'P-1', foto: false, ficha: false, estadoFicha: 'revision_fuente' };
  const duplicate = { codigo: 'D-1', foto: true, ficha: true, estadoFicha: 'duplicado_confirmado' };
  assert.equal(displayRecords([...ready, pending, duplicate], 'ready').length, 468);
  assert.deepEqual(displayRecords([...ready, pending, duplicate], 'review').map(r => r.codigo), ['P-1']);
  assert.equal(displayRecords([...ready, pending, duplicate], 'all').length, 469);
});

test('incluye un montaje preliminar con ficha en la vista de archivos listos', () => {
  const record = { codigo: 'ICO-BOG-054', foto: true, ficha: true, estadoFicha: 'revision_fuente' };
  assert.equal(displayRecords([record], 'ready').length, 1);
});

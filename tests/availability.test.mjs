import test from 'node:test';
import assert from 'node:assert/strict';
import { availabilityState, canOffer, canSelectForProposal } from '../lib/availability.mjs';

test('solo una confirmación disponible de ocho días o menos es vigente', () => {
  const today = new Date('2026-10-23T12:00:00Z');
  assert.equal(availabilityState({ disponibilidad: 'Disponible', fechaDisponibilidad: '2026-10-15' }, today), 'Disponible');
  assert.equal(availabilityState({ disponibilidad: 'Disponible', fechaDisponibilidad: '2026-10-14' }, today), 'Por confirmar');
  assert.equal(availabilityState({ disponibilidad: 'No disponible', fechaDisponibilidad: '2026-10-23' }, today), 'No disponible');
});

test('una ficha sin foto o con disponibilidad vencida no se ofrece', () => {
  const today = new Date('2026-10-23T12:00:00Z');
  const record = { estadoFicha: 'completo', ficha: true, foto: true, disponibilidad: 'Disponible', fechaDisponibilidad: '2026-10-23' };
  assert.equal(canOffer(record, today), true);
  assert.equal(canOffer({ ...record, foto: false }, today), false);
  assert.equal(canOffer({ ...record, fechaDisponibilidad: '2026-10-14' }, today), false);
});

test('canOffer funciona como callback de Array.filter', () => {
  const today = new Date().toISOString().slice(0, 10);
  const records = [
    { estadoFicha: 'completo', ficha: true, foto: true, disponibilidad: 'Disponible', fechaDisponibilidad: today },
    { estadoFicha: 'completo', ficha: false, foto: true, disponibilidad: 'Disponible', fechaDisponibilidad: today },
  ];
  assert.equal(records.filter(canOffer).length, 1);
});

test('la selección depende de los archivos, no de la vigencia semanal', () => {
  const record = { estadoFicha: 'completo', ficha: true, foto: true, disponibilidad: 'Disponible', fechaDisponibilidad: '2026-01-01' };
  assert.equal(canSelectForProposal(record), true);
  assert.equal(canSelectForProposal({ ...record, estadoFicha: 'revision_fuente' }), true);
  assert.equal(canSelectForProposal({ ...record, disponibilidad: 'No disponible' }), true);
  assert.equal(canSelectForProposal({ ...record, foto: false }), false);
  assert.equal(canSelectForProposal({ ...record, ficha: false }), false);
  assert.equal(canSelectForProposal({ ...record, estadoFicha: 'duplicado_confirmado' }), false);
  assert.equal([record, { ...record, ficha: false }].filter(canSelectForProposal).length, 1);
});

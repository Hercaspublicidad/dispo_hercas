import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldReplaceAvailabilityList } from '../lib/import-coverage.mjs';

test('una presentación con lectura parcial no retira vallas del inventario vigente', () => {
  assert.equal(shouldReplaceAvailabilityList(true, 17, 69), false);
  assert.equal(shouldReplaceAvailabilityList(true, 8, 10), true);
  assert.equal(shouldReplaceAvailabilityList(false, 10, 10), false);
});

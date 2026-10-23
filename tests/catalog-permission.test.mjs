import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCatalogPermission } from '../lib/catalog-permission.mjs';

function client(roles, grants) {
  return {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        is() { return Promise.resolve({ data: roles, error: null }); },
        in(column) { return Promise.resolve({ data: column === 'role' ? grants : [], error: null }); },
      };
      return query;
    },
  };
}

test('only an active role with availability permission can open the catalog', async () => {
  assert.equal(await hasCatalogPermission(client([{ role: 'ventas' }], [{ permission: 'cotizador.availability.read' }]), 'user'), true);
  assert.equal(await hasCatalogPermission(client([{ role: 'ventas' }], []), 'user'), false);
  assert.equal(await hasCatalogPermission(client([], []), 'user'), false);
});

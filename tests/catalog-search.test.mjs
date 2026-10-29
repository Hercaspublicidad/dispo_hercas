import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesCatalogSearch} from '../lib/catalog-search.mjs';

test('busca el código del aliado tanto en catálogo como en administración', () => {
  const base = {codigo:'HER-CAL-001', proveedor:'Aliado', ciudad:'Bogotá'};
  for (const record of [{...base,codigoProveedor:'EXT-924'}, {...base,datos_fuente:{codigo_proveedor:'EXT-924'}}]) {
    assert.equal(matchesCatalogSearch(record,'ext-924'),true);
    assert.equal(matchesCatalogSearch(record,'  BOGOTA '),true);
    assert.equal(matchesCatalogSearch(record,'HER-CAL'),true);
    assert.equal(matchesCatalogSearch(record,'otro código'),false);
  }
});

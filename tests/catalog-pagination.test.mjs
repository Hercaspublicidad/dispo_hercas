import test from 'node:test';
import assert from 'node:assert/strict';
import {paginateCatalog} from '../lib/catalog-pagination.mjs';

const records=Array.from({length:587},(_,index)=>({codigo:`TEST-${index+1}`}));

test('587 fichas se muestran en 12 páginas de 50 y la última contiene 37',()=>{
  const first=paginateCatalog(records);
  assert.equal(first.pageSize,50);assert.equal(first.pageCount,12);assert.equal(first.items.length,50);assert.equal(first.first,1);assert.equal(first.last,50);
  const last=paginateCatalog(records,12);
  assert.equal(last.items.length,37);assert.equal(last.first,551);assert.equal(last.last,587);
  const all=Array.from({length:12},(_,index)=>paginateCatalog(records,index+1).items).flat();
  assert.deepEqual(all,records);assert.equal(new Set(all.map(row=>row.codigo)).size,587);
});

test('30 por página es opcional y los resultados vacíos o reducidos no dejan páginas inválidas',()=>{
  assert.equal(paginateCatalog(records,1,30).pageCount,20);
  assert.equal(paginateCatalog(records,20,30).items.length,17);
  const filtered=paginateCatalog(records.slice(0,8),12,50);
  assert.equal(filtered.page,1);assert.equal(filtered.items.length,8);
  const empty=paginateCatalog([],12);
  assert.deepEqual(empty.items,[]);assert.equal(empty.page,1);assert.equal(empty.first,0);assert.equal(empty.last,0);
  assert.equal(paginateCatalog(records,999).page,12);assert.equal(paginateCatalog(records,-1).page,1);
});

test('paginar conserva las referencias para mantener selecciones entre páginas',()=>{
  const basket=new Set([records[0].codigo,records[50].codigo]);
  assert.equal(paginateCatalog(records,1).items.filter(row=>basket.has(row.codigo)).length,1);
  assert.equal(paginateCatalog(records,2).items.filter(row=>basket.has(row.codigo)).length,1);
  assert.equal(basket.size,2);assert.equal(paginateCatalog(records,2).items[0],records[50]);
});

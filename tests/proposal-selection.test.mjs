import test from 'node:test';
import assert from 'node:assert/strict';
import {addPageToSelection,removePageFromSelection,PROPOSAL_SELECTION_LIMIT} from '../lib/proposal-selection.mjs';
import {paginateCatalog} from '../lib/catalog-pagination.mjs';

const records=Array.from({length:587},(_,i)=>({codigo:`TEST-CAL-${String(i+1).padStart(3,'0')}`,foto:true,ficha:true,estadoFicha:'completo'}));

test('seleccionar página agrega solo las 20 visibles y conserva las anteriores al navegar',()=>{
  const first=paginateCatalog(records).items,second=paginateCatalog(records,2).items;
  const selected=addPageToSelection([],first);
  assert.equal(selected.length,20);
  const both=addPageToSelection(selected,second);
  assert.equal(both.length,40);assert.ok(selected.every(code=>both.includes(code)));
  assert.deepEqual(addPageToSelection(both,first),both,'repetir la página no duplica códigos');
  assert.deepEqual(removePageFromSelection(both,second),selected,'quitar la página no borra las anteriores');
  const filtered=records.filter((_,i)=>i>=100&&i<120);
  assert.equal(addPageToSelection(both,paginateCatalog(filtered).items).length,60,'cambiar filtros conserva lo acumulado');
});

test('respeta páginas de 30 y 50 y excluye registros sin ficha/foto o duplicados',()=>{
  for(const size of [30,50])assert.equal(addPageToSelection([],paginateCatalog(records,1,size).items).length,size);
  const mixed=[records[0],{...records[1],foto:false},{...records[2],ficha:false},{...records[3],estadoFicha:'duplicado_confirmado'}];
  assert.deepEqual(addPageToSelection([],mixed),[records[0].codigo]);
});

test('nunca supera 550, rechaza una página completa sin alterar lo seleccionado y permite liberar espacio',()=>{
  const selected=records.slice(0,540).map(row=>row.codigo);
  assert.throws(()=>addPageToSelection(selected,records.slice(540,560)),/Puedes añadir 10 más/);
  assert.equal(selected.length,540,'no modifica la selección si la página no cabe');
  const full=addPageToSelection(selected,records.slice(540,550));
  assert.equal(full.length,PROPOSAL_SELECTION_LIMIT);
  assert.throws(()=>addPageToSelection(full,[records[550]]),/hasta 550/);
  assert.deepEqual(addPageToSelection(full,records.slice(0,20)),full,'una página ya seleccionada no excede el límite');
  const reduced=removePageFromSelection(full,[records[0]]);
  assert.equal(addPageToSelection(reduced,[records[550]]).length,550);
});

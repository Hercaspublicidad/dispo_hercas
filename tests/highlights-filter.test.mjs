import test from 'node:test';
import assert from 'node:assert/strict';
import {highlightKey,highlightOptions,matchesHighlights} from '../lib/highlights-filter.mjs';
import {paginateCatalog} from '../lib/catalog-pagination.mjs';

const university='Cerca de universidades',restaurants='Zona gastronómica';
const records=[
  {codigo:'A',ciudad:'Bogotá',destacados:[university,restaurants]},
  {codigo:'B',ciudad:'Bogotá',destacados:[university]},
  {codigo:'C',ciudad:'Cali',destacados:[' ZONA GASTRONOMICA ',restaurants]},
  {codigo:'D',ciudad:'Cali'},
];

test('las opciones provienen de etiquetas guardadas y cuentan cada valla una vez sin duplicar tildes o mayúsculas',()=>{
  const options=highlightOptions(records);
  assert.equal(options.length,2);
  assert.equal(options.find(item=>item.key===highlightKey(university)).count,2);
  assert.equal(options.find(item=>item.key===highlightKey(restaurants)).count,2);
  assert.equal(highlightKey('  ZONA   GASTRONÓMICA '),'zona gastronomica');
  assert.deepEqual(highlightOptions([{destacados:[]},{}]),[]);
});

test('seleccionar varios destacados permite exigir todos o aceptar cualquiera; limpiar elimina el filtro',()=>{
  const selected=[highlightKey(university),highlightKey(restaurants)];
  assert.deepEqual(records.filter(record=>matchesHighlights(record,selected)).map(row=>row.codigo),['A']);
  assert.deepEqual(records.filter(record=>matchesHighlights(record,selected,'any')).map(row=>row.codigo),['A','B','C']);
  assert.deepEqual(records.filter(record=>matchesHighlights(record,[])),records);
  assert.equal(matchesHighlights(records[3],selected,'any'),false);
  assert.equal(matchesHighlights(records[0],['Cerca']),false,'las etiquetas se comparan completas');
  assert.equal(matchesHighlights(records[0],['Etiqueta inexistente']),false);
});

test('el filtro se combina con ciudad y se aplica a todos los resultados antes de paginar',()=>{
  const many=Array.from({length:61},(_,i)=>({...records[i%4],codigo:`TEST-${i}`}));
  const filtered=many.filter(row=>row.ciudad==='Bogotá'&&matchesHighlights(row,[restaurants]));
  const page=paginateCatalog(filtered);
  assert.equal(filtered.length,16);assert.equal(page.total,16);
  assert.ok(page.items.every(row=>row.ciudad==='Bogotá'&&row.destacados.includes(restaurants)));
  const selected=new Set(['TEST-0','TEST-60']);
  assert.equal(page.items.filter(row=>selected.has(row.codigo)).length,2,'conserva los códigos para la selección');
});

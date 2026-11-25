import test from 'node:test';
import assert from 'node:assert/strict';
import {propertyBadge} from '../lib/availability.mjs';
import {highlightItems,validateHighlights,mergeHighlightDraft} from '../lib/valla-highlights.mjs';
import {validateValla} from '../lib/valla-admin.mjs';
import {mapRemoteCatalog} from '../lib/catalog-supabase.mjs';
import {transferInput,encodeTransferCsv,decodeTransferCsv,validateTransferInput,reviewTransferRows} from '../lib/valla-transfer.mjs';
import {buildTransferArchive,readTransferArchive} from '../lib/valla-transfer-zip.mjs';

const base={codigo:'TEST-CAL-001',proveedor:'Aliado',ciudad:'Cali',ubicacion:'Calle 1',estado:'completo'};
const highlights=['Cerca de universidades','Cerca de centros comerciales','Zona de restaurantes'];

test('el editor de etiquetas conserva el texto pendiente al guardar y evita duplicados',()=>{
  assert.deepEqual(mergeHighlightDraft(highlights.slice(0,2),' Zona de restaurantes '),highlights);
  assert.deepEqual(mergeHighlightDraft(highlights,'CERCA DE UNIVERSIDADES'),highlights);
  assert.deepEqual(mergeHighlightDraft(highlights,''),highlights);
  assert.deepEqual(mergeHighlightDraft([],highlights.join('\n')),highlights);
  assert.throws(()=>mergeHighlightDraft(Array.from({length:10},(_,i)=>`Lugar ${i}`),'Otro lugar'),/hasta 10/);
  assert.throws(()=>mergeHighlightDraft([],'x'.repeat(101)),/100 caracteres/);
});

test('los tres estados públicos respetan vigencia, confirmación y revisión de la fuente',()=>{
  const now=new Date('2026-11-23T12:00:00Z');
  const record={estadoFicha:'completo',fechaDisponibilidad:'2026-11-23'};
  for(const disponibilidad of ['Disponible','Libre','Vacante'])assert.equal(propertyBadge({...record,disponibilidad},now),'DISPONIBLE');
  for(const disponibilidad of ['No disponible','Ocupada','Reservada','Vendida'])assert.equal(propertyBadge({...record,disponibilidad},now),'OCUPADA');
  assert.equal(propertyBadge({...record,disponibilidad:'Disponible',fechaDisponibilidad:'2026-11-15'},now),'DISPONIBLE');
  for(const disponibilidad of ['Disponible','Ocupada'])for(const fechaDisponibilidad of ['2026-11-14','2026-11-24','',null,'fecha inválida'])assert.equal(propertyBadge({...record,disponibilidad,fechaDisponibilidad},now),'POR CONFIRMAR');
  for(const estadoFicha of ['revision_fuente','duplicado_confirmado'])assert.equal(propertyBadge({...record,estadoFicha,disponibilidad:'Disponible'},now),'POR CONFIRMAR');
  assert.equal(propertyBadge({...record,disponibilidad:'Por confirmar'},now),'POR CONFIRMAR');
});

test('destacados se normalizan, guardan y muestran sin inventar cercanías ni borrar datos anteriores',()=>{
  const text='  Cerca de universidades \r\n\nCerca de centros comerciales\nCERCA DE UNIVERSIDADES\nZona de restaurantes  ';
  assert.deepEqual(validateHighlights(text),highlights);
  const saved=validateValla({...base,destacados:text});
  assert.deepEqual(saved.datos_fuente.destacados,highlights);
  const edited=validateValla({...base,ubicacion:'Calle 2'},saved);
  assert.deepEqual(edited.datos_fuente.destacados,highlights);
  const record=mapRemoteCatalog([edited],[],[],[]).records[0];
  assert.deepEqual(record.destacados,highlights);
  assert.deepEqual(validateValla({...base,destacados:''},saved).datos_fuente.destacados,[]);
  assert.deepEqual(mapRemoteCatalog([base],[],[],[]).records[0].destacados,[]);
  assert.deepEqual(highlightItems(null),[]);
});

test('los destacados rechazan tipos inválidos y límites excesivos',()=>{
  for(const value of [4,true,{},['Correcto',3],'x'.repeat(101),Array.from({length:11},(_,i)=>`Destacado ${i}`)])assert.throws(()=>validateValla({...base,destacados:value}));
  assert.deepEqual(validateHighlights([' Texto libre; con "comillas" ', 'Texto libre; con "comillas"']),['Texto libre; con "comillas"']);
});

test('CSV y ZIP conservan destacados, mantienen revisión de cambios y admiten importaciones antiguas',async()=>{
  const saved=validateValla({...base,destacados:highlights});
  const csv=encodeTransferCsv([transferInput(saved)]);
  const decoded=decodeTransferCsv(csv)[0];
  assert.equal(decoded.destacados,highlights.join('\n'));
  assert.deepEqual(validateTransferInput(decoded).datos_fuente.destacados,highlights);
  assert.deepEqual(validateTransferInput({codigo:base.codigo,ciudad:'Bogotá'},saved).datos_fuente.destacados,highlights);
  assert.deepEqual(validateTransferInput({codigo:base.codigo,destacados:''},saved).datos_fuente.destacados,[]);
  const review=reviewTransferRows([{...decoded,destacados:'Cerca de restaurantes'}],[saved])[0];
  assert.equal(review.selected,false);
  assert.ok(review.changes.some(change=>change.campo==='destacados'));
  const zip=await buildTransferArchive({records:[saved],files:[]},async()=>{throw new Error('Sin imágenes');});
  const imported=await readTransferArchive(zip);
  assert.deepEqual(validateTransferInput(imported.rows[0]).datos_fuente.destacados,highlights);
});

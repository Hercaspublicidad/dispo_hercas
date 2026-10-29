import test from 'node:test';
import assert from 'node:assert/strict';
import {planLegacyFiches,removeLegacyFiches} from '../lib/legacy-fiches.mjs';

const photo = {codigo:'TEST-001',tipo:'foto',bucket:'aliados-vallas',ruta:'TEST-001/foto/x.webp'};
const fiche = {codigo:'TEST-001',tipo:'ficha',bucket:'aliados-vallas',ruta:'TEST-001/ficha/x.pptx',tamano_bytes:100};
const fake = ({files=[photo,fiche],error=null,returned=[{name:fiche.ruta}]}={}) => {
  const calls = [];
  return {calls,from(){return {select(){return this;},order(){return this;},range:async()=>({data:files,error:null}),delete(){calls.push('delete-db');return this;},eq(){return this;},in:async()=>({error:null})};},storage:{from:()=>({remove:async paths=>{calls.push(paths);return {data:returned,error};}})}};
};

test('limpieza selecciona solo PowerPoint individuales con foto, preserva propuestas, fotos y vistas',()=>{
  const plan = planLegacyFiches([photo,fiche,{...fiche,codigo:'SIN-FOTO',ruta:'SIN-FOTO/ficha/x.pptx'}, {...fiche,bucket:'aliados-catalogos',ruta:'propuestas/x.pptx'}, {...photo,tipo:'vista'}]);
  assert.equal(plan.count,1);
  assert.equal(plan.bytes,100);
  assert.equal(plan.skipped.length,2);
  assert.deepEqual(plan.files,[fiche]);
});

test('inventario cambiado o error de Storage no elimina referencias',async()=>{
  const client = fake();
  await assert.rejects(removeLegacyFiches(client,'otro-token'),/inventario cambió/);
  assert.deepEqual(client.calls,[]);
  const failed = fake({error:{message:'falló'}});
  await assert.rejects(removeLegacyFiches(failed,planLegacyFiches([photo,fiche]).token),/error de Storage/);
  assert.equal(failed.calls.includes('delete-db'),false);
});

test('solo borra referencias de objetos que Storage confirmó',async()=>{
  const client = fake();
  const result = await removeLegacyFiches(client,planLegacyFiches([photo,fiche]).token);
  assert.equal(result.removed,1);
  assert.equal(result.bytes,100);
  assert.deepEqual(client.calls,[[fiche.ruta],'delete-db']);
  const absent = fake({returned:[]});
  await assert.rejects(removeLegacyFiches(absent,planLegacyFiches([photo,fiche]).token),/confirmó 0/);
  assert.equal(absent.calls.includes('delete-db'),false);
});

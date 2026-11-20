import test from 'node:test';
import assert from 'node:assert/strict';
import {signThumbnailBatch,validateThumbnailBatch} from '../lib/thumbnail-batch.mjs';
import {createThumbnailLoader} from '../lib/thumbnail-batch-client.mjs';

const record=(index)=>({codigo:`TEST-CAL-${String(index).padStart(3,'0')}`,foto:true,fotoVersion:'a'.repeat(64)});
const records=Array.from({length:100},(_,index)=>record(index+1));

function client({archived=false}={}) {
  const calls=[];
  const rows=[{codigo:records[0].codigo,datos_fuente:{}},{codigo:records[1].codigo,datos_fuente:{archivado_en:archived?'2026-11-20':null}}];
  const files=[{codigo:records[0].codigo,sha256:'b'.repeat(64),ruta:'old.png',subido_en:'2026-10-01'},{codigo:records[0].codigo,sha256:'a'.repeat(64),ruta:'new.webp',subido_en:'2026-11-20'},{codigo:records[1].codigo,sha256:'c'.repeat(64),ruta:'two.webp',subido_en:'2026-11-20'}];
  return {calls,from(table){let codes=[];return {select(){return this;},eq(){return this;},order(){return this;},in(_key,value){codes=value;return this;},range:async()=>({data:files.filter(row=>codes.includes(row.codigo)),error:null}),then(resolve,reject){return Promise.resolve({data:rows.filter(row=>codes.includes(row.codigo)),error:null}).then(resolve,reject);}};},storage:{from(bucket){assert.equal(bucket,'aliados-vallas');return {createSignedUrls:async(paths,ttl)=>{calls.push(paths);assert.equal(ttl,600);return {data:paths.map(path=>({path,signedUrl:'https://storage.invalid/'+path})),error:null};}};}}};
}

test('un lote firma solo la foto actual de vallas autorizadas; no revela las archivadas',async()=>{
  const api=client({archived:true});
  const result=await signThumbnailBatch(api,records.slice(0,2).map(row=>row.codigo));
  assert.equal(api.calls.length,1);assert.equal(api.calls[0].length,1);assert.equal(result.images.length,1);assert.equal(result.images[0].version,'a'.repeat(64));
  assert.ok(result.images[0].url.includes('/card.webp'));
  const admin=client({archived:true});
  assert.equal((await signThumbnailBatch(admin,records.slice(0,2).map(row=>row.codigo),'admin',{canReadArchived:async()=>true})).images.length,2);
  assert.ok(admin.calls[0].every(path=>path.endsWith('/admin.webp')));
  for(const codes of [[],[records[0].codigo,records[0].codigo],['../foto'],records.slice(0,51).map(row=>row.codigo)])assert.throws(()=>validateThumbnailBatch(codes));
  assert.throws(()=>validateThumbnailBatch([records[0].codigo],'__proto__'));
});

test('50 miniaturas usan una llamada y reutilizan caché y precarga de página siguiente',async()=>{
  const calls=[];let time=0;
  const loader=createThumbnailLoader({now:()=>time,fetcher:async(_url,options)=>{
    const body=JSON.parse(options.body);calls.push(body.codes);
    return Response.json({expiresIn:600,images:body.codes.map(codigo=>({codigo,url:`https://storage.invalid/${codigo}?batch=${calls.length}`}))});
  }});
  assert.equal(Object.keys(await loader.load(records.slice(0,50))).length,50);assert.equal(calls.length,1);
  await loader.load(records.slice(0,50));assert.equal(calls.length,1);
  await loader.load(records.slice(50,56));
  await loader.load(records.slice(50));assert.deepEqual(calls.map(codes=>codes.length),[50,6,44]);
  time=541000;await loader.load(records.slice(0,50));assert.equal(calls.length,4);
  await loader.load([{...records[0],fotoVersion:'b'.repeat(64)}]);assert.equal(calls.length,5);
});

test('una precarga todavía en curso se comparte y la página inicial ya llega preparada',async()=>{
  const calls=[];
  const loader=createThumbnailLoader({fetcher:async(_url,options)=>{
    const {codes}=JSON.parse(options.body);calls.push(codes.length);
    await new Promise(resolve=>setTimeout(resolve,10));
    return Response.json({images:codes.map(codigo=>({codigo,url:'https://storage.invalid/'+codigo})),expiresIn:600});
  }});
  await Promise.all([loader.load(records.slice(0,6)),loader.load(records.slice(0,50))]);
  assert.deepEqual(calls,[6,44]);
  const initial=createThumbnailLoader({initialSources:[{codigo:records[0].codigo,version:records[0].fotoVersion,url:'https://storage.invalid/initial'}],fetcher:()=>{throw new Error('No debe pedir de nuevo la foto inicial.');}});
  assert.equal((await initial.load([records[0]]))[records[0].codigo],'https://storage.invalid/initial');
});

test('un error de autorización no se guarda como enlace válido y se puede reintentar',async()=>{
  let calls=0;
  const loader=createThumbnailLoader({fetcher:async()=>++calls===1?new Response('Sin permiso',{status:403}):Response.json({images:[{codigo:records[0].codigo,url:'https://storage.invalid/ok'}],expiresIn:600})});
  await assert.rejects(loader.load([records[0]]));assert.equal(loader.cached(records[0],'card'),null);
  assert.equal((await loader.load([records[0]]))[records[0].codigo],'https://storage.invalid/ok');assert.equal(calls,2);
});

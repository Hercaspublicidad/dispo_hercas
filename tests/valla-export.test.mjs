import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {fetchExportImage} from '../lib/valla-export-client.mjs';
import {buildTransferArchive} from '../lib/valla-transfer-zip.mjs';

const image={codigo:'TEST-CAL-001',tipo:'foto',signedUrl:'https://example.invalid/photo',tamano_bytes:3};

test('descarga bytes, reintenta fallos temporales y no reintenta archivos inexistentes',async()=>{
  let attempts=0;
  const bytes=await fetchExportImage(image,{retries:1,fetcher:async()=>++attempts===1?new Response('Temporal',{status:503}):new Response(new Uint8Array([1,2,3]))});
  assert.equal(attempts,2);assert.deepEqual(Array.from(bytes),[1,2,3]);
  attempts=0;
  await assert.rejects(fetchExportImage(image,{fetcher:async()=>{attempts++;return new Response('No existe',{status:404});}}),/HTTP 404/);
  assert.equal(attempts,1);
  await assert.rejects(fetchExportImage(image,{fetcher:async()=>new Response(new Uint8Array([1]))}),/cambió/);
});

test('una imagen que no responde vence por tiempo y se puede detener la descarga',async()=>{
  await assert.rejects(fetchExportImage(image,{timeoutMs:10,retries:0,fetcher:(_url,{signal})=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>resolve(new Response(new Uint8Array([1,2,3]))),1000);
    signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
  })}),/dejó de enviar/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(fetchExportImage(image,{signal:controller.signal,fetcher:()=>{throw new Error('No debería invocarse');}}),/detenida/);
});

test('ZIP descarga en paralelo conservando la foto más reciente y reporta ambas etapas',async()=>{
  let active=0,peak=0;const progress=[];
  const group={records:[{codigo:image.codigo,proveedor:'Aliado',ciudad:'Cali',estado:'completo'}],files:Array.from({length:6},(_,index)=>({...image,ruta:`${image.codigo}/foto/${index}.png`,subido_en:`2026-10-${index+10}`}))};
  const bytes=await buildTransferArchive(group,async file=>{
    active++;peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve,file.ruta.includes('/0.png')?30:1));active--;
    return new Uint8Array([Number(file.ruta.match(/(\d+)\.png$/)[1])]);
  },{concurrency:3,onProgress:state=>progress.push(state)});
  assert.equal(peak,3);
  const zip=await JSZip.loadAsync(bytes), manifest=JSON.parse(await zip.file('datos.json').async('string'));
  assert.equal(manifest.images.length,6);
  assert.ok(manifest.images.at(-1).path.endsWith('foto-6.png'));
  assert.ok((await zip.file('vallas.csv').async('string')).includes('foto-6.png'));
  assert.ok(progress.some(state=>state.phase==='images' && state.completed===6));
  assert.ok(progress.some(state=>state.phase==='zip' && state.percent===100));
});

test('una transferencia lenta sigue mientras recibe bytes; un cuerpo detenido se cancela',async()=>{
  const updates=[];
  const bytes=await fetchExportImage({...image,tamano_bytes:6},{timeoutMs:60,maxTimeMs:1000,retries:0,onBytes:size=>updates.push(size),fetcher:async()=>new Response(new ReadableStream({
    start(controller){let sent=0;const timer=setInterval(()=>{controller.enqueue(new Uint8Array([++sent]));if(sent===6){clearInterval(timer);controller.close();}},20);}
  }))});
  assert.equal(bytes.length,6);assert.deepEqual(updates,[0,1,2,3,4,5,6]);
  let cancelled=false;
  await assert.rejects(fetchExportImage(image,{timeoutMs:10,retries:0,fetcher:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]));},cancel(){cancelled=true;}}))}),/dejó de enviar/);
  assert.equal(cancelled,true);
});

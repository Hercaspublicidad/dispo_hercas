import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import JSZip from 'jszip';
import {convertFullPhotoWebP,fullPhotoWebPRecord,isFullPhotoWebP,replaceFullPhotoReference} from '../lib/full-photo-webp.mjs';
import {buildTransferArchive} from '../lib/valla-transfer-zip.mjs';

const before={codigo:'TEST-CAL-001',tipo:'foto',bucket:'aliados-vallas',sha256:'a'.repeat(64),ruta:'TEST-CAL-001/foto/original.png',mime:'image/png',tamano_bytes:1000,nombre_original:'original.png',subido_en:'2026-10-23T10:00:00Z'};
const metadata={...before,sha256:'b'.repeat(64),ruta:'TEST-CAL-001/foto/full-webp-v1/converted.webp',mime:'image/webp',tamano_bytes:100,nombre_original:'foto.webp'};

function database(initial) {
  const rows=initial.map(row=>({...row}));
  return {rows,from(table) {
    assert.equal(table,'aliados_valla_archivos');
    let action='read',fields={};const filters=[];
    const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},update(value){action='update';fields=value;return this;},delete(){action='delete';return this;},async maybeSingle(){
      const index=rows.findIndex(row=>filters.every(([key,value])=>row[key]===value));
      if(index<0)return {data:null,error:null};
      if(action==='update') {
        const changed={...rows[index],...fields};
        if(rows.some((row,i)=>i!==index && row.codigo===changed.codigo && row.tipo===changed.tipo && row.sha256===changed.sha256))return {data:null,error:{code:'23505'}};
        rows[index]=changed;return {data:{...changed},error:null};
      }
      if(action==='delete')return {data:rows.splice(index,1)[0],error:null};
      return {data:{...rows[index]},error:null};
    }};
    return query;
  }};
}

test('WebP completo conserva la resolución, el contenido original y la fecha de la foto',async()=>{
  const input=await sharp({create:{width:1448,height:1086,channels:3,background:'#5689ab'}}).png().toBuffer(),copy=Buffer.from(input);
  const converted=await convertFullPhotoWebP(input),info=await sharp(converted.bytes).metadata();
  assert.deepEqual([info.format,info.width,info.height],['webp',1448,1086]);assert.deepEqual(input,copy);
  const after=fullPhotoWebPRecord(before,converted);
  assert.equal(after.subido_en,before.subido_en);assert.equal(after.mime,'image/webp');assert.ok(after.ruta.endsWith('.webp'));assert.ok(isFullPhotoWebP(after));
  assert.throws(()=>fullPhotoWebPRecord({...before,tipo:'vista'},converted));
  await assert.rejects(convertFullPhotoWebP(Buffer.from('archivo falso')));
  assert.deepEqual((await convertFullPhotoWebP(converted.bytes)).bytes,converted.bytes);
  const zip=await JSZip.loadAsync(await buildTransferArchive({records:[{codigo:before.codigo,proveedor:'Aliado',ciudad:'Cali'}],files:[after]},async()=>converted.bytes));
  const manifest=JSON.parse(await zip.file('datos.json').async('string'));
  assert.match(manifest.images[0].path,/\.webp$/);assert.ok(!(await zip.file('vallas.csv').async('string')).includes('.png'));
  const exported=await sharp(await zip.file(manifest.images[0].path).async('nodebuffer')).metadata();
  assert.deepEqual([exported.width,exported.height],[1448,1086]);
});

test('la conversión reemplaza la referencia, sin añadir una foto ni cambiar su orden histórico',async()=>{
  const newer={...before,sha256:'c'.repeat(64),ruta:'TEST-CAL-001/foto/newer.png',subido_en:'2026-11-20T10:00:00Z'};
  const client=database([before,newer]);
  const result=await replaceFullPhotoReference(client,before,metadata);
  assert.equal(client.rows.length,2);assert.equal(result.record.sha256,metadata.sha256);assert.equal(result.record.subido_en,before.subido_en);
  assert.equal(client.rows.sort((a,b)=>Date.parse(b.subido_en)-Date.parse(a.subido_en))[0].sha256,newer.sha256);
});

test('una edición concurrente de la referencia no se sobrescribe',async()=>{
  const edited={...before,subido_en:'2026-11-20T10:00:00Z'};
  const client=database([edited]);
  await assert.rejects(replaceFullPhotoReference(client,before,metadata),/cambió/);
  assert.deepEqual(client.rows,[edited]);
});

test('originales que generan un mismo WebP se unen conservando la fecha más reciente',async()=>{
  for(const date of ['2026-10-01T10:00:00Z','2026-11-20T10:00:00Z']) {
    const existing={...metadata,subido_en:date};
    const client=database([before,existing]);
    const result=await replaceFullPhotoReference(client,before,metadata);
    assert.equal(result.deduplicated,true);assert.equal(client.rows.length,1);
    assert.equal(Date.parse(result.record.subido_en),Math.max(Date.parse(date),Date.parse(before.subido_en)));
  }
});

test('una respuesta perdida se puede recuperar sin duplicar ni volver a cambiar la foto',async()=>{
  const client=database([metadata]);
  const result=await replaceFullPhotoReference(client,before,metadata);
  assert.equal(result.recovered,true);assert.deepEqual(client.rows,[metadata]);
});

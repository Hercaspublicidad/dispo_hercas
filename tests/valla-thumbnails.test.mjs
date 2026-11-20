import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {preparePhotoThumbnails,getPhotoThumbnail,writePhotoThumbnails} from '../lib/valla-thumbnails.mjs';
import {thumbnailPath,thumbnailUrl,thumbnailHeaders} from '../lib/valla-thumbnail-config.mjs';
import {mapRemoteCatalog} from '../lib/catalog-supabase.mjs';

const photo={codigo:'TEST-CAL-001',ruta:'TEST-CAL-001/foto/original.png',sha256:'a'.repeat(64)};
const makePhoto=()=>sharp({create:{width:1600,height:1000,channels:3,background:'#aabbcc'}}).png().toBuffer();

test('las miniaturas son WebP pequeñas sin modificar ni ampliar la foto original',async()=>{
  const input=await makePhoto(),copy=Buffer.from(input),result=await preparePhotoThumbnails(input);
  const card=await sharp(result.card).metadata(),admin=await sharp(result.admin).metadata();
  assert.deepEqual([card.format,card.width,card.height],['webp',640,360]);
  assert.deepEqual([admin.format,admin.width,admin.height],['webp',160,100]);
  assert.deepEqual(input,copy);
  assert.ok(result.card.length<input.length);assert.ok(result.admin.length<result.card.length);
  const small=await sharp({create:{width:80,height:50,channels:3,background:'#aabbcc'}}).jpeg().toBuffer();
  const smallMeta=await sharp((await preparePhotoThumbnails(small)).card).metadata();
  assert.ok(smallMeta.width<=80 && smallMeta.height<=50);
  await assert.rejects(preparePhotoThumbnails(Buffer.from('no es una foto')));
});

test('la ruta y la caché cambian al reemplazar la foto; siguen siendo privadas',()=>{
  assert.notEqual(thumbnailPath(photo),thumbnailPath({...photo,sha256:'b'.repeat(64)}));
  assert.notEqual(thumbnailHeaders(photo).ETag,thumbnailHeaders(photo,'admin').ETag);
  assert.match(thumbnailHeaders(photo)['Cache-Control'],/^private/);
  assert.equal(thumbnailHeaders(photo).Vary,'Cookie');
  assert.ok(thumbnailUrl(photo.codigo,photo.sha256).includes('miniatura?size=card&v='));
  for(const size of ['otro','__proto__'])assert.throws(()=>thumbnailPath(photo,size));
  assert.throws(()=>thumbnailPath({...photo,codigo:'../foto'}));
  const record=mapRemoteCatalog([{codigo:photo.codigo,datos_fuente:{}}],[{...photo,tipo:'foto'}],[],[]).records[0];
  assert.equal(record.fotoVersion,photo.sha256);
});

test('una miniatura existente evita volver a leer la imagen grande',async()=>{
  const calls=[];
  const storage={download:async path=>{calls.push(path);return {data:new Blob([new Uint8Array([1,2,3])]),error:null};},upload:()=>{throw new Error('No debe subir nada');}};
  assert.deepEqual(Array.from(await getPhotoThumbnail(storage,photo,'admin')),[1,2,3]);
  assert.deepEqual(calls,[thumbnailPath(photo,'admin')]);
});

test('dos tamaños solicitados juntos reutilizan una sola lectura del original y guardan ambos',async()=>{
  const source=await makePhoto(),stored=new Map(),downloads=[];
  const storage={download:async path=>{
    downloads.push(path);
    if(path===photo.ruta){await new Promise(resolve=>setTimeout(resolve,10));return {data:new Blob([source]),error:null};}
    return stored.has(path)?{data:new Blob([stored.get(path)]),error:null}:{data:null,error:{statusCode:400,message:'Object not found'}};
  },upload:async(path,bytes,options)=>{assert.equal(options.upsert,false);assert.equal(options.contentType,'image/webp');stored.set(path,bytes);return {error:null};}};
  const [card,admin]=await Promise.all([getPhotoThumbnail(storage,photo,'card'),getPhotoThumbnail(storage,photo,'admin')]);
  assert.equal(downloads.filter(path=>path===photo.ruta).length,1);
  assert.equal(stored.size,2);assert.ok(card.length>admin.length);
  const again=await getPhotoThumbnail(storage,photo,'card');
  assert.deepEqual(again,card);assert.equal(downloads.filter(path=>path===photo.ruta).length,1);
});

test('errores de permisos o almacenamiento no se confunden con una miniatura faltante',async()=>{
  const storage={download:async()=>({error:{statusCode:403,message:'denied'}}),upload:()=>{throw new Error('No debe subir nada');}};
  await assert.rejects(getPhotoThumbnail(storage,photo),error=>error.statusCode===403);
  const source=await makePhoto();
  await writePhotoThumbnails({upload:async()=>({error:{statusCode:409,message:'Already exists'}})},photo,source);
  await assert.rejects(writePhotoThumbnails({upload:async()=>({error:{statusCode:500,message:'error'}})},photo,source),error=>error.statusCode===500);
});

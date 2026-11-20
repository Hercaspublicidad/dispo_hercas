import sharp from 'sharp';
import {THUMBNAIL_SIZES,thumbnailPath} from './valla-thumbnail-config.mjs';

const pending=new Map();
const missing=error=>Number(error?.statusCode)===404 || error?.error==='not_found' || /object not found|not found|does not exist/i.test(error?.message || '');
const conflict=error=>Number(error?.statusCode)===409 || /already exists|duplicate/i.test(error?.message || '');

export async function preparePhotoThumbnails(bytes) {
  if(!bytes.length || bytes.length>25*1024*1024)throw new Error('La foto no tiene un tamaño compatible con miniaturas.');
  const input=sharp(bytes,{limitInputPixels:40000000,animated:false});
  const info=await input.metadata();
  if(!['jpeg','png','webp'].includes(info.format) || (info.pages || 1)>1)throw new Error('Formato de foto no compatible con miniaturas.');
  const result={};
  for(const [size,{width,height,quality}] of Object.entries(THUMBNAIL_SIZES)) {
    result[size]=await input.clone().rotate().resize({width,height,fit:'cover',withoutEnlargement:true}).webp({quality,effort:4}).toBuffer();
  }
  return result;
}

export async function writePhotoThumbnails(storage,photo,bytes) {
  const thumbnails=await preparePhotoThumbnails(bytes);
  for(const [size,output] of Object.entries(thumbnails)) {
    const result=await storage.upload(thumbnailPath(photo,size),output,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
    if(result.error && !conflict(result.error))throw result.error;
  }
  return thumbnails;
}

export async function getPhotoThumbnail(storage,photo,size='card') {
  const path=thumbnailPath(photo,size);
  const cached=await storage.download(path);
  if(!cached.error && cached.data)return Buffer.from(await cached.data.arrayBuffer());
  if(cached.error && !missing(cached.error))throw cached.error;
  // Both sizes share a single source download when requested concurrently.
  const key=thumbnailPath(photo,'card');
  if(!pending.has(key)) {
    const task=(async()=>{
      const source=await storage.download(photo.ruta);
      if(source.error || !source.data)throw source.error || new Error('Foto no disponible.');
      return writePhotoThumbnails(storage,photo,Buffer.from(await source.data.arrayBuffer()));
    })();
    pending.set(key,task);
    task.finally(()=>{if(pending.get(key)===task)pending.delete(key);}).catch(()=>{});
  }
  const thumbnails=await pending.get(key);
  return thumbnails[size];
}

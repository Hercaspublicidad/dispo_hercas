import {createHash} from 'node:crypto';
import sharp from 'sharp';

export const isFullPhotoWebP = photo=>photo.mime==='image/webp' && /\.webp$/i.test(photo.ruta);

export async function convertFullPhotoWebP(bytes) {
  if(!bytes.length || bytes.length>25*1024*1024)throw new Error('La foto debe pesar hasta 25 MB.');
  const image=sharp(bytes,{limitInputPixels:40000000,animated:false});
  const info=await image.metadata();
  if(!['png','jpeg','webp'].includes(info.format) || (info.pages || 1)>1)throw new Error('Formato no compatible con fotos completas.');
  // Keep the complete image and its resolution; only apply orientation and encode.
  const output=info.format==='webp' ? bytes : await image.rotate().webp({quality:90,effort:5}).toBuffer();
  return {bytes:output,sha256:createHash('sha256').update(output).digest('hex')};
}

export function fullPhotoWebPRecord(before,converted) {
  if(!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(before.codigo) || !/^[a-f0-9]{64}$/.test(converted.sha256) || before.tipo!=='foto' || before.bucket!=='aliados-vallas')throw new Error('Registro de foto inválido.');
  return {...before,sha256:converted.sha256,ruta:`${before.codigo}/foto/full-webp-v1/${converted.sha256}.webp`,mime:'image/webp',tamano_bytes:converted.bytes.length,nombre_original:`${before.codigo}_foto.webp`};
}

const byIdentity=(query,photo)=>query.eq('codigo',photo.codigo).eq('tipo','foto').eq('bucket','aliados-vallas').eq('sha256',photo.sha256);
const unchanged=(query,photo)=>byIdentity(query,photo).eq('ruta',photo.ruta).eq('subido_en',photo.subido_en);

export async function replaceFullPhotoReference(client,before,after) {
  const fields={sha256:after.sha256,ruta:after.ruta,mime:after.mime,tamano_bytes:after.tamano_bytes,nombre_original:after.nombre_original};
  const updated=await unchanged(client.from('aliados_valla_archivos').update(fields),before).select('*').maybeSingle();
  if(updated.error && updated.error.code!=='23505')throw updated.error;
  if(updated.data)return {record:updated.data,deduplicated:false};
  if(!updated.error) {
    const old=await byIdentity(client.from('aliados_valla_archivos').select('*'),before).maybeSingle();if(old.error)throw old.error;
    const current=await byIdentity(client.from('aliados_valla_archivos').select('*'),after).maybeSingle();if(current.error)throw current.error;
    if(!old.data && current.data?.ruta===after.ruta && isFullPhotoWebP(current.data))return {record:current.data,recovered:true,deduplicated:false};
    throw new Error('La referencia de la foto cambió durante la conversión.');
  }
  // Two originals may encode to the same WebP. Keep the most recent timestamp
  // so converting historical photographs never changes which photo is current.
  for(let attempt=0;attempt<3;attempt++) {
    const target=await byIdentity(client.from('aliados_valla_archivos').select('*'),after).maybeSingle();
    if(target.error)throw target.error;
    if(!target.data || !isFullPhotoWebP(target.data))throw new Error('La foto WebP duplicada requiere revisión.');
    let record=target.data;
    if(Date.parse(before.subido_en)>Date.parse(record.subido_en)) {
      const bumped=await unchanged(client.from('aliados_valla_archivos').update({subido_en:before.subido_en}),record).select('*').maybeSingle();
      if(bumped.error)throw bumped.error;if(!bumped.data)continue;record=bumped.data;
    }
    const removed=await unchanged(client.from('aliados_valla_archivos').delete(),before).select('*').maybeSingle();
    if(removed.error)throw removed.error;
    if(!removed.data)throw new Error('La foto original cambió antes de unir las referencias duplicadas.');
    return {record,deduplicated:true};
  }
  throw new Error('La foto WebP se está actualizando. Reintenta la conversión.');
}

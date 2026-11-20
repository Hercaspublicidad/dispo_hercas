import {THUMBNAIL_SIZES,thumbnailPath} from './valla-thumbnail-config.mjs';
import {CODE_PATTERN} from './valla-admin.mjs';

export function validateThumbnailBatch(codes,size='card') {
  if(!Object.hasOwn(THUMBNAIL_SIZES,size) || !Array.isArray(codes) || !codes.length || codes.length>50 || codes.some(code=>typeof code!=='string'||!CODE_PATTERN.test(code)) || new Set(codes).size!==codes.length)throw new Error('Selecciona hasta 50 códigos válidos, sin repetir.');
}

// Only pass records already filtered by the caller's RLS/catalog permissions.
export async function signKnownThumbnails(client,photos,size='card') {
  if(!photos.length)return {images:[],expiresIn:600};
  validateThumbnailBatch(photos.map(photo=>photo.codigo),size);
  const signed=await client.storage.from('aliados-vallas').createSignedUrls(photos.map(photo=>thumbnailPath(photo,size)),600);
  if(signed.error)throw signed.error;
  const urls=new Map(signed.data.map(item=>[item.path,item]));
  return {expiresIn:600,images:photos.flatMap(photo=>{
    const item=urls.get(thumbnailPath(photo,size));
    return item?.signedUrl && !item.error ? [{codigo:photo.codigo,version:photo.sha256,url:item.signedUrl}] : [];
  })};
}

export async function signThumbnailBatch(client,codes,size='card',{canReadArchived=async()=>false}={}) {
  validateThumbnailBatch(codes,size);
  const rows=await client.from('aliados_vallas').select('codigo,datos_fuente').in('codigo',codes);
  if(rows.error)throw rows.error;
  const hasArchived=rows.data.some(row=>row.datos_fuente?.archivado_en);
  const archivedAllowed=hasArchived && await canReadArchived();
  const allowed=rows.data.filter(row=>!row.datos_fuente?.archivado_en || archivedAllowed).map(row=>row.codigo);
  if(!allowed.length)return {images:[],expiresIn:600};
  const files=[];
  for(let start=0;;start+=500) {
    const result=await client.from('aliados_valla_archivos').select('codigo,ruta,sha256,subido_en').eq('tipo','foto').eq('bucket','aliados-vallas').in('codigo',allowed).order('ruta').range(start,start+499);
    if(result.error)throw result.error;files.push(...result.data);if(result.data.length<500)break;
  }
  const latest=new Map();
  for(const file of files)if(!latest.has(file.codigo)||String(file.subido_en)>String(latest.get(file.codigo).subido_en))latest.set(file.codigo,file);
  return signKnownThumbnails(client,[...latest.values()],size);
}

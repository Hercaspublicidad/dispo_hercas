import JSZip from 'jszip';
import {TRANSFER_VERSION,decodeTransferCsv,encodeTransferCsv,safeTransferPath,transferInput} from './valla-transfer.mjs';

const MB=1024*1024;
export const ARCHIVE_LIMIT=120*MB;
const instructions = `HERCAS — importación de vallas\n\nEdita vallas.csv conservando sus encabezados. Usa codigo como identificador único.\nLa columna foto debe contener la ruta dentro del ZIP, por ejemplo imagenes/TEST-CAL-001/foto.jpg.\nSe admiten JPG, PNG y WebP. Una celda vacía en foto conserva la foto actual.\nNo elimines datos.json para conservar procedencia y las imágenes adicionales de una exportación.\nLos campos de datos.json complementan el CSV; el CSV tiene prioridad para los campos editables.\nLas vallas existentes requieren selección explícita en la revisión. No se eliminan vallas ausentes del archivo.\nLa disponibilidad semanal y su historial se gestionan desde la importación de catálogos, no desde este ZIP.\nLos registros archivados se exportan, pero debes restaurarlos antes de actualizarlos por importación.\nPara agregar una valla nueva completa codigo, proveedor, ciudad y, preferiblemente, ubicación.\n`;

export async function readZipEntry(entry,limit) {
  if(!entry)throw new Error('Falta un archivo indicado en el ZIP.');
  return new Promise((resolve,reject)=>{
    let size=0;const chunks=[];const stream=entry.internalStream('uint8array');
    stream.on('data',chunk=>{size+=chunk.length;if(size>limit){stream.pause();reject(new Error(`El archivo ${entry.name} supera el tamaño permitido.`));return;}chunks.push(chunk);});
    stream.on('error',reject);stream.on('end',()=>{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}resolve(bytes);});stream.resume();
  });
}

export async function readTransferArchive(file) {
  const length=file.size ?? file.byteLength;
  if(!length || length>ARCHIVE_LIMIT)throw new Error('El ZIP debe pesar hasta 120 MB. Importa los paquetes por separado.');
  const zip=await JSZip.loadAsync(file instanceof Blob ? await file.arrayBuffer() : file);
  const names=Object.keys(zip.files);
  if(names.length>5000)throw new Error('El ZIP contiene demasiados archivos.');
  for(const entry of Object.values(zip.files)) {
    const name=entry.unsafeOriginalName || entry.name;
    if(!safeTransferPath(name.replace(/\/$/,'')))throw new Error('El ZIP contiene una ruta inválida.');
  }
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const rows=decodeTransferCsv(decoder.decode(await readZipEntry(zip.file('vallas.csv'),2*MB)));
  let metadata={version:TRANSFER_VERSION,records:[],images:[]};
  if(zip.file('datos.json'))metadata=JSON.parse(decoder.decode(await readZipEntry(zip.file('datos.json'),8*MB)));
  if(metadata.version!==TRANSFER_VERSION || !Array.isArray(metadata.records) || !Array.isArray(metadata.images))throw new Error('datos.json tiene un formato no compatible.');
  if(metadata.records.length>2000 || metadata.images.length>4000)throw new Error('El manifiesto contiene demasiados registros.');
  if(new Set(metadata.records.map(row=>row.codigo)).size!==metadata.records.length)throw new Error('datos.json contiene códigos repetidos.');
  const codes=new Set(rows.map(row=>row.codigo));
  const images=[];const identities=new Set();let total=0;
  const add=async image=>{
    if(!codes.has(image.codigo))return;
    if(!['foto','vista'].includes(image.tipo) || !safeTransferPath(image.path) || !/\.(jpe?g|png|webp)$/i.test(image.path))throw new Error('Imagen o ruta inválida en el manifiesto.');
    const identity=image.codigo+'|'+image.tipo+'|'+image.path;
    if(identities.has(identity))return;
    identities.add(identity);
    const bytes=await readZipEntry(zip.file(image.path),20*MB);total+=bytes.length;
    if(total>200*MB)throw new Error('Las imágenes descomprimidas superan 200 MB. Divide la importación.');
    images.push({...image,bytes});
  };
  // Older images first; each row's chosen photograph is applied last.
  const primary=new Map(rows.filter(row=>row.foto).map(row=>[row.codigo,row.foto]));
  const keepPhoto=new Set(rows.filter(row=>Object.hasOwn(row,'foto')&&!row.foto).map(row=>row.codigo));
  for(const image of metadata.images)if(!(image.tipo==='foto' && (keepPhoto.has(image.codigo) || primary.get(image.codigo)===image.path)))await add(image);
  for(const row of rows)if(row.foto)await add({codigo:row.codigo,tipo:'foto',path:row.foto});
  return {rows,metadata,images};
}

export async function buildTransferArchive(group,fetchImage) {
  const zip=new JSZip(), images=[];
  const ordered=[...group.files].sort((a,b)=>String(a.subido_en||'').localeCompare(String(b.subido_en||'')) || a.ruta.localeCompare(b.ruta));
  for(const [index,image] of ordered.entries()) {
    const extension=image.ruta.match(/\.(jpe?g|png|webp)$/i)?.[0]?.toLowerCase();
    if(!extension)throw new Error(`Formato de imagen no compatible: ${image.codigo}.`);
    const path=`imagenes/${image.codigo}/${image.tipo}-${index+1}${extension}`;
    const bytes=await fetchImage(image);
    zip.file(path,bytes);images.push({codigo:image.codigo,tipo:image.tipo,path,subido_en:image.subido_en});
  }
  const rows=group.records.map(record=>({...transferInput(record),foto:images.filter(image=>image.codigo===record.codigo && image.tipo==='foto').at(-1)?.path || ''}));
  zip.file('vallas.csv',encodeTransferCsv(rows));
  zip.file('datos.json',JSON.stringify({version:TRANSFER_VERSION,exportedAt:new Date().toISOString(),records:group.records,images},null,2));
  zip.file('LEEME.txt',instructions);
  return zip.generateAsync({type:'uint8array',compression:'STORE'});
}

export async function buildTransferTemplate() {
  const zip=new JSZip();zip.file('vallas.csv',encodeTransferCsv([]));zip.file('LEEME.txt',instructions);
  return zip.generateAsync({type:'uint8array'});
}

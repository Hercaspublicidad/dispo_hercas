import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {supabaseAdmin} from './supabase-admin';
import {requireVallaAdmin} from './admin-auth';
import {CODE_PATTERN,PHOTO_LIMIT} from './valla-admin.mjs';
import {prepareVallaPhoto} from './valla-photo.mjs';
import {validateTransferInput} from './valla-transfer.mjs';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function all(admin,table,order) {
  const rows=[];
  for(let start=0;;start+=500) {
    const {data,error}=await admin.from(table).select('*').order(order).range(start,start+499);
    if(error)throw error;rows.push(...data);if(data.length<500)return rows;
  }
}

export async function exportVallas(request) {
  try {
    const access=await requireVallaAdmin(request);if(access.response)return access.response;
    const admin=supabaseAdmin();
    const path=new URL(request.url).searchParams.get('asset');
    if(path) {
      const {data:file,error}=await admin.from('aliados_valla_archivos').select('bucket,tipo,ruta').eq('ruta',path).maybeSingle();
      if(error)throw error;
      if(!file || file.bucket!=='aliados-vallas' || !['foto','vista'].includes(file.tipo))return json({error:'Imagen no encontrada.'},404);
      const signed=await admin.storage.from('aliados-vallas').createSignedUrl(file.ruta,120);
      if(signed.error)throw signed.error;
      return new Response(null,{status:302,headers:{Location:signed.data.signedUrl,'Cache-Control':'private, no-store'}});
    }
    const [records,files]=await Promise.all([all(admin,'aliados_vallas','codigo'),all(admin,'aliados_valla_archivos','ruta')]);
    return json({records,files:files.filter(file=>file.bucket==='aliados-vallas' && ['foto','vista'].includes(file.tipo))});
  } catch(error){console.error('Exportación de vallas:',error.message);return json({error:'No se pudo leer el inventario o sus imágenes.'},503);}
}

export async function prepareTransferImage(bytes) {
  if(!bytes.length || bytes.length>PHOTO_LIMIT)throw new Error('La imagen debe pesar hasta 4 MB.');
  const info=await sharp(bytes,{limitInputPixels:40000000,animated:false}).metadata();
  if(info.format==='webp' && (info.pages || 1)===1 && info.width<=2400 && info.height<=1800 && (!info.orientation || info.orientation===1))return bytes;
  return prepareVallaPhoto(bytes);
}

export async function importValla(request) {
  let admin,uploadedPath=null;
  try {
    const access=await requireVallaAdmin(request);if(access.response)return access.response;
    if(Number(request.headers.get('content-length'))>PHOTO_LIMIT+65536)return json({error:'La imagen supera 4 MB.'},413);
    let form,body;
    try {form=await request.formData();const text=form.get('datos');if(typeof text!=='string' || text.length>40000)throw new Error();body=JSON.parse(text);}catch{return json({error:'Formulario de importación inválido.'},400);}
    if(!body || !CODE_PATTERN.test(body.codigo || '') || !['record','image'].includes(body.action))return json({error:'Acción o código inválido.'},400);
    admin=supabaseAdmin();
    const found=await admin.from('aliados_vallas').select('*').eq('codigo',body.codigo).maybeSingle();if(found.error)throw found.error;
    const previous=found.data;
    if(previous?.datos_fuente?.archivado_en)return json({error:'Restaura esta valla antes de importarla.'},409);
    if(body.action==='record') {
      if(body.source?.archivado_en)return json({error:'La fila exportada está archivada. Restaura la valla y exporta de nuevo antes de importarla.'},409);
      if(!['create','update'].includes(body.mode))return json({error:'Selecciona crear o actualizar.'},400);
      if(body.mode==='create' && previous)return json({error:'El código ya existe. Revisa y aprueba su actualización.'},409);
      if(body.mode==='update' && (!previous || typeof body.expected!=='string' || previous.actualizado_en!==body.expected))return json({error:'La valla cambió. Vuelve a revisar el archivo antes de actualizarla.'},409);
      if(!body.input || body.input.codigo!==body.codigo)return json({error:'El código de la fila no coincide.'},400);
      let payload;try{payload=validateTransferInput(body.input,previous || {},body.source || {});}catch(error){return json({error:error.message},400);}
      const saved=await admin.rpc('aliados_admin_save',{p_user_id:access.user.id,p_codigo:body.codigo,p_payload:payload,p_expected:previous?.actualizado_en || null,p_create:!previous,p_photo:null});
      if(saved.error)throw saved.error;
      return json({record:saved.data});
    }
    if(!previous || typeof body.expected!=='string' || previous.actualizado_en!==body.expected)return json({error:'La valla cambió. Revisa los datos antes de importar sus imágenes.'},409);
    if(!['foto','vista'].includes(body.tipo))return json({error:'Tipo de imagen inválido.'},400);
    const file=form.get('imagen');
    if(!file || typeof file==='string' || file.size>PHOTO_LIMIT)return json({error:'Selecciona una imagen de hasta 4 MB.'},400);
    let bytes;try{bytes=await prepareTransferImage(Buffer.from(await file.arrayBuffer()));}catch{return json({error:'La imagen no es un JPG, PNG o WebP válido.'},400);}
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const existing=await admin.from('aliados_valla_archivos').select('*').eq('codigo',body.codigo).eq('tipo',body.tipo).eq('sha256',sha256).maybeSingle();if(existing.error)throw existing.error;
    const path=existing.data?.ruta || `${body.codigo}/${body.tipo}/${randomUUID()}/${sha256}.webp`;
    if(!existing.data) {
      const upload=await admin.storage.from('aliados-vallas').upload(path,bytes,{contentType:'image/webp',upsert:false});if(upload.error)throw upload.error;uploadedPath=path;
    }
    const photo={ruta:path,sha256,tamano_bytes:bytes.length,mime:'image/webp',nombre_original:`${body.codigo}_${body.tipo}.webp`};
    let record=previous;
    if(body.tipo==='foto') {
      const saved=await admin.rpc('aliados_admin_save',{p_user_id:access.user.id,p_codigo:body.codigo,p_payload:previous,p_expected:body.expected,p_create:false,p_photo:photo});if(saved.error)throw saved.error;record=saved.data;
    } else {
      const saved=await admin.from('aliados_valla_archivos').upsert({codigo:body.codigo,tipo:'vista',bucket:'aliados-vallas',...photo,subido_en:new Date().toISOString()},{onConflict:'codigo,tipo,sha256'});if(saved.error)throw saved.error;
    }
    uploadedPath=null;
    return json({record});
  } catch(error) {
    if(uploadedPath && admin) {
      const reference=await admin.from('aliados_valla_archivos').select('ruta').eq('ruta',uploadedPath).maybeSingle();
      if(!reference.error && !reference.data)await admin.storage.from('aliados-vallas').remove([uploadedPath]);
    }
    if(['23505','40001'].includes(error.code))return json({error:'El código ya existe o cambió durante la importación. Vuelve a revisarlo.'},409);
    console.error('Importación masiva:',error.message);return json({error:'No se pudo guardar esta fila. Puedes reintentar las pendientes.'},503);
  }
}

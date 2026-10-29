import {createHash, randomUUID} from 'node:crypto';
import {supabaseAdmin} from './supabase-admin';
import {requireVallaAdmin} from './admin-auth';
import {CODE_PATTERN, PHOTO_LIMIT, validateValla} from './valla-admin.mjs';
import {prepareVallaPhoto} from './valla-photo.mjs';

const json = (data, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
const fail = error => {
  if (['40001', '23505'].includes(error.code)) return json({error:error.code === '23505' ? 'Ya existe una valla con ese código.' : error.message}, 409);
  if (error.code === 'P0002') return json({error:'Valla no encontrada.'}, 404);
  if (error.code === '42501') return json({error:'No tienes permiso para gestionar vallas.'}, 403);
  console.error('Gestión de vallas:', error.message);
  return json({error:'No se pudo guardar. Inténtalo nuevamente. Si el problema continúa, revisa la configuración del panel.'}, 503);
};

export async function listAdminVallas(request) {
  try {
    const access = await requireVallaAdmin(request);
    if (access.response) return access.response;
    const admin = supabaseAdmin();
    const rows = [], files = [];
    for (let start = 0; ; start += 500) {
      const result = await admin.from('aliados_vallas').select('*').order('codigo').range(start, start + 499);
      if (result.error) throw result.error;
      rows.push(...result.data);
      if (result.data.length < 500) break;
    }
    for (let start = 0; ; start += 500) {
      const result = await admin.from('aliados_valla_archivos').select('codigo,tipo,subido_en').order('ruta').range(start, start + 499);
      if (result.error) throw result.error;
      files.push(...result.data);
      if (result.data.length < 500) break;
    }
    const photos = new Map();
    for (const file of files) if (file.tipo === 'foto' && (!photos.has(file.codigo) || file.subido_en > photos.get(file.codigo))) photos.set(file.codigo, file.subido_en);
    return json({records:rows.map(row => ({...row, foto:photos.has(row.codigo), foto_version:photos.get(row.codigo) || null}))});
  } catch (error) {return fail(error);}
}

export async function saveAdminValla(request, code = null) {
  let admin, uploadedPath = null;
  try {
    const access = await requireVallaAdmin(request);
    if (access.response) return access.response;
    if (code !== null && !CODE_PATTERN.test(code)) return json({error:'Código inválido.'}, 400);
    const length = Number(request.headers.get('content-length'));
    if (length > PHOTO_LIMIT + 65536) return json({error:'La foto supera 4 MB.'}, 413);
    let form, input;
    try {form = await request.formData(); input = JSON.parse(form.get('datos'));}
    catch {return json({error:'Formulario inválido.'}, 400);}
    if (!input || typeof input !== 'object' || Array.isArray(input)) return json({error:'Datos inválidos.'}, 400);
    if (input && JSON.stringify(input).length > 16000) return json({error:'Datos demasiado extensos.'}, 400);
    admin = supabaseAdmin();
    let previous = {};
    if (code) {
      const found = await admin.from('aliados_vallas').select('*').eq('codigo', code).maybeSingle();
      if (found.error) throw found.error;
      if (!found.data) return json({error:'Valla no encontrada.'}, 404);
      previous = found.data;
      if (input.codigo !== code) return json({error:'El código de una valla existente no se puede cambiar.'}, 400);
      if (typeof input.actualizado_en !== 'string' || input.actualizado_en !== previous.actualizado_en) return json({error:'La valla cambió. Recarga antes de guardar.'}, 409);
    }
    let payload;
    try {payload = validateValla(input, previous);} catch(error) {return json({error:error.message}, 400);}
    const file = form.get('foto');
    let photo = null;
    if (file && typeof file !== 'string' && file.size > 0) {
      if (file.size > PHOTO_LIMIT) return json({error:'La foto supera 4 MB.'}, 413);
      let bytes;
      try {bytes = await prepareVallaPhoto(Buffer.from(await file.arrayBuffer()));}
      catch {return json({error:'No se pudo leer la imagen. Usa JPG, PNG o WebP sin animación, de hasta 4 MB y 40 megapíxeles.'}, 400);}
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const path = `${payload.codigo}/foto/${randomUUID()}/${sha256}.webp`;
      const result = await admin.storage.from('aliados-vallas').upload(path, bytes, {contentType:'image/webp', upsert:false});
      if (result.error) throw result.error;
      uploadedPath = path;
      photo = {ruta:path, sha256, tamano_bytes:bytes.length, mime:'image/webp', nombre_original:`${payload.codigo}_foto.webp`};
    }
    const result = await admin.rpc('aliados_admin_save', {p_user_id:access.user.id, p_codigo:payload.codigo,
      p_payload:payload, p_expected:code ? input.actualizado_en : null, p_create:!code, p_photo:photo});
    if (result.error) throw result.error;
    uploadedPath = null;
    return json({record:result.data}, code ? 200 : 201);
  } catch(error) {
    if (uploadedPath && admin) {
      // A lost response may follow a committed transaction. Never remove its photo.
      const reference = await admin.from('aliados_valla_archivos').select('ruta').eq('ruta',uploadedPath).maybeSingle();
      if (!reference.error && !reference.data) {
        const removed = await admin.storage.from('aliados-vallas').remove([uploadedPath]);
        if (removed.error) console.error('No se pudo limpiar la carga pendiente:', removed.error.message);
      }
    }
    return fail(error);
  }
}

export async function archiveAdminValla(request, code) {
  try {
    const access = await requireVallaAdmin(request);
    if (access.response) return access.response;
    if (!CODE_PATTERN.test(code)) return json({error:'Código inválido.'}, 400);
    const input = await request.json().catch(() => null);
    if (!input || typeof input.actualizado_en !== 'string' || typeof input.restaurar !== 'boolean') return json({error:'Solicitud inválida.'}, 400);
    const admin = supabaseAdmin();
    const found = await admin.from('aliados_vallas').select('*').eq('codigo', code).maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) return json({error:'Valla no encontrada.'}, 404);
    const row = found.data;
    const payload = {...row, datos_fuente:{...row.datos_fuente, archivado_en:input.restaurar ? null : new Date().toISOString()}};
    const saved = await admin.rpc('aliados_admin_save', {p_user_id:access.user.id,p_codigo:code,p_payload:payload,p_expected:input.actualizado_en,p_create:false,p_photo:null});
    if (saved.error) throw saved.error;
    return json({record:saved.data});
  } catch(error) {return fail(error);}
}

import {createHash} from 'node:crypto';
import path from 'node:path';
import {supabaseServer} from '../../../lib/supabase-server';
import {hasCatalogManagePermission} from '../../../lib/catalog-permission.mjs';
import {catalogFromSupabase} from '../../../lib/catalog-supabase.mjs';
import {extractCatalogItems,matchCatalogItems} from '../../../lib/scan-catalog-cloud.mjs';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;

export async function POST(request) {
  const client=await supabaseServer();
  const {data:{user},error:authError}=await client.auth.getUser();
  if (authError||!user) return Response.json({error:'Inicia sesión.'},{status:401});
  if (!await hasCatalogManagePermission(client,user.id)) return Response.json({error:'No tienes permiso para actualizar disponibilidades.'},{status:403});
  const body=await request.json().catch(()=>({}));
  const {provider,storagePath,originalName,fullSnapshot}=body;
  if (typeof provider!=='string'||!provider.trim()||typeof storagePath!=='string'||!storagePath.startsWith(`entrantes/${user.id}/`)||typeof originalName!=='string') return Response.json({error:'Datos de carga inválidos.'},{status:400});
  const extension=path.extname(originalName).toLowerCase();
  if (!['.pptx','.pdf','.xlsx','.csv'].includes(extension)||!storagePath.endsWith(extension)) return Response.json({error:'Formato admitido: PPTX, PDF, XLSX o CSV.'},{status:400});
  let createdId=null;
  try {
    const storage=client.storage.from('aliados-catalogos');
    const downloaded=await storage.download(storagePath);
    if (downloaded.error||!downloaded.data) throw downloaded.error||new Error('No se pudo abrir el archivo recibido.');
    const buffer=Buffer.from(await downloaded.data.arrayBuffer());
    if (!buffer.length||buffer.length>200*1024*1024) return Response.json({error:'Archivo vacío o mayor de 200 MB.'},{status:413});
    const sha256=createHash('sha256').update(buffer).digest('hex');
    const existing=await client.from('aliados_catalogos').select('id,estado').eq('proveedor',provider.trim()).eq('sha256',sha256).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.estado==='error') {
      const deletedRows=await client.from('aliados_importacion_filas').delete().eq('catalogo_id',existing.data.id);
      if (deletedRows.error) throw deletedRows.error;
      const deletedCatalog=await client.from('aliados_catalogos').delete().eq('id',existing.data.id);
      if (deletedCatalog.error) throw deletedCatalog.error;
    } else if (existing.data) return Response.json({error:'Este archivo ya fue analizado para el mismo aliado.',stageId:existing.data.id},{status:409});
    const catalog=await catalogFromSupabase(client);
    if (!catalog.records.some(record=>record.proveedor===provider.trim())) return Response.json({error:'Aliado no registrado.'},{status:400});
    const items=await extractCatalogItems(buffer,extension);
    const comparison=matchCatalogItems(items,catalog.records,provider.trim(),{fullSnapshot:!!fullSnapshot,extension});
    const created=await client.from('aliados_catalogos').insert({proveedor:provider.trim(),nombre_original:originalName,sha256,ruta:storagePath,estado:'revisar',procesado_en:new Date().toISOString(),notas:JSON.stringify({fullSnapshot:!!fullSnapshot,scanned:items.length})}).select('id').single();
    if (created.error) throw created.error;
    createdId=created.data.id;
    const rows=comparison.proposals.map((proposal,index)=>({catalogo_id:created.data.id,numero_fila:index+1,codigo_propuesto:proposal.action==='actualizar'?proposal.matches[0].codigo:null,datos_fuente:proposal,resultado:proposal.action==='actualizar'?'coincide':proposal.matches.length?'ambiguo':'nuevo'}));
    for (let start=0;start<rows.length;start+=200) {
      const inserted=await client.from('aliados_importacion_filas').insert(rows.slice(start,start+200));
      if (inserted.error) throw inserted.error;
    }
    return Response.json({stageId:created.data.id,file:originalName,provider,fullSnapshot:!!fullSnapshot,...comparison,note:'Revisa las coincidencias antes de aplicar. Los casos nuevos necesitan foto y ubicación verificadas.'});
  } catch(error) {
    if (createdId) await client.from('aliados_catalogos').update({estado:'error',notas:error.message||'Error de lectura'}).eq('id',createdId);
    return Response.json({error:error.message||'No se pudo analizar el archivo.'},{status:503});
  }
}

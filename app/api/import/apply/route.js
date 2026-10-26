import {supabaseServer} from '../../../../lib/supabase-server';
import {hasCatalogManagePermission} from '../../../../lib/catalog-permission.mjs';
import {catalogFromSupabase} from '../../../../lib/catalog-supabase.mjs';
import {shouldReplaceAvailabilityList} from '../../../../lib/import-coverage.mjs';

export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function POST(request) {
  const client=await supabaseServer();
  const {data:{user},error:authError}=await client.auth.getUser();
  if (authError||!user) return Response.json({error:'Inicia sesión.'},{status:401});
  if (!await hasCatalogManagePermission(client,user.id)) return Response.json({error:'Sin permiso para aplicar cambios.'},{status:403});
  const {stageId,approvedRows}=await request.json().catch(()=>({}));
  if (!/^[a-f0-9-]{36}$/.test(stageId||'')) return Response.json({error:'Análisis no válido.'},{status:400});
  if (!Array.isArray(approvedRows)||approvedRows.some(number=>!Number.isInteger(number)||number<1)||new Set(approvedRows).size!==approvedRows.length) return Response.json({error:'Selección de filas inválida.'},{status:400});
  try {
    const found=await client.from('aliados_catalogos').select('*').eq('id',stageId).single();
    if (found.error||!found.data) return Response.json({error:'No se encontró el análisis.'},{status:404});
    const stage=found.data;
    if (stage.estado!=='revisar') return Response.json({error:stage.estado==='aplicado'?'Este análisis ya fue aplicado.':'Este análisis no está listo para aplicar.'},{status:409});
    const {data:rows,error:rowError}=await client.from('aliados_importacion_filas').select('*').eq('catalogo_id',stageId).order('numero_fila').range(0,9999);
    if (rowError) throw rowError;
    const safe=new Map();
    const approved=new Set(approvedRows);
    for (const row of rows||[]) if (approved.has(row.numero_fila)&&['coincide','aplicado'].includes(row.resultado)&&row.codigo_propuesto&&row.datos_fuente?.selected&&row.datos_fuente?.status) safe.set(row.codigo_propuesto,row);
    if (!safe.size) return Response.json({error:'No hay coincidencias seguras para aplicar.'},{status:422});
    const options=JSON.parse(stage.notas||'{}');
    const snapshotApplied=shouldReplaceAvailabilityList(options.fullSnapshot,safe.size,rows.length);
    const date=new Date().toISOString().slice(0,10);
    const now=new Date().toISOString();
    const events=[];
    for (const [codigo,row] of safe) events.push({codigo,catalogo_id:stageId,disponibilidad:row.datos_fuente.status,fecha_fuente:date,observado_en:now,fuente:stage.nombre_original,notas:row.datos_fuente.ref});
    let unconfirmed=0;
    if (snapshotApplied) {
      const catalog=await catalogFromSupabase(client);
      for (const record of catalog.records) {
        if (record.proveedor!==stage.proveedor||record.estadoFicha==='duplicado_confirmado'||safe.has(record.codigo)) continue;
        events.push({codigo:record.codigo,catalogo_id:stageId,disponibilidad:'Por confirmar',fecha_fuente:date,observado_en:now,fuente:stage.nombre_original,notas:'No figura en el catálogo completo'});
        unconfirmed++;
      }
    }
    for (let start=0;start<events.length;start+=200) {
      const added=await client.from('aliados_disponibilidad_eventos').upsert(events.slice(start,start+200),{onConflict:'catalogo_id,codigo',ignoreDuplicates:true});
      if (added.error) throw added.error;
    }
    const ids=[...safe.values()].map(row=>row.id);
    for (let start=0;start<ids.length;start+=200) {
      const marked=await client.from('aliados_importacion_filas').update({resultado:'aplicado'}).in('id',ids.slice(start,start+200));
      if (marked.error) throw marked.error;
    }
    const changed=await client.from('aliados_catalogos').update({estado:'aplicado',procesado_en:now}).eq('id',stageId);
    if (changed.error) throw changed.error;
    return Response.json({updated:safe.size,review:rows.length-[...safe.values()].length,unconfirmed,snapshotApplied});
  } catch(error) {return Response.json({error:error.message||'No se pudo aplicar.'},{status:503});}
}

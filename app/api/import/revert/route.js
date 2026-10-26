import {supabaseServer} from '../../../../lib/supabase-server';
import {hasCatalogManagePermission} from '../../../../lib/catalog-permission.mjs';

export const dynamic='force-dynamic';

export async function POST(request) {
  const client=await supabaseServer();
  const {data:{user},error:authError}=await client.auth.getUser();
  if (authError||!user) return Response.json({error:'Inicia sesión.'},{status:401});
  if (!await hasCatalogManagePermission(client,user.id)) return Response.json({error:'Sin permiso.'},{status:403});
  const {stageId}=await request.json().catch(()=>({}));
  if (!/^[a-f0-9-]{36}$/.test(stageId||'')) return Response.json({error:'Importación no válida.'},{status:400});
  const {data:stage,error:stageError}=await client.from('aliados_catalogos').select('id,estado').eq('id',stageId).maybeSingle();
  if (stageError) return Response.json({error:stageError.message},{status:503});
  if (!stage||stage.estado!=='aplicado') return Response.json({error:'La importación no está aplicada.'},{status:409});
  const removed=await client.from('aliados_disponibilidad_eventos').delete().eq('catalogo_id',stageId);
  if (removed.error) return Response.json({error:removed.error.message},{status:503});
  const reset=await client.from('aliados_importacion_filas').update({resultado:'coincide'}).eq('catalogo_id',stageId).eq('resultado','aplicado');
  if (reset.error) return Response.json({error:reset.error.message},{status:503});
  const changed=await client.from('aliados_catalogos').update({estado:'revisar',notas:'Aplicación revertida; original conservado.'}).eq('id',stageId);
  if (changed.error) return Response.json({error:changed.error.message},{status:503});
  return Response.json({reverted:true});
}

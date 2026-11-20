import {supabaseServer} from '../../../lib/supabase-server';
import {hasCatalogPermission,hasCatalogAdminRole} from '../../../lib/catalog-permission.mjs';
import {signThumbnailBatch,validateThumbnailBatch} from '../../../lib/thumbnail-batch.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});

export async function POST(request) {
  try {
    const client=await supabaseServer();
    const identity=await client.auth.getUser();
    if(identity.error || !identity.data?.user)return json({error:'Inicia sesión.'},401);
    if(!await hasCatalogPermission(client,identity.data.user.id))return json({error:'Sin permiso para consultar el catálogo.'},403);
    if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen de solicitud inválido.'},403);
    const body=await request.json().catch(()=>null),size=body?.size || 'card';
    try{validateThumbnailBatch(body?.codes,size);}catch(error){return json({error:error.message},400);}
    const result=await signThumbnailBatch(client,body.codes,size,{canReadArchived:()=>hasCatalogAdminRole(client,identity.data.user.id)});
    return json(result);
  } catch(error){console.error('Enlaces de miniaturas:',error.message);return json({error:'No se pudieron preparar las miniaturas.'},503);}
}

import {requireVallaAdmin} from '../../../../lib/admin-auth';
import {supabaseAdmin} from '../../../../lib/supabase-admin';
import {inspectLegacyFiches,removeLegacyFiches} from '../../../../lib/legacy-fiches.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request) {
  try {
    const access = await requireVallaAdmin(request);
    if (access.response) return access.response;
    const plan = await inspectLegacyFiches(supabaseAdmin());
    return Response.json(plan,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    return Response.json({error:error.message || 'No se pudo revisar el almacenamiento.'},{status:503});
  }
}

export async function POST(request) {
  try {
    const access = await requireVallaAdmin(request);
    if (access.response) return access.response;
    const body = await request.json().catch(()=>null);
    if (!body || !/^[a-f0-9]{64}$/.test(body.token || '')) return Response.json({error:'Revisa primero las fichas que se van a retirar.'},{status:400});
    const result = await removeLegacyFiches(supabaseAdmin(),body.token);
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    return Response.json({error:error.message || 'No se pudieron retirar las fichas.'},{status:503});
  }
}

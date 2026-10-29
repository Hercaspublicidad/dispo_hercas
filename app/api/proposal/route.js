import { randomUUID } from 'node:crypto';
import { supabaseServer } from '../../../lib/supabase-server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { hasCatalogPermission } from '../../../lib/catalog-permission.mjs';
import { catalogFromSupabase } from '../../../lib/catalog-supabase.mjs';
import { buildProposal } from '../../../lib/proposal-cloud.mjs';
import { uploadProposal } from '../../../lib/upload-proposal.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const codes = body.codes;
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > 550 || codes.some(x => typeof x !== 'string' || !/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(x)) || new Set(codes).size !== codes.length) {
    return Response.json({error:'Selecciona entre 1 y 550 códigos válidos, sin repetir.'}, {status:400});
  }
  const client = await supabaseServer();
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError || !identity?.user) return Response.json({error:'Inicia sesión.'}, {status:401});
  if (!await hasCatalogPermission(client, identity.user.id)) return Response.json({error:'Sin permiso.'}, {status:403});
  try {
    const catalog = await catalogFromSupabase(client);
    const byCode = new Map(catalog.records.map(r => [r.codigo,r]));
    const selected = codes.map(code => byCode.get(code));
    if (selected.some(r => !r || !r.foto || !r.ficha || r.estadoFicha === 'duplicado_confirmado')) return Response.json({error:'Alguna valla seleccionada no tiene foto y ficha HERCAS.'}, {status:422});
    const photos = [];
    for (let start = 0; ; start += 500) {
      const result = await client.from('aliados_valla_archivos').select('codigo,ruta,subido_en').eq('tipo','foto').in('codigo',codes).order('ruta').range(start,start+499);
      if (result.error) throw result.error;
      photos.push(...result.data);
      if (result.data.length < 500) break;
    }
    const photoByCode = new Map();
    for (const photo of photos || []) if (!photoByCode.has(photo.codigo) || String(photo.subido_en) > String(photoByCode.get(photo.codigo).subido_en)) photoByCode.set(photo.codigo,photo);
    const missing = codes.find(code => !photoByCode.has(code));
    if (missing) return Response.json({error:`Falta la foto de ${missing}.`}, {status:422});
    const getPhoto = async code => {
      const storage = client.storage.from('aliados-vallas');
      const path = photoByCode.get(code).ruta;
      let response = await storage.download(path, {transform:{width:1280,height:720,resize:'cover',quality:60}});
      if (response.error) response = await storage.download(path);
      if (response.error || !response.data) throw new Error(`No se pudo abrir la foto de ${code}`);
      return Buffer.from(await response.data.arrayBuffer());
    };
    const output = await buildProposal(selected,getPhoto);
    const admin = supabaseAdmin();
    const filename = `Vallas_disponibles_HERCAS_${new Date().toISOString().slice(0,10)}.pptx`;
    const path = `propuestas/${new Date().toISOString().slice(0,10)}/${randomUUID()}.pptx`;
    await uploadProposal({admin,path,output});
    const signed = await client.storage.from('aliados-catalogos').createSignedUrl(path,600,{download:filename});
    if (signed.error || !signed.data?.signedUrl) throw signed.error || new Error('No se pudo crear enlace');
    return Response.json({url:signed.data.signedUrl, slides:1+new Set(selected.map(r=>r.ciudad)).size+selected.length, bytes:output.length}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    return Response.json({error:error.message || 'No se pudo preparar el PowerPoint.'}, {status:503});
  }
}

import { supabaseServer } from '../../../../../lib/supabase-server';
import {hasCatalogAdminRole} from '../../../../../lib/catalog-permission.mjs';
import {mapRemoteCatalog} from '../../../../../lib/catalog-supabase.mjs';
import {buildIndividualFiche} from '../../../../../lib/proposal-cloud.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(_request, { params }) {
  const { code, kind } = await params;
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code) || !['foto','vista','ficha'].includes(kind)) return new Response('Archivo no disponible', { status: 404 });
  const supabase = await supabaseServer();
  const {data:valla,error:vallaError} = await supabase.from('aliados_vallas').select('*').eq('codigo',code).maybeSingle();
  if (vallaError) return new Response('No se pudo consultar la valla', {status:503});
  if (!valla) return new Response('Archivo no disponible', {status:404});
  if (valla.datos_fuente?.archivado_en) {
    const {data:{user}} = await supabase.auth.getUser();
    if (!user || !await hasCatalogAdminRole(supabase,user.id)) return new Response('Archivo no disponible', {status:404});
  }
  if (kind === 'ficha') {
    const {data:photo,error} = await supabase.from('aliados_valla_archivos').select('*').eq('codigo',code).eq('tipo','foto').order('subido_en',{ascending:false}).limit(1);
    if (error) return new Response('No se pudo consultar la foto', {status:503});
    if (!photo?.length) return new Response('Añade una foto para generar la ficha', {status:404});
    try {
      const image = await supabase.storage.from('aliados-vallas').download(photo[0].ruta);
      if (image.error) throw image.error;
      const current = {...valla, datos_fuente:{...valla.datos_fuente,archivado_en:null}};
      const record = mapRemoteCatalog([current],photo,[],[]).records[0];
      const bytes = await buildIndividualFiche(record,Buffer.from(await image.data.arrayBuffer()),{includePrices:new URL(_request.url).searchParams.get('includePrices') === 'true'});
      return new Response(bytes, {headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Content-Disposition':`attachment; filename="${code}_ficha_HERCAS.pptx"`,'Cache-Control':'private, no-store'}});
    } catch {return new Response('No se pudo generar la ficha', {status:503});}
  }
  const { data: files, error } = await supabase.from('aliados_valla_archivos').select('ruta,nombre_original').eq('codigo', code).eq('tipo', kind).order('subido_en', { ascending: false }).limit(1);
  if (error) return new Response('No se pudo consultar el archivo', { status: 503 });
  if (!files?.length) return new Response('Archivo no disponible', { status: 404 });
  const options = kind === 'ficha' ? { download: files[0].nombre_original || `${code}.pptx` } : undefined;
  const signed = await supabase.storage.from('aliados-vallas').createSignedUrl(files[0].ruta, 60, options);
  if (signed.error || !signed.data?.signedUrl) return new Response('Archivo no disponible', { status: 503 });
  return new Response(null, {status:302,headers:{Location:signed.data.signedUrl,'Cache-Control':'private, no-store'}});
}

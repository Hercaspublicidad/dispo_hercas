import { supabaseServer } from '../../../../../lib/supabase-server';
import {hasCatalogAdminRole} from '../../../../../lib/catalog-permission.mjs';
import {mapRemoteCatalog} from '../../../../../lib/catalog-supabase.mjs';
import {buildIndividualFiche} from '../../../../../lib/proposal-cloud.mjs';
import {supabaseAdmin} from '../../../../../lib/supabase-admin';
import {getPhotoThumbnail} from '../../../../../lib/valla-thumbnails.mjs';
import {THUMBNAIL_SIZES,thumbnailHeaders} from '../../../../../lib/valla-thumbnail-config.mjs';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(_request, { params }) {
  const { code, kind } = await params;
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code) || !['foto','vista','ficha','miniatura'].includes(kind)) return new Response('Archivo no disponible', { status: 404 });
  const size=new URL(_request.url).searchParams.get('size') || 'card';
  if(kind==='miniatura' && !Object.hasOwn(THUMBNAIL_SIZES,size))return new Response('Tamaño no disponible',{status:400});
  const supabase = await supabaseServer();
  const {data:valla,error:vallaError} = await supabase.from('aliados_vallas').select('*').eq('codigo',code).maybeSingle();
  if (vallaError) return new Response('No se pudo consultar la valla', {status:503});
  if (!valla) return new Response('Archivo no disponible', {status:404});
  if (valla.datos_fuente?.archivado_en) {
    const {data:{user}} = await supabase.auth.getUser();
    if (!user || !await hasCatalogAdminRole(supabase,user.id)) return new Response('Archivo no disponible', {status:404});
  }
  if(kind==='miniatura') {
    const {data:photo,error}=await supabase.from('aliados_valla_archivos').select('codigo,ruta,sha256,subido_en').eq('codigo',code).eq('tipo','foto').order('subido_en',{ascending:false}).limit(1);
    if(error)return new Response('No se pudo consultar la foto',{status:503,headers:{'Cache-Control':'no-store'}});
    if(!photo?.length)return new Response('Foto no disponible',{status:404,headers:{'Cache-Control':'no-store'}});
    try {
      const headers=thumbnailHeaders(photo[0],size);
      // Revalidation happens only after the normal row/role authorization above.
      if(_request.headers.get('if-none-match')===headers.ETag)return new Response(null,{status:304,headers});
      const bytes=await getPhotoThumbnail(supabaseAdmin().storage.from('aliados-vallas'),photo[0],size);
      return new Response(bytes,{headers:{...headers,'Content-Length':String(bytes.length)}});
    } catch(error){console.error('Miniatura:',error.message);return new Response('No se pudo preparar la miniatura',{status:503,headers:{'Cache-Control':'no-store'}});}
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

import { supabaseServer } from '../../../../../lib/supabase-server';
export const dynamic = 'force-dynamic';
export async function GET(_request, { params }) {
  const { code, kind } = await params;
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code) || !['foto','vista','ficha'].includes(kind)) return new Response('Archivo no disponible', { status: 404 });
  const supabase = await supabaseServer();
  const { data: files, error } = await supabase.from('aliados_valla_archivos').select('ruta,nombre_original').eq('codigo', code).eq('tipo', kind).order('subido_en', { ascending: false }).limit(1);
  if (error) return new Response('No se pudo consultar el archivo', { status: 503 });
  if (!files?.length) return new Response('Archivo no disponible', { status: 404 });
  const options = kind === 'ficha' ? { download: files[0].nombre_original || `${code}.pptx` } : undefined;
  const signed = await supabase.storage.from('aliados-vallas').createSignedUrl(files[0].ruta, 60, options);
  if (signed.error || !signed.data?.signedUrl) return new Response('Archivo no disponible', { status: 503 });
  return Response.redirect(signed.data.signedUrl, 302);
}

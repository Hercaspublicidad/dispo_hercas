import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.join(root, '..', '.env.upload.local'));
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('Falta la clave secreta local de carga');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmstapaovlvflbiiqgxv.supabase.co', key, { auth: { persistSession: false, autoRefreshToken: false } });
const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
const code = manifest.codigo;
if (!/^[A-Z0-9-]+$/.test(code)) throw new Error('Código inválido');
for (const file of [manifest.foto, manifest.ficha, manifest.vista_previa]) {
  if (!(await stat(file)).isFile()) throw new Error(`Falta archivo: ${file}`);
}
if (!(await stat(manifest.fuente)).isFile()) throw new Error('No se encontró el catálogo fuente');
const { data: existing, error: lookupError } = await client.from('aliados_vallas').select('codigo,fuente_local_id').eq('codigo', code).maybeSingle();
if (lookupError) throw lookupError;
if (existing && existing.fuente_local_id !== `${manifest.fuente}#${manifest.diapositiva || manifest.pagina}`) throw new Error(`Ya existe el código ${code} con otro origen; carga detenida`);
const row = {
  codigo: code, proveedor: manifest.grupo_carpeta, ciudad: manifest.ciudad,
  ubicacion: manifest.ubicacion, categoria: manifest.categoria || 'Pantalla en aeropuerto',
  formato: manifest.formato, medidas: manifest.medidas,
  latitud: manifest.latitud ?? null, longitud: manifest.longitud ?? null,
  tarifa_mensual_cop: Number(manifest.precio_texto.replace(/[^\d]/g, '')),
  estado: manifest.estado || 'revision_fuente', fuente_local_id: `${manifest.fuente}#${manifest.diapositiva || manifest.pagina}`,
  datos_fuente: {
    entorno: manifest.entorno, tipo_soporte: manifest.tipo_soporte,
    codigo_proveedor: manifest.codigo_proveedor || null,
    archivo_fuente_nombre: path.basename(manifest.fuente),
    archivo_fuente_ruta: manifest.fuente, pagina_diapositiva: manifest.diapositiva || manifest.pagina,
    observacion_calidad: manifest.estado_revision,
    disponibilidad_fuente: 'Por confirmar',
  },
};
if (!existing) {
  const { error: insertError } = await client.from('aliados_vallas').insert(row);
  if (insertError) throw insertError;
}
for (const [tipo, file] of [['foto', manifest.foto], ['vista', manifest.vista_previa], ['ficha', manifest.ficha]]) {
  const bytes = await readFile(file);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const extension = path.extname(file).toLowerCase();
  const mime = extension === '.pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'image/png';
  const route = `${code}/${tipo}/${sha256}${extension}`;
  const { error: uploadError } = await client.storage.from('aliados-vallas').upload(route, bytes, { contentType: mime, upsert: false });
  if (uploadError && uploadError.statusCode !== '409') throw uploadError;
  const { data: info, error: infoError } = await client.storage.from('aliados-vallas').info(route);
  if (infoError || Number(info?.size) !== bytes.length) throw new Error(`No se verificó ${route}: ${infoError?.message || 'tamaño distinto'}`);
  const { error: fileError } = await client.from('aliados_valla_archivos').upsert({ codigo: code, tipo, sha256, bucket: 'aliados-vallas', ruta: route, tamano_bytes: bytes.length, mime, nombre_original: path.basename(file) }, { onConflict: 'codigo,tipo,sha256' });
  if (fileError) throw fileError;
  process.stdout.write(`${code} ${tipo} verificado\n`);
}

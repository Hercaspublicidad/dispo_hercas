import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const preparedDefault = 'D:\\Aliados exteriores\\Fichas_HERCAS_2026\\_migracion_supabase\\preparado.json';

export function sqlForRows(rows) {
  if (!rows.length) throw new Error('Lote vacío');
  const literal = JSON.stringify(rows).replaceAll("'", "''");
  return `insert into public.aliados_vallas
  (codigo, proveedor, ciudad, ubicacion, categoria, formato, medidas, latitud, longitud,
   tarifa_mensual_cop, estado, duplicado_de, fuente_local_id, datos_fuente)
select codigo, proveedor, ciudad, ubicacion, categoria, formato, medidas, latitud, longitud,
       tarifa_mensual_cop, estado, duplicado_de, fuente_local_id, datos_fuente
from jsonb_to_recordset('${literal}'::jsonb) as x(
  codigo text, proveedor text, ciudad text, ubicacion text, categoria text, formato text,
  medidas text, latitud numeric, longitud numeric, tarifa_mensual_cop numeric,
  estado text, duplicado_de text, fuente_local_id text, datos_fuente jsonb)
on conflict (codigo) do nothing;`;
}

async function uploadAssets(preparedPath, selectedCodes = null) {
  const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.upload.local');
  try { process.loadEnvFile(envFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || `https://mmstapaovlvflbiiqgxv.supabase.co`;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SECRET_KEY en .env.upload.local; nunca use NEXT_PUBLIC_ para este secreto');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const prepared = JSON.parse(await readFile(preparedPath, 'utf8'));
  const journalPath = path.join(path.dirname(preparedPath), 'subida_avance.json');
  let journal = { completed: {} };
  try { journal = JSON.parse(await readFile(journalPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const assets = selectedCodes ? prepared.assets.filter(a => selectedCodes.has(a.codigo)) : prepared.assets;
  if (selectedCodes && !assets.length) throw new Error('No hay archivos para los códigos solicitados');
  let done = 0;
  for (const asset of assets) {
    const id = `${asset.codigo}/${asset.tipo}/${asset.sha256}`;
    if (journal.completed[id]) { done++; continue; }
    const local = await stat(asset.archivo_local);
    if (local.size !== asset.tamano_bytes) throw new Error(`Tamaño local cambió: ${asset.archivo_local}`);
    const storage = client.storage.from(asset.bucket);
    const { data: existing, error: infoError } = await storage.info(asset.ruta);
    if (existing && Number(existing.size) !== asset.tamano_bytes) throw new Error(`Tamaño remoto distinto: ${asset.ruta}`);
    if (!existing && infoError && infoError.statusCode !== '404' && infoError.status !== 404) throw infoError;
    if (!existing) {
      const content = await readFile(asset.archivo_local);
      if (createHash('sha256').update(content).digest('hex') !== asset.sha256) throw new Error(`Contenido local cambió: ${asset.archivo_local}`);
      let failure;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await storage.upload(asset.ruta, content, { contentType: asset.mime, upsert: false });
        if (!error) { failure = null; break; }
        failure = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
      if (failure) throw failure;
      const { data: uploaded, error: verifyError } = await storage.info(asset.ruta);
      if (verifyError || Number(uploaded?.size) !== asset.tamano_bytes) throw new Error(`No se verificó tamaño remoto: ${asset.ruta}`);
    }
    const { archivo_local, ...row } = asset;
    const { error: rowError } = await client.from('aliados_valla_archivos').upsert(row, { onConflict: 'codigo,tipo,sha256' });
    if (rowError) throw rowError;
    journal.completed[id] = true;
    await writeFile(journalPath, JSON.stringify(journal));
    done++;
    if (done % 25 === 0) process.stdout.write(`${done}/${assets.length}\n`);
  }
  process.stdout.write(`Subidos y registrados: ${done}/${assets.length}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, preparedPath = preparedDefault, batchIndex = '0', batchSize = '20'] = process.argv.slice(2);
  if (mode === '--sql-batch') {
    const { rows } = JSON.parse(await readFile(preparedPath, 'utf8'));
    const slice = rows.slice(Number(batchIndex) * Number(batchSize), (Number(batchIndex) + 1) * Number(batchSize));
    process.stdout.write(sqlForRows(slice));
  } else if (mode === '--upload') await uploadAssets(preparedPath, batchIndex === '0' ? null : new Set(batchIndex.split(',')));
  else throw new Error('Uso: --sql-batch <preparado.json> <índice> [tamaño] | --upload <preparado.json> [códigos separados por coma]');
}

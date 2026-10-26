import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kinds = { foto_HERCAS: 'foto', vista_previa: 'vista', ficha_editable: 'ficha' };
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const validStates = new Set(['completo', 'revision_fuente', 'duplicado_confirmado']);

function inside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function coordinate(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export async function prepareCatalogMigration(manifestPath) {
  const lexicalRoot = path.resolve(path.dirname(manifestPath));
  const root = await realpath(lexicalRoot);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.registros)) throw new Error('El manifiesto no tiene registros');
  const rows = [], assets = [], warnings = [], seen = new Set();
  const counts = { completo: 0, revision_fuente: 0, duplicado_confirmado: 0 };
  for (const record of manifest.registros) {
    const code = String(record.codigo_hercas ?? '').trim();
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(code)) throw new Error(`Código inválido: ${code}`);
    if (seen.has(code)) throw new Error(`Código repetido: ${code}`);
    seen.add(code);
    if (!validStates.has(record.estado)) throw new Error(`Estado inválido en ${code}: ${record.estado}`);
    if (!record.proveedor || !record.ciudad) throw new Error(`Proveedor o ciudad faltante en ${code}`);
    counts[record.estado]++;
    const raw = { ...record };
    for (const key of [...Object.keys(kinds), 'carpeta_destino', 'archivo_fuente']) delete raw[key];
    if (record.archivo_fuente) raw.archivo_fuente_nombre = path.win32.basename(record.archivo_fuente);
    rows.push({
      codigo: code,
      proveedor: record.proveedor,
      ciudad: record.ciudad,
      ubicacion: record.ubicacion || null,
      categoria: record.categoria || null,
      formato: record.formato || null,
      medidas: record.medidas_fuente || null,
      latitud: coordinate(record.latitud_texto, -90, 90),
      longitud: coordinate(record.longitud_texto, -180, 180),
      tarifa_mensual_cop: record.tarifa_mensual_cop_extraida !== null && record.tarifa_mensual_cop_extraida !== undefined && String(record.tarifa_mensual_cop_extraida).trim() !== '' && Number.isFinite(Number(record.tarifa_mensual_cop_extraida)) ? Number(record.tarifa_mensual_cop_extraida) : null,
      estado: record.estado,
      duplicado_de: record.posible_duplicado_con || null,
      fuente_local_id: record.id || null,
      datos_fuente: raw,
    });
    for (const [field, tipo] of Object.entries(kinds)) {
      const local = record[field];
      if (!local) continue;
      const resolved = path.resolve(local);
      if (!inside(lexicalRoot, resolved)) throw new Error(`Archivo fuera de la carpeta de datos: ${local}`);
      let file;
      try { file = await realpath(resolved); }
      catch { warnings.push({ codigo: code, tipo, motivo: 'archivo no encontrado' }); continue; }
      if (!inside(root, file)) throw new Error(`Archivo fuera de la carpeta de datos: ${local}`);
      const info = await stat(file);
      if (!info.isFile() || !info.size) { warnings.push({ codigo: code, tipo, motivo: 'archivo vacío o inválido' }); continue; }
      const ext = path.extname(file).toLowerCase();
      if (!mime[ext]) { warnings.push({ codigo: code, tipo, motivo: `formato no permitido ${ext}` }); continue; }
      const sha256 = await digest(file);
      assets.push({ codigo: code, tipo, sha256, bucket: 'aliados-vallas', ruta: `${code}/${tipo}/${sha256}${ext}`, tamano_bytes: info.size, mime: mime[ext], nombre_original: path.basename(file), archivo_local: file });
    }
  }
  return { rows, assets, warnings, counts, total: rows.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const manifest = process.argv[2] || 'D:\\Aliados exteriores\\Fichas_HERCAS_2026\\avance.json';
  const output = process.argv[3] || 'D:\\Aliados exteriores\\Fichas_HERCAS_2026\\_migracion_supabase\\preparado.json';
  const result = await prepareCatalogMigration(manifest);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result));
  const byKind = Object.fromEntries(['foto','vista','ficha'].map(tipo => [tipo, result.assets.filter(a => a.tipo === tipo).length]));
  process.stdout.write(JSON.stringify({ output, total: result.total, counts: result.counts, byKind, bytes: result.assets.reduce((n,a) => n + a.tamano_bytes, 0), warnings: result.warnings.length }) + '\n');
}

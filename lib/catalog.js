import fs from 'node:fs';
import path from 'node:path';
export const ROOT = process.env.HERCAS_DATA_ROOT || 'D:\\Aliados exteriores\\Fichas_HERCAS_2026';
const MANIFEST = path.join(ROOT, 'avance.json');
const OVERRIDES = path.join(ROOT, 'catalogo_disponibilidad.json');
const NEW = path.join(ROOT, 'catalogo_nuevas_pendientes.json');
export function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
export function writeJson(file, value) { const temp = file + '.' + process.pid + '.tmp'; fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8'); fs.renameSync(temp, file); }
export function cleanCoord(value, min, max) { if (value == null) return null; const n = Number(String(value).replace(/\s+/g, '').replace(',', '.')); return Number.isFinite(n) && n >= min && n <= max ? n : null; }
export function catalog() {
  const manifest = readJson(MANIFEST, { registros: [] }), overrides = readJson(OVERRIDES, {});
  const records = manifest.registros.map(r => {
    const o = overrides[r.codigo_hercas] || {}, lat = cleanCoord(r.latitud_texto, -4, 14), lon = cleanCoord(r.longitud_texto, -82, -66);
    return { codigo: r.codigo_hercas, proveedor: r.proveedor, ciudad: r.ciudad, ubicacion: r.ubicacion || '', formato: r.formato || r.categoria || 'Valla exterior', medidas: r.medidas_fuente || '', estadoFicha: r.estado, disponibilidad: o.disponibilidad || r.disponibilidad_fuente || 'No indicada', fechaDisponibilidad: o.fecha || r.fecha_fuente || null, tarifa: r.tarifa_mensual_cop_extraida || null, foto: !!(r.foto_HERCAS && fs.existsSync(r.foto_HERCAS)), ficha: !!(r.ficha_editable && fs.existsSync(r.ficha_editable)), lat, lon, revision: r.observacion_calidad || r.revision || '', pagina: r.pagina_diapositiva || null, archivoFuente: r.archivo_fuente || '' };
  });
  return { records, pendingNew: readJson(NEW, []) };
}
export function findOriginal(code) { return readJson(MANIFEST, { registros: [] }).registros.find(r => r.codigo_hercas === code); }
export function safeExistingAsset(code, kind) {
  const r = findOriginal(code), key = { foto: 'foto_HERCAS', vista: 'vista_previa', ficha: 'ficha_editable' }[kind];
  if (!r || !key || !r[key]) return null;
  const resolved = path.resolve(r[key]), root = path.resolve(ROOT) + path.sep;
  return resolved.toLowerCase().startsWith(root.toLowerCase()) && fs.existsSync(resolved) ? resolved : null;
}
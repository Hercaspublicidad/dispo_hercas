import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson, writeJson } from '../../../../lib/catalog';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  const body = await request.json();
  if (!/^[a-f0-9]{32}$/.test(body.stageId || '')) return Response.json({ error: 'Análisis no válido.' }, { status: 400 });
  const file = path.join(ROOT, '_catalogos_entrantes', 'analisis', body.stageId + '.json');
  if (!fs.existsSync(file)) return Response.json({ error: 'No se encontró el análisis.' }, { status: 404 });
  const stage = readJson(file, null);
  if (!stage || stage.appliedAt) return Response.json({ error: 'Este análisis ya fue aplicado.' }, { status: 409 });
  const overridesFile = path.join(ROOT, 'catalogo_disponibilidad.json');
  const queueFile = path.join(ROOT, 'catalogo_nuevas_pendientes.json');
  const overrides = readJson(overridesFile, {}), queue = readJson(queueFile, []);
  let updated = 0, review = 0;
  const date = new Date().toISOString().slice(0, 10);
  for (const p of stage.proposals) {
    if (p.action === 'actualizar' && p.selected && p.matches?.[0]?.codigo && p.status) {
      const code = p.matches[0].codigo;
      overrides[code] = { disponibilidad: p.status, fecha: date, proveedor: stage.provider, fuente: stage.file, referencia: p.ref, actualizado: new Date().toISOString() };
      updated++;
    } else {
      if (!queue.some(q => q.stageId === stage.id && q.ref === p.ref)) queue.push({ stageId: stage.id, ref: p.ref, proveedor: stage.provider, archivo: stage.file, codigoLeido: p.code, ciudad: p.city, ubicacion: p.address, disponibilidad: p.status, coincidencias: p.matches, estado: 'revision_manual', extracto: p.excerpt });
      review++;
    }
  }
  writeJson(overridesFile, overrides);
  writeJson(queueFile, queue);
  stage.appliedAt = new Date().toISOString(); stage.updated = updated; stage.review = review;
  writeJson(file, stage);
  return Response.json({ updated, review });
}
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../../lib/catalog';
export const dynamic = 'force-dynamic';
const allowed = new Set(['.xlsx', '.csv', '.pptx', '.pdf']);
export async function POST(request) {
  const form = await request.formData(), file = form.get('file');
  if (!file || typeof file === 'string') return Response.json({ error: 'Selecciona un archivo.' }, { status: 400 });
  const ext = path.extname(file.name).toLowerCase();
  if (!allowed.has(ext)) return Response.json({ error: 'Formato admitido: XLSX, CSV, PPTX o PDF.' }, { status: 400 });
  if (file.size > 40 * 1024 * 1024) return Response.json({ error: 'El máximo por archivo es 40 MB.' }, { status: 400 });
  const provider = String(form.get('provider') || '').trim();
  if (!provider) return Response.json({ error: 'Selecciona el proveedor.' }, { status: 400 });
  const inbox = path.join(ROOT, '_catalogos_entrantes'); fs.mkdirSync(inbox, { recursive: true });
  const safe = path.basename(file.name).replace(/[^\p{L}\p{N}._-]+/gu, '_');
  const target = path.join(inbox, new Date().toISOString().replace(/[:.]/g, '-') + '_' + safe);
  fs.writeFileSync(target, Buffer.from(await file.arrayBuffer()));
  const python = process.env.HERCAS_PYTHON || 'C:\\Users\\Administrador\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
  const run = spawnSync(python, [path.join(process.cwd(), 'scripts', 'scan_catalog.py'), '--file', target, '--provider', provider, '--root', ROOT], { encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  if (run.error || run.status !== 0) return Response.json({ error: run.stderr || run.error?.message || 'No se pudo leer el archivo.', saved: target }, { status: 500 });
  try { return Response.json(JSON.parse(run.stdout)); } catch { return Response.json({ error: 'Resultado de lectura inválido.', saved: target }, { status: 500 }); }
}
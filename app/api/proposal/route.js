import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from '../../../lib/catalog';
export const dynamic = 'force-dynamic';
const run = promisify(execFile);
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const codes = body.codes;
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > 550 || codes.some(x => typeof x !== 'string' || !/^[A-Z0-9-]{3,25}$/.test(x)) || new Set(codes).size !== codes.length) {
    return Response.json({ error: 'Selecciona entre 1 y 550 vallas válidas, sin repetir.' }, { status: 400 });
  }
  const python = process.env.HERCAS_PYTHON || 'C:\\Users\\Administrador\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'hercas-propuesta-'));
  const output = path.join(folder, 'vallas_disponibles.pptx');
  try {
    const result = await run(python, [path.join(process.cwd(), 'scripts', 'make_proposal.py'), '--root', ROOT, '--codes', JSON.stringify(codes), '--output', output], { timeout: 600000, maxBuffer: 1024 * 1024, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    const summary = JSON.parse(result.stdout);
    const buffer = await fs.readFile(output);
    const name = 'Vallas_disponibles_HERCAS_' + new Date().toISOString().slice(0,10) + '.pptx';
    return new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Disposition': 'attachment; filename="' + name + '"', 'Content-Length': String(buffer.length), 'X-Hercas-Slides': String(summary.slides), 'Cache-Control': 'no-store' } });
  } catch (error) {
    const detail = error.stderr?.trim().split('\n').slice(-2).join(' ').slice(0,500);
    return Response.json({ error: detail || error.message || 'No se pudo generar la presentación.' }, { status: 500 });
  } finally {
    await fs.rm(output, { force: true }).catch(() => {});
    await fs.rmdir(folder).catch(() => {});
  }
}
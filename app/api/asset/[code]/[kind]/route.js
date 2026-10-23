import fs from 'node:fs';
import path from 'node:path';
import { safeExistingAsset } from '../../../../../lib/catalog';
export const dynamic = 'force-dynamic';
export async function GET(_request, { params }) {
  const { code, kind } = await params, file = safeExistingAsset(code, kind);
  if (!file) return new Response('Archivo no disponible', { status: 404 });
  const type = kind === 'ficha' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'image/png';
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
  if (kind === 'ficha') headers['Content-Disposition'] = 'attachment; filename="' + path.basename(file) + '"';
  return new Response(fs.readFileSync(file), { headers });
}
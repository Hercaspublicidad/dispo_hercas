import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

test('migración aditiva del catálogo protege tablas y archivos', async () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const files = await readdir(dir);
  const name = files.find(file => file.endsWith('_aliados_catalogo.sql'));
  assert.ok(name, 'falta la migración del catálogo');
  const sql = await readFile(new URL(name, dir), 'utf8');
  for (const table of ['aliados_vallas', 'aliados_valla_archivos', 'aliados_catalogos', 'aliados_importacion_filas', 'aliados_disponibilidad_eventos']) {
    assert.match(sql, new RegExp(`create table public\\.${table}\\b`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  for (const bucket of ['aliados-vallas', 'aliados-catalogos']) assert.ok(sql.includes(`'${bucket}'`));
  assert.match(sql, /private\.has_permission\('cotizador\.availability\.read'\)/);
  assert.match(sql, /private\.has_permission\('cotizador\.availability\.manage'\)/);
  assert.match(sql, /grant select on public\.aliados_vallas to authenticated/i);
  assert.doesNotMatch(sql, /\b(drop|truncate)\s+(table\s+)?(public\.)?(inventory_assets|availability_entries|user_roles|role_permissions)/i);
});

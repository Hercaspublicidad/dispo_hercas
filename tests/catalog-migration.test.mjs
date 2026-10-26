import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareCatalogMigration } from '../scripts/prepare_catalog_migration.mjs';
import { sqlForRows } from '../scripts/upload_catalog_initial.mjs';

test('prepara registros, estados y archivos con rutas seguras', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'hercas-catalog-'));
  try {
    const folder = path.join(root, 'MV-BAQ-001');
    await mkdir(folder);
    const foto = path.join(folder, 'foto.png');
    const ficha = path.join(folder, 'ficha.pptx');
    await writeFile(foto, 'foto');
    await writeFile(ficha, 'ficha');
    const manifest = path.join(root, 'avance.json');
    await writeFile(manifest, JSON.stringify({ registros: [{codigo_hercas:'MV-BAQ-001', proveedor:'METRO VIAS', ciudad:'Barranquilla', estado:'completo', foto_HERCAS:foto, ficha_editable:ficha, tarifa_mensual_cop_extraida:9700000}, {codigo_hercas:'MV-BAQ-002', proveedor:'METRO VIAS', ciudad:'Barranquilla', estado:'revision_fuente'}] }));
    const prepared = await prepareCatalogMigration(manifest);
    assert.equal(prepared.rows.length, 2);
    assert.equal(prepared.rows[0].tarifa_mensual_cop, 9700000);
    assert.equal(prepared.assets.length, 2);
    assert.equal(prepared.assets[0].sha256.length, 64);
    assert.equal(prepared.assets[0].ruta, `MV-BAQ-001/foto/${prepared.assets[0].sha256}.png`);
    assert.deepEqual(prepared.counts, {completo:1, revision_fuente:1, duplicado_confirmado:0});
    assert.equal(prepared.warnings.length, 0);
    await writeFile(manifest, JSON.stringify({registros:[{codigo_hercas:'MV-BAQ-001',proveedor:'METRO VIAS',ciudad:'Barranquilla',estado:'completo'},{codigo_hercas:'MV-BAQ-001',proveedor:'METRO VIAS',ciudad:'Barranquilla',estado:'completo'}]}));
    await assert.rejects(prepareCatalogMigration(manifest), /código repetido/i);
    await writeFile(manifest, JSON.stringify({registros:[{codigo_hercas:'MV-BAQ-001',proveedor:'METRO VIAS',ciudad:'Barranquilla',estado:'completo',foto_HERCAS:path.join(root,'..','outside.png')}]}));
    await assert.rejects(prepareCatalogMigration(manifest), /fuera de la carpeta/i);
  } finally { await rm(root, {recursive:true, force:true}); }
});

test('el lote SQL conserva comillas y solo inserta códigos faltantes', () => {
  const sql = sqlForRows([{codigo:'MV-BAQ-001', proveedor:"O'Hara", ciudad:'Barranquilla', estado:'completo', datos_fuente:{nota:"calle O'Hara"}}]);
  assert.match(sql, /O''Hara/);
  assert.match(sql, /on conflict \(codigo\) do nothing/i);
  assert.match(sql, /jsonb_to_recordset/i);
});

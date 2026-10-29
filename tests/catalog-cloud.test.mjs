import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogFromSupabase, mapRemoteCatalog } from '../lib/catalog-supabase.mjs';

test('el catálogo remoto pagina filas y marca archivos existentes', async () => {
  const rows = [
    {codigo:'MV-BAQ-001', proveedor:'METRO VIAS', ciudad:'Barranquilla', ubicacion:'Calle 45', formato:'Valla', medidas:'12 x 4', estado:'completo', tarifa_mensual_cop:9700000, latitud:null, longitud:null, datos_fuente:{disponibilidad_fuente:'No indicada',fecha_fuente:'2026-09-07'}},
    {codigo:'MV-BAQ-002', proveedor:'METRO VIAS', ciudad:'Barranquilla', estado:'duplicado_confirmado', datos_fuente:{}},
  ];
  const files = [{codigo:'MV-BAQ-001', tipo:'foto', sha256:'a'}, {codigo:'MV-BAQ-001', tipo:'ficha', sha256:'b'}];
  const sources = {aliados_vallas:rows, aliados_valla_archivos:files, aliados_disponibilidad_eventos:[], aliados_importacion_filas:[], aliados_catalogos:[]};
  const client = {
    from(table) {
      return { select() { return { range(start, end) { return Promise.resolve({ data: sources[table].slice(start, end + 1), error: null }); } }; } };
    },
  };
  const result = await catalogFromSupabase(client, {pageSize:1});
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].codigo, 'MV-BAQ-001');
  assert.equal(result.records[0].foto, true);
  assert.equal(result.records[0].ficha, true);
  assert.equal(result.records[0].fechaDisponibilidad, '2026-09-07');
  assert.equal(result.records[1].estadoFicha, 'duplicado_confirmado');
  assert.equal(result.pendingNew.length, 0);
});

test('las vallas antiguas con foto siguen listas después de eliminar su PowerPoint',()=>{
  const vallas = [{codigo:'OLD-CAL-001',estado:'completo',datos_fuente:{}}, {codigo:'OLD-CAL-002',estado:'completo',datos_fuente:{}}];
  const result = mapRemoteCatalog(vallas,[{codigo:'OLD-CAL-001',tipo:'foto'}, {codigo:'OLD-CAL-002',tipo:'ficha'}],[],[]);
  assert.equal(result.records[0].ficha,true);
  assert.equal(result.records[1].ficha,false);
});

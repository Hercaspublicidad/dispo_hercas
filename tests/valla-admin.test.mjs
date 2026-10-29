import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import JSZip from 'jszip';
import {validateValla} from '../lib/valla-admin.mjs';
import {prepareVallaPhoto} from '../lib/valla-photo.mjs';
import {hasCatalogAdminRole} from '../lib/catalog-permission.mjs';
import {mapRemoteCatalog} from '../lib/catalog-supabase.mjs';
import {buildIndividualFiche,buildProposal} from '../lib/proposal-cloud.mjs';

const input = {codigo:'TEST-BOG-001',proveedor:'Aliado',ciudad:'Bogotá',ubicacion:'Carrera 7',estado:'revision_fuente',tarifa_mensual_cop:'1250000',latitud:'',longitud:'',entorno:'exterior',tipo_soporte:'estatica'};

test('solo systems_admin activo tiene acceso al CRUD; gestionar disponibilidad no basta',async()=>{
  const client = roles => ({from:()=>({select(){return this;},eq(){return this;},is:async()=>({data:roles,error:null})})});
  assert.equal(await hasCatalogAdminRole(client([{role:'systems_admin'}]),'u'),true);
  for(const role of ['sales','availability_manager','pricing_manager','auditor','admin']) assert.equal(await hasCatalogAdminRole(client([{role}]),'u'),false);
  assert.equal(await hasCatalogAdminRole(client([]),'u'),false);
  await assert.rejects(hasCatalogAdminRole({from:()=>({select(){return this;},eq(){return this;},is:async()=>({error:new Error('denied')})})},'u'),/denied/);
});

test('validación conserva la procedencia y rechaza valores y campos no permitidos',()=>{
  const row = validateValla({...input,datos_fuente:{editado_por:'falso'},condiciones_comerciales:'+ IVA'}, {datos_fuente:{archivo_fuente_nombre:'original.pptx',archivado_en:null}});
  assert.equal(row.tarifa_mensual_cop,1250000);
  assert.equal(row.datos_fuente.archivo_fuente_nombre,'original.pptx');
  assert.equal(row.datos_fuente.editado_por,undefined);
  assert.equal(row.datos_fuente.gestion_admin,true);
  for(const change of [{codigo:'../foto'},{proveedor:''},{ciudad:''},{ubicacion:''},{tarifa_mensual_cop:-1},{tarifa_mensual_cop:Infinity},{tarifa_mensual_cop:true},{latitud:91,longitud:10},{latitud:5,longitud:''},{entorno:'inventado'},{estado:'publicado'}]) assert.throws(()=>validateValla({...input,...change}));
});

test('JPG, PNG y WebP se convierten a WebP y se rechazan archivos falsos y grandes',async()=>{
  for(const format of ['jpeg','png','webp']) {
    const source = await sharp({create:{width:320,height:180,channels:3,background:'#aabbcc'}})[format]().toBuffer();
    const result = await prepareVallaPhoto(source);
    const meta = await sharp(result).metadata();
    assert.equal(meta.format,'webp');assert.equal(meta.width,320);
  }
  await assert.rejects(prepareVallaPhoto(Buffer.from('no es imagen')));
  await assert.rejects(prepareVallaPhoto(Buffer.alloc(4*1024*1024+1)),/4 MB/);
  const source = await sharp({create:{width:3000,height:2000,channels:3,background:'#aabbcc'}}).png().toBuffer();
  const meta = await sharp(await prepareVallaPhoto(source)).metadata();
  assert.ok(meta.width<=2400&&meta.height<=1800);
});

test('vallas eliminadas salen del catálogo y las gestionadas con foto generan ficha',()=>{
  const rows = [{...validateValla(input),datos_fuente:{gestion_admin:true,condiciones_comerciales:'+ IVA'}},{...validateValla({...input,codigo:'TEST-BOG-002'}),datos_fuente:{archivado_en:'2026-10-29'}}];
  const catalog = mapRemoteCatalog(rows,[{codigo:input.codigo,tipo:'foto'}],[],[]);
  assert.equal(catalog.records.length,1);
  assert.equal(catalog.records[0].ficha,true);
  assert.equal(catalog.records[0].condicionesComerciales,'+ IVA');
});

test('ficha individual y propuesta incluyen los datos editados y una foto WebP',async()=>{
  const photo = await sharp({create:{width:320,height:180,channels:3,background:'#5588aa'}}).webp().toBuffer();
  const record = {codigo:'TEST-BOG-001',ciudad:'Ciudad editada',proveedor:'Aliado editado',ubicacion:'Dirección editada',formato:'Formato editado',medidas:'15 x 5',tarifa:1234567,condicionesComerciales:'IVA adicional; precio mensual.',foto:true,ficha:true};
  for(const [bytes,count] of [[await buildIndividualFiche(record,photo,{includePrices:true}),1],[await buildProposal([record],async()=>photo,{includePrices:true}),3]]) {
    const zip = await JSZip.loadAsync(bytes);
    const slides = Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
    assert.equal(slides.length,count);
    const xml = (await Promise.all(slides.map(name=>zip.file(name).async('string')))).join('');
    for(const text of ['Ciudad editada','Aliado editado','Dirección editada','Formato editado','15 x 5','1.234.567','IVA adicional; precio mensual.']) assert.ok(xml.includes(text),text);
  }
});

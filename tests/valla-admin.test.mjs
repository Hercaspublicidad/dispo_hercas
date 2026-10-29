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

test('estrato, iluminación y flujo se validan, conservan y muestran sin perder ceros',()=>{
  const saved=validateValla({...input,estrato:'3',iluminacion:' LED nocturna ',flujo_personas_vehiculos:'12500'});
  assert.equal(saved.datos_fuente.estrato,3);
  assert.equal(saved.datos_fuente.iluminacion,'LED nocturna');
  assert.equal(saved.datos_fuente.flujo_personas_vehiculos,12500);
  const edited=validateValla(input,saved);
  assert.equal(edited.datos_fuente.estrato,3);
  assert.equal(edited.datos_fuente.iluminacion,'LED nocturna');
  assert.equal(edited.datos_fuente.flujo_personas_vehiculos,12500);
  const cleared=validateValla({...input,estrato:'',iluminacion:'',flujo_personas_vehiculos:''},saved);
  assert.equal(cleared.datos_fuente.estrato,null);assert.equal(cleared.datos_fuente.flujo_personas_vehiculos,null);assert.equal(cleared.datos_fuente.iluminacion,'');
  for(const changes of [{estrato:'texto'},{estrato:-1},{estrato:true},{iluminacion:12},{iluminacion:'x'.repeat(151)},{flujo_personas_vehiculos:-1},{flujo_personas_vehiculos:Infinity},{flujo_personas_vehiculos:false}])assert.throws(()=>validateValla({...input,...changes}));
  const zero=validateValla({...input,estrato:0,flujo_personas_vehiculos:0});
  const record=mapRemoteCatalog([zero],[],[],[]).records[0];
  assert.equal(record.estrato,0);assert.equal(record.flujo_personas_vehiculos,0);
});

test('los nuevos datos aparecen en las fichas y propuestas incluso sin precio',async()=>{
  const photo=await sharp({create:{width:160,height:90,channels:3,background:'#abcde0'}}).webp().toBuffer();
  const record={codigo:input.codigo,ciudad:'Bogotá',proveedor:'Aliado',foto:true,ficha:true,estrato:3,iluminacion:'LED nocturna',flujo_personas_vehiculos:12500,tarifa:9999999};
  for(const bytes of [await buildIndividualFiche(record,photo),await buildProposal([record],async()=>photo)]) {
    const zip=await JSZip.loadAsync(bytes);
    const xml=(await Promise.all(Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).map(name=>zip.file(name).async('string')))).join('');
    for(const text of ['Estrato: 3','Iluminación: LED nocturna','Flujo personas / vehículos: 12.500'])assert.ok(xml.includes(text),text);
    assert.ok(!xml.includes('9.999.999'));
  }
});

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

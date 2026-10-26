import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {extractCatalogItems,matchCatalogItems} from '../lib/scan-catalog-cloud.mjs';

const records=[
  {codigo:'MV-CLO-001',codigoProveedor:'A-101',proveedor:'Aliado Uno',ciudad:'Cali',ubicacion:'Autopista sur con calle 30',estadoFicha:'completo'},
  {codigo:'MV-CLO-002',codigoProveedor:'A-102',proveedor:'Aliado Uno',ciudad:'Cali',ubicacion:'Autopista sur con calle 35',estadoFicha:'completo'},
];

test('PPTX semanal reconoce un código único y conserva un caso nuevo para revisión',async()=>{
  const zip=new JSZip();
  zip.file('ppt/slides/slide1.xml','<p:sld><a:t>MV-CLO-001</a:t><a:t>Disponible</a:t></p:sld>');
  zip.file('ppt/slides/slide2.xml','<p:sld><a:t>Nuevo soporte en Cali</a:t><a:t>Vacante</a:t></p:sld>');
  const items=await extractCatalogItems(await zip.generateAsync({type:'nodebuffer'}),'.pptx');
  const result=matchCatalogItems(items,records,'Aliado Uno',{fullSnapshot:true,extension:'.pptx'});
  assert.equal(result.scanned,2);
  assert.equal(result.proposals.length,2);
  assert.equal(result.proposals[0].matches[0].codigo,'MV-CLO-001');
  assert.equal(result.proposals[0].action,'actualizar');
  assert.equal(result.proposals[1].action,'nueva_o_revision');
});

test('Excel conserva coincidencia ambigua en revisión',async()=>{
  const workbook=new ExcelJS.Workbook(), sheet=workbook.addWorksheet('Disponibles');
  sheet.addRow(['Código','Ciudad','Ubicación','Disponibilidad']);
  sheet.addRow(['','Cali','Autopista sur con calle 30','Disponible']);
  const items=await extractCatalogItems(Buffer.from(await workbook.xlsx.writeBuffer()),'.xlsx');
  const result=matchCatalogItems(items,records,'Aliado Uno');
  assert.equal(result.proposals[0].action,'actualizar');
  const ambiguous=matchCatalogItems([{ref:'diapositiva 1',code:'',city:'Cali',address:'',status:'Disponible',text:'Autopista sur con calle 30. Autopista sur con calle 35'}],records,'Aliado Uno');
  assert.equal(ambiguous.proposals[0].action,'nueva_o_revision');
});

test('CSV nuevo queda sin aplicación automática',async()=>{
  const csv='Código,Ciudad,Ubicación,Disponibilidad\nX-77,Barranquilla,Vía 40 con calle 80,Disponible\n';
  const items=await extractCatalogItems(Buffer.from(csv),'.csv');
  const result=matchCatalogItems(items,records,'Aliado Uno');
  assert.equal(result.proposals[0].action,'nueva_o_revision');
  assert.equal(result.proposals[0].status,'Disponible');
});

test('No disponibles en una lista completa conserva estado negativo',()=>{
  const item={ref:'diapositiva 3',code:'MV-CLO-001',city:'',address:'',status:'',text:'MV-CLO-001 · NO DISPONIBLES'};
  const result=matchCatalogItems([item],records,'Aliado Uno',{fullSnapshot:true,extension:'.pptx'});
  assert.equal(result.proposals[0].status,'No disponible');
  assert.equal(matchCatalogItems([{...item,text:'MV-CLO-001 no se encuentra disponible'}],records,'Aliado Uno',{fullSnapshot:true,extension:'.pptx'}).proposals[0].status,'No disponible');
});

test('CSV respeta direcciones entre comillas con comas',async()=>{
  const csv='Código,Ciudad,Ubicación,Disponibilidad\nMV-CLO-001,Cali,"Autopista sur, con calle 30",Disponible\n';
  const items=await extractCatalogItems(Buffer.from(csv),'.csv');
  assert.equal(items[0].address,'Autopista sur, con calle 30');
});

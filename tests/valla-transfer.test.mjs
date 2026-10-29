import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {encodeTransferCsv,decodeTransferCsv,reviewTransferRows,validateTransferInput,makeExportGroups,safeTransferPath,TRANSFER_COLUMNS} from '../lib/valla-transfer.mjs';
import {buildTransferArchive,readTransferArchive,readZipEntry} from '../lib/valla-transfer-zip.mjs';

const row={codigo:'TEST-CAL-001',proveedor:'Aliado',ciudad:'Cali',ubicacion:'Carrera 7; esquina "azul"\nPiso 2',estado:'completo',tarifa_mensual_cop:2500000,latitud:-3.4,longitud:-76.5,datos_fuente:{codigo_proveedor:'EXT-201',archivo_fuente_nombre:'original.pptx',entorno:'exterior',tipo_soporte:'estatica'},actualizado_en:'2026-10-29T15:00:00Z'};

test('CSV exporta e importa los nuevos campos y los archivos antiguos no los borran',()=>{
  const previous={...row,datos_fuente:{...row.datos_fuente,estrato:4,iluminacion:'Sin iluminación',flujo_personas_vehiculos:0}};
  const snapshot=validateTransferInput({codigo:row.codigo},previous);
  const csv=encodeTransferCsv([{...snapshot,...snapshot.datos_fuente}]);
  const imported=validateTransferInput(decodeTransferCsv(csv)[0]);
  assert.equal(imported.datos_fuente.estrato,4);assert.equal(imported.datos_fuente.iluminacion,'Sin iluminación');assert.equal(imported.datos_fuente.flujo_personas_vehiculos,0);
  const legacy=decodeTransferCsv('codigo;ciudad\nTEST-CAL-001;Bogotá')[0];
  const updated=validateTransferInput(legacy,previous);
  assert.equal(updated.ciudad,'Bogotá');assert.equal(updated.datos_fuente.estrato,4);assert.equal(updated.datos_fuente.flujo_personas_vehiculos,0);
  const cleared=validateTransferInput({codigo:row.codigo,estrato:'',iluminacion:'',flujo_personas_vehiculos:''},previous);
  assert.equal(cleared.datos_fuente.estrato,null);assert.equal(cleared.datos_fuente.flujo_personas_vehiculos,null);
});

test('CSV editable conserva delimitadores, saltos, comillas, coordenadas y neutraliza fórmulas',()=>{
  const csv=encodeTransferCsv([{...row,ubicacion:row.ubicacion,codigo_proveedor:'=HYPERLINK("url")'}]);
  assert.ok(csv.includes("'=HYPERLINK"));
  const decoded=decodeTransferCsv(csv)[0];
  assert.equal(decoded.ubicacion,row.ubicacion);
  assert.equal(decoded.codigo_proveedor,'=HYPERLINK("url")');
  assert.equal(decoded.latitud,'-3.4');
  assert.deepEqual(Object.keys(decoded),TRANSFER_COLUMNS);
  assert.equal(decodeTransferCsv('codigo,proveedor,ciudad\r\nTEST-CAL-002,Aliado,Cali\r\n')[0].ciudad,'Cali');
  assert.equal(decodeTransferCsv('codigo;ciudad\n TEST-CAL-001 ;Cali')[0].codigo,'TEST-CAL-001');
  for(const invalid of ['codigo;codigo\nA;A','codigo;otra_columna\nA;B','codigo;ciudad\nA','codigo\n"sin cierre'])assert.throws(()=>decodeTransferCsv(invalid));
});

test('revisión exige seleccionar actualizaciones; detecta duplicados y archivadas',()=>{
  const items=reviewTransferRows([{...row,ciudad:'Bogotá'},{...row,codigo:'TEST-CAL-002'}],[row]);
  assert.equal(items[0].mode,'update');assert.equal(items[0].selected,false);assert.equal(items[0].expected,row.actualizado_en);
  assert.ok(items[0].changes.some(change=>change.campo==='ciudad' && change.antes==='Cali' && change.despues==='Bogotá'));
  assert.equal(items[1].mode,'create');assert.equal(items[1].selected,true);
  assert.ok(reviewTransferRows([row,row],[]).every(item=>item.error.includes('repetido') && !item.selected));
  assert.match(reviewTransferRows([row],[{...row,datos_fuente:{archivado_en:'2026-10-29'}}])[0].error,/eliminada/);
  assert.match(reviewTransferRows([row],[],[{...row,datos_fuente:{archivado_en:'2026-10-29'}}])[0].error,/eliminada/);
});

test('CSV parcial conserva campos ausentes y procedencia, vacíos borran y auditoría no se suplanta',()=>{
  const payload=validateTransferInput({codigo:row.codigo,ciudad:'Bogotá',medidas:''},row,{archivo_fuente_nombre:'importado.pptx',gestion_admin:false,editado_por:'falso',archivado_en:'falso'});
  assert.equal(payload.proveedor,row.proveedor);assert.equal(payload.ciudad,'Bogotá');assert.equal(payload.medidas,'');assert.equal(payload.tarifa_mensual_cop,row.tarifa_mensual_cop);
  assert.equal(payload.datos_fuente.codigo_proveedor,'EXT-201');assert.equal(payload.datos_fuente.archivo_fuente_nombre,'importado.pptx');
  assert.equal(payload.datos_fuente.editado_por,undefined);assert.equal(payload.datos_fuente.archivado_en,undefined);assert.equal(payload.datos_fuente.gestion_admin,true);
  assert.equal(validateTransferInput({...row,ubicacion:''}).ubicacion,'');
  assert.equal(validateTransferInput({codigo:'TEST-CAL-002',ciudad:'Cali',proveedor:'Aliado'},{},{codigo_proveedor:'EXTERNO-2'}).datos_fuente.codigo_proveedor,'EXTERNO-2');
  assert.throws(()=>validateTransferInput({...row,tarifa_mensual_cop:-1}));
});

test('exportación divide todos los registros y todas las versiones de imágenes en grupos',()=>{
  const rows=Array.from({length:4},(_,index)=>({...row,codigo:`TEST-CAL-00${index}`}));
  const files=rows.flatMap(record=>['foto','vista'].map(tipo=>({codigo:record.codigo,tipo,tamano_bytes:20,ruta:`${record.codigo}/${tipo}/a.png`})));
  const groups=makeExportGroups(rows,files,60);
  assert.equal(groups.length,4);assert.equal(groups.flatMap(group=>group.records).length,4);assert.equal(groups.flatMap(group=>group.files).length,8);
});

test('ZIP de exportación vuelve a importar datos, procedencia e imágenes con la foto actual al final',async()=>{
  const files=[{codigo:row.codigo,tipo:'foto',ruta:'TEST-CAL-001/foto/old.png',subido_en:'2026-10-01'},{codigo:row.codigo,tipo:'foto',ruta:'TEST-CAL-001/foto/current.webp',subido_en:'2026-10-29'},{codigo:row.codigo,tipo:'vista',ruta:'TEST-CAL-001/vista/preview.png',subido_en:'2026-10-10'}];
  const zip=await buildTransferArchive({records:[row],files},async image=>new Uint8Array(image.ruta.includes('current')?[1,2,3]:[4,5]));
  const imported=await readTransferArchive(zip);
  assert.equal(imported.rows.length,1);assert.equal(imported.rows[0].codigo_proveedor,'EXT-201');assert.equal(imported.rows[0].ubicacion,row.ubicacion);
  assert.equal(imported.metadata.records[0].datos_fuente.archivo_fuente_nombre,'original.pptx');
  assert.equal(imported.images.length,3);assert.deepEqual(Array.from(imported.images.at(-1).bytes),[1,2,3]);
  const reviewed=reviewTransferRows(imported.rows,[row],imported.metadata.records);
  assert.equal(reviewed[0].selected,false);assert.equal(reviewed[0].error,null);
});

test('ZIP rechaza rutas inseguras, imágenes faltantes y descompresión sobre el límite',async()=>{
  for(const path of ['../foto.png','/foto.png','C:/foto.png','imagenes\\foto.png'])assert.equal(safeTransferPath(path),false);
  const zip=new JSZip();zip.file('vallas.csv',encodeTransferCsv([{...row,foto:'imagenes/no-existe.png'}]));
  await assert.rejects(readTransferArchive(await zip.generateAsync({type:'uint8array'})),/Falta un archivo/);
  const small=new JSZip();small.file('grande.txt','a'.repeat(100));
  await assert.rejects(readZipEntry(small.file('grande.txt'),10),/supera/);
});

test('foto vacía conserva la actual aunque el manifiesto incluya imágenes históricas',async()=>{
  const zip=new JSZip();zip.file('vallas.csv',encodeTransferCsv([{...row,foto:''}]));zip.file('datos.json',JSON.stringify({version:1,records:[row],images:[{codigo:row.codigo,tipo:'foto',path:'imagenes/foto.png'}]}));zip.file('imagenes/foto.png',new Uint8Array([1]));
  assert.equal((await readTransferArchive(await zip.generateAsync({type:'uint8array'}))).images.length,0);
});

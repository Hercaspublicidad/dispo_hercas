'use client';
import {useEffect,useRef,useState} from 'react';
import {decodeTransferCsv,encodeTransferCsv,makeExportGroups,reviewTransferRows,transferInput} from '../../lib/valla-transfer.mjs';
import {downloadTransfer,postTransfer,prepareBrowserTransferImage} from '../../lib/valla-transfer-client';
import {fetchExportImage} from '../../lib/valla-export-client.mjs';

async function inventory() {
  const response=await fetch('/api/admin/transfer',{cache:'no-store'}), body=await response.json();
  if(!response.ok)throw new Error(body.error || 'No se pudo leer el inventario.');
  return body;
}

export default function AdminTransfer({onChanged}) {
  const [groups,setGroups]=useState([]), [review,setReview]=useState([]), [images,setImages]=useState([]);
  const [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [progress,setProgress]=useState(''), [completed,setCompleted]=useState([]);
  const [exporting,setExporting]=useState(false),[exportPercent,setExportPercent]=useState(0),[readyExport,setReadyExport]=useState(null);
  const exportController=useRef(null);
  const stopped=useRef(false), input=useRef(null), progressByCode=useRef(new Map());
  useEffect(()=>{
    const warn=event=>{if(busy){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[busy]);
  const prepareExport=async()=>{
    setBusy(true);setMessage('');setReadyExport(null);setProgress('Preparando exportación…');
    try {const data=await inventory();setGroups(makeExportGroups(data.records,data.files));setCompleted([]);setMessage(`${data.records.length} vallas y ${data.files.length} imágenes listas para exportar.`);}
    catch(error){setMessage(error.message);}finally{setBusy(false);setProgress('');}
  };
  const exportGroup=async(index)=>{
    setBusy(true);setExporting(true);setExportPercent(0);setReadyExport(null);setMessage('');setProgress(`Preparando imágenes del paquete ${index+1}…`);
    const controller=new AbortController();exportController.current=controller;
    try {
      const {buildTransferArchive}=await import('../../lib/valla-transfer-zip.mjs');
      const group=groups[index];
      const response=await fetch('/api/admin/transfer/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:group.records.map(row=>row.codigo)}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'No se pudieron preparar las imágenes.');
      const signed=new Map(body.images.map(image=>[image.ruta,image]));
      const received=new Map();let completedImages=0,lastReport=0;
      const reportImages=(force=false)=>{
        if(!force && Date.now()-lastReport<150)return;lastReport=Date.now();
        const size=[...received.values()].reduce((sum,value)=>sum+value,0);
        setExportPercent(group.bytes ? Math.min(90,size/group.bytes*90) : 0);
        setProgress(`Paquete ${index+1}: ${completedImages} de ${group.files.length} imágenes · ${(size/1024/1024).toFixed(1)} de ${(group.bytes/1024/1024).toFixed(1)} MB`);
      };
      const bytes=await buildTransferArchive(group,async image=>{
        const current=signed.get(image.ruta);
        if(!current)throw new Error(`Cambió la imagen de ${image.codigo}. Prepara de nuevo la exportación.`);
        return fetchExportImage({...image,signedUrl:current.signedUrl},{signal:controller.signal,onBytes:size=>{received.set(image.ruta,size);reportImages();}});
      },{signal:controller.signal,onProgress:state=>{
        if(state.phase==='images') {
          completedImages=state.completed;reportImages(true);
        } else {
          setExportPercent(90+state.percent/10);setProgress(`Armando ZIP del paquete ${index+1}: ${Math.round(state.percent)} %`);
        }
      }});
      const name=`HERCAS_vallas_${index+1}_de_${groups.length}.zip`;
      setReadyExport({bytes,name});downloadTransfer(bytes,name);setCompleted(old=>[...new Set([...old,index])]);
      setMessage(`Paquete ${index+1} listo. Si el navegador no inició la descarga, pulsa «Guardar ZIP preparado».`);
    }catch(error){controller.abort();setMessage(error.name==='AbortError'?'Exportación detenida. Puedes volver a intentar el paquete.':error.name==='TimeoutError'?'Supabase tardó demasiado en preparar las imágenes. Vuelve a intentarlo.':error.message);}finally{exportController.current=null;setExporting(false);setBusy(false);setProgress('');}
  };
  const template=async()=>{try{const {buildTransferTemplate}=await import('../../lib/valla-transfer-zip.mjs');downloadTransfer(await buildTransferTemplate(),'HERCAS_plantilla_importacion.zip');}catch(error){setMessage(error.message);}};
  const exportData=async()=>{
    setBusy(true);setMessage('');
    try{const {records}=await inventory();downloadTransfer(encodeTransferCsv(records.map(transferInput)),'HERCAS_vallas_datos.csv','text/csv;charset=utf-8');}
    catch(error){setMessage(error.message);}finally{setBusy(false);}
  };
  const inspect=async event=>{
    const file=event.target.files?.[0];if(!file)return;
    setBusy(true);setMessage('');setProgress('Leyendo archivo y revisando códigos…');setReview([]);setImages([]);progressByCode.current.clear();
    try {
      let imported;
      if(/\.csv$/i.test(file.name)) {
        if(file.size>2*1024*1024)throw new Error('El CSV supera 2 MB.');
        const rows=decodeTransferCsv(await file.text());
        if(rows.some(row=>row.foto))throw new Error('Para importar imágenes, incluye vallas.csv y las fotos dentro de un ZIP.');
        imported={rows,metadata:{records:[]},images:[]};
      } else if(/\.zip$/i.test(file.name)) {const {readTransferArchive}=await import('../../lib/valla-transfer-zip.mjs');imported=await readTransferArchive(file);}
      else throw new Error('Selecciona un ZIP de imágenes y datos o un CSV de datos.');
      const {records}=await inventory();
      setReview(reviewTransferRows(imported.rows,records,imported.metadata.records));setImages(imported.images);
      setMessage(`${imported.rows.length} filas y ${imported.images.length} imágenes revisadas. Las actualizaciones de códigos existentes están desmarcadas: revisa sus cambios y selecciónalas.`);
    }catch(error){setMessage(error.message);}finally{setBusy(false);setProgress('');event.target.value='';}
  };
  const update=(code,values)=>setReview(old=>old.map(row=>row.codigo===code?{...row,...values}:row));
  const apply=async()=>{
    const selected=review.filter(row=>row.selected&&!row.error&&row.status!=='done');if(!selected.length)return;
    setBusy(true);setMessage('');stopped.current=false;let success=0,failed=0;
    try {
      for(const [index,row] of selected.entries()) {
        if(stopped.current)break;
        setProgress(`Valla ${index+1} de ${selected.length}: ${row.codigo}`);
        const saved=progressByCode.current.get(row.codigo) || {record:null,images:new Set()};
        try {
          if(!saved.record) {
            const result=await postTransfer({action:'record',codigo:row.codigo,mode:row.mode,expected:row.expected,input:row.input,source:row.source});
            saved.record=result.record;progressByCode.current.set(row.codigo,saved);
          }
          const currentImages=images.filter(image=>image.codigo===row.codigo);
          for(const [i,image] of currentImages.entries()) {
            if(stopped.current)break;
            if(saved.images.has(i))continue;
            setProgress(`${row.codigo}: imagen ${i+1} de ${currentImages.length}`);
            const prepared=await prepareBrowserTransferImage(image);
            const result=await postTransfer({action:'image',codigo:row.codigo,tipo:image.tipo,expected:saved.record.actualizado_en},prepared);
            saved.record=result.record;saved.images.add(i);
          }
          if(stopped.current){update(row.codigo,{status:'partial',result:'Datos guardados; imágenes pendientes. Pulsa aplicar para continuar.'});break;}
          update(row.codigo,{status:'done',selected:false,result:'Importada correctamente'});success++;
        }catch(error){failed++;update(row.codigo,{status:'partial',result:(saved.record?'Datos guardados; ':'')+error.message});}
      }
      setMessage(`${success} vallas importadas. ${failed} con errores. ${stopped.current?'Importación detenida; se conservan las filas ya guardadas.':'Puedes corregir el archivo o reintentar las pendientes.'}`);
      await onChanged();
    }catch(error){setMessage(error.message);}finally{setBusy(false);setProgress('');}
  };
  return <section className="admin-transfer" aria-label="Importación y exportación masiva">
    <h2>Importar y exportar vallas</h2><p>Descarga los datos y todas las fotos y vistas previas. Para una carga masiva, prepara un ZIP con <strong>vallas.csv</strong> y las imágenes indicadas en la columna <strong>foto</strong>.</p>
    <div className="admin-transfer-actions"><button className="secondary" disabled={busy} onClick={prepareExport}>Preparar exportación completa</button><button className="secondary" disabled={busy} onClick={exportData}>Exportar solo datos CSV</button><button className="secondary" disabled={busy} onClick={template}>Plantilla de importación</button><button className="primary" disabled={busy} onClick={()=>input.current.click()}>Revisar importación</button><input ref={input} type="file" accept=".zip,.csv" hidden onChange={inspect}/></div>
    {(progress||message||readyExport)&&<div className="admin-transfer-progress" role="status" aria-live="polite">
      {progress&&<p>{progress}</p>}{exporting&&<><progress aria-label="Avance de exportación" max="100" value={exportPercent}/><button className="secondary" onClick={()=>exportController.current?.abort()}>Detener exportación</button></>}
      {message&&<p>{message}</p>}{readyExport&&!busy&&<button className="primary" onClick={()=>downloadTransfer(readyExport.bytes,readyExport.name)}>Guardar ZIP preparado</button>}
    </div>}
    <p className="admin-hint">ZIP hasta 120 MB. Imágenes JPG, PNG o WebP; se guardan en WebP. Las columnas presentes actualizan los datos; una celda vacía borra un campo opcional. Una foto vacía conserva la actual. La disponibilidad se gestiona desde los catálogos semanales.</p>
    {!!groups.length&&<div className="admin-transfer-packages"><p>Descarga cada paquete para completar la exportación. Cada ZIP contiene sus datos e imágenes y se puede importar por separado.</p>{groups.map((group,index)=><button className="secondary" disabled={busy} key={index} onClick={()=>exportGroup(index)}>{completed.includes(index)?'✓ ':''}Paquete {index+1} · {group.records.length} vallas · {(group.bytes/1024/1024).toFixed(1)} MB</button>)}</div>}
    {!!review.length&&<div className="admin-transfer-review"><h3>Revisar antes de aplicar</h3><p>Las nuevas vallas válidas están seleccionadas. Marca individualmente las existentes que deseas actualizar. No se eliminan vallas por faltar en el archivo.</p><div className="admin-transfer-actions"><button className="secondary" disabled={busy} onClick={()=>setReview(old=>old.map(row=>({...row,selected:row.mode==='create'&&!row.error&&row.status!=='done'})))}>Seleccionar solo nuevas</button><button className="secondary" disabled={busy} onClick={()=>setReview(old=>old.map(row=>({...row,selected:false})))}>Desmarcar todas</button></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Aplicar</th><th>Código</th><th>Acción</th><th>Cambios e imágenes</th><th>Resultado</th></tr></thead><tbody>{review.map((row,index)=><tr key={index}><td><input aria-label={'Importar '+row.codigo} type="checkbox" checked={!!row.selected} disabled={busy||!!row.error||row.status==='done'} onChange={event=>update(row.codigo,{selected:event.target.checked})}/></td><td>{row.codigo || 'Sin código'}</td><td>{row.mode==='create'?'Crear':row.mode==='update'?'Actualizar':'Corregir'}</td><td>{row.changes?.length>0&&<details><summary>{row.changes.length} campos</summary>{row.changes.map(change=><p key={change.campo}><b>{change.campo}</b>: {String(change.antes || 'Vacío')} → {String(change.despues || 'Vacío')}</p>)}</details>}<span>{images.filter(image=>image.codigo===row.codigo).length} imágenes</span>{row.source&&Object.keys(row.source).length>0&&<details><summary>Datos de origen</summary><pre>{JSON.stringify(row.source,null,2)}</pre></details>}</td><td>{row.error || row.result || (row.mode==='update'?'Requiere tu selección':'Lista para importar')}</td></tr>)}</tbody></table></div>
      <div className="admin-transfer-actions"><button className="primary" disabled={busy||!review.some(row=>row.selected&&!row.error&&row.status!=='done')} onClick={apply}>Aplicar {review.filter(row=>row.selected&&!row.error&&row.status!=='done').length} vallas seleccionadas</button>{busy&&<button className="secondary" onClick={()=>{stopped.current=true;}}>Detener después de la operación actual</button>}</div>
    </div>}
  </section>;
}

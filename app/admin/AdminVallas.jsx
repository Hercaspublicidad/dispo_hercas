'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import {PHOTO_LIMIT} from '../../lib/valla-admin.mjs';
import {mediaKind} from '../../lib/media-kind.mjs';

const blank = {codigo:'',proveedor:'',ciudad:'',ubicacion:'',formato:'',categoria:'',medidas:'',tarifa_mensual_cop:'',latitud:'',longitud:'',estado:'revision_fuente',entorno:'exterior',tipo_soporte:'estatica',codigo_proveedor:'',observacion_calidad:'',condiciones_comerciales:''};
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const money = value => value == null || value === '' ? 'Por confirmar' : '$ ' + new Intl.NumberFormat('es-CO').format(value);
const status = value => ({completo:'Completo',revision_fuente:'Revisar fuente',duplicado_confirmado:'Duplicado'}[value]);
const fields = [
  ['codigo','Código HERCAS','text',true,80],['codigo_proveedor','Código del aliado','text',false,150],
  ['proveedor','Aliado / proveedor','text',true,150],['ciudad','Ciudad','text',true,150],
  ['ubicacion','Dirección / ubicación','text',true,600],['formato','Formato','text',false,150],
  ['categoria','Categoría','text',false,150],['medidas','Medidas','text',false,150],
  ['tarifa_mensual_cop','Tarifa mensual de referencia (COP)','number'],
  ['latitud','Latitud','number'],['longitud','Longitud','number'],
];
const toForm = row => {
  const kind = mediaKind({categoria:row.categoria,formato:row.formato,entorno:row.datos_fuente?.entorno,tipoSoporte:row.datos_fuente?.tipo_soporte});
  return {...blank,...Object.fromEntries(Object.keys(blank).map(key=>[key,row[key] ?? row.datos_fuente?.[key] ?? blank[key]])),entorno:kind.entorno,tipo_soporte:kind.soporte,actualizado_en:row.actualizado_en};
};

async function responseJson(response) {
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

export default function AdminVallas() {
  const [rows,setRows] = useState([]),[loading,setLoading] = useState(true),[error,setError] = useState(''),[notice,setNotice] = useState('');
  const [query,setQuery] = useState(''),[scope,setScope] = useState('activas'),[page,setPage] = useState(1);
  const [editing,setEditing] = useState(null),[form,setForm] = useState(blank),[photo,setPhoto] = useState(null),[preview,setPreview] = useState('');
  const [saving,setSaving] = useState(false),[dirty,setDirty] = useState(false),[confirmArchive,setConfirmArchive] = useState(null),[confirmDiscard,setConfirmDiscard] = useState(false);
  const fileInput = useRef(null), editorRef = useRef(null), opener = useRef(null);
  const refresh = async () => {
    const body = await responseJson(await fetch('/api/admin/vallas',{cache:'no-store'}));
    setRows(body.records);
    return body.records;
  };
  useEffect(()=>{refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  useEffect(()=>{
    if (!photo) {setPreview(''); return;}
    const url = URL.createObjectURL(photo); setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[photo]);
  useEffect(()=>{
    if (editing === null) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    editorRef.current?.focus();
    return ()=>{document.body.style.overflow=old; opener.current?.focus();};
  },[editing]);
  useEffect(()=>{
    const handler = event => {if(dirty){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',handler);
    return ()=>window.removeEventListener('beforeunload',handler);
  },[dirty]);
  const filtered = useMemo(()=>rows.filter(row=>{
    const archived = !!row.datos_fuente?.archivado_en;
    return (scope === 'todas' || (scope === 'eliminadas' ? archived : !archived)) && normalize([row.codigo,row.proveedor,row.ciudad,row.ubicacion].join(' ')).includes(normalize(query));
  }),[rows,query,scope]);
  const pages = Math.max(1,Math.ceil(filtered.length/25)), currentPage = Math.min(page,pages);
  const visible = filtered.slice((currentPage-1)*25,currentPage*25);
  const selected = rows.find(row=>row.codigo===editing);
  const open = row => {
    opener.current = document.activeElement;
    setEditing(row?.codigo || '');setForm(row ? toForm(row) : {...blank});setPhoto(null);setError('');setDirty(false);
  };
  const close = () => {if(saving)return;if(dirty){setConfirmDiscard(true);return;}setEditing(null);setPhoto(null);};
  const change = (key,value) => {setForm(old=>({...old,[key]:value}));setDirty(true);};
  const choosePhoto = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > PHOTO_LIMIT || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError('Selecciona una foto JPG, PNG o WebP de hasta 4 MB.');event.target.value='';return;
    }
    setPhoto(file);setDirty(true);setError('');
  };
  const save = async event => {
    event.preventDefault();setSaving(true);setError('');setNotice('');
    try {
      const body = new FormData();body.append('datos',JSON.stringify(form));if(photo)body.append('foto',photo);
      await responseJson(await fetch(editing ? '/api/admin/vallas/'+encodeURIComponent(editing) : '/api/admin/vallas',{method:editing?'PATCH':'POST',body}));
      setDirty(false);setEditing(null);setPhoto(null);setNotice('Valla guardada. Las nuevas presentaciones y fichas usarán estos datos y su foto actual.');
      try {await refresh();} catch {setError('La valla se guardó, pero la lista no se pudo actualizar. Pulsa Recargar.');}
    } catch(e) {setError(e.message);} finally {setSaving(false);}
  };
  const archive = async () => {
    if(!confirmArchive)return;
    setSaving(true);setError('');setNotice('');
    const restoring = !!confirmArchive.datos_fuente?.archivado_en;
    try {
      await responseJson(await fetch('/api/admin/vallas/'+encodeURIComponent(confirmArchive.codigo),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({actualizado_en:confirmArchive.actualizado_en,restaurar:restoring})}));
      setConfirmArchive(null);setNotice(restoring?'Valla restaurada en el catálogo.':'Valla eliminada del catálogo. Puedes recuperarla en Eliminadas.');
      try {await refresh();} catch {setError('El cambio se guardó, pero la lista no se pudo actualizar. Pulsa Recargar.');}
    } catch(e) {setError(e.message);} finally {setSaving(false);}
  };
  const trapFocus = event => {
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key!=='Tab')return;
    const nodes = [...editorRef.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  const image = preview || (selected?.foto ? `/api/asset/${selected.codigo}/foto?v=${encodeURIComponent(selected.foto_version || '')}` : '');
  return <div className="shell admin-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">H</div><div><strong>HERCAS</strong><small>MEDIOS EXTERIORES</small></div></div><div className="nav-label">ESPACIO DE TRABAJO</div><a className="nav" href="/">▦ <span>Explorar medios</span></a><a className="nav active" href="/admin" aria-current="page">⚙ <span>Administrar vallas</span></a><div className="side-bottom">Administrador de plataforma<br/><small>Gestión de inventario y fotografías</small></div></aside>
    <main className="main admin-main">
      <header className="top"><div><div className="eyebrow">ADMINISTRACIÓN</div><h1>Gestión de vallas</h1><p>Actualiza la información y las fotos que tu equipo utiliza en sus propuestas.</p></div><button className="primary" onClick={()=>open(null)}>+ Crear valla</button></header>
      <section className="admin-metrics" aria-label="Resumen del inventario"><div><strong>{rows.filter(r=>!r.datos_fuente?.archivado_en).length}</strong><span>En inventario</span></div><div><strong>{rows.filter(r=>!r.datos_fuente?.archivado_en&&r.foto).length}</strong><span>Con fotografía</span></div><div><strong>{rows.filter(r=>!r.datos_fuente?.archivado_en&&!r.foto).length}</strong><span>Sin fotografía</span></div></section>
      {notice&&<div className="admin-success" role="status">{notice}<button aria-label="Cerrar mensaje" onClick={()=>setNotice('')}>×</button></div>}
      {error&&<div className="admin-error" role="alert">{error}</div>}
      <div className="admin-toolbar"><label className="admin-search">Buscar vallas<input type="search" value={query} placeholder="Código, aliado, ciudad o dirección" onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><label>Mostrar<select value={scope} onChange={e=>{setScope(e.target.value);setPage(1);}}><option value="activas">En inventario</option><option value="eliminadas">Eliminadas</option><option value="todas">Todas</option></select></label><button className="secondary" onClick={()=>{setLoading(true);setError('');refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));}} disabled={loading}>Recargar</button></div>
      <section className="admin-table-wrap" aria-label="Listado de vallas" aria-busy={loading}>
        {loading?<div className="admin-empty" role="status">Cargando inventario…</div>:<><table className="admin-table"><thead><tr><th>Medio</th><th>Ubicación</th><th>Formato y tarifa</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{visible.map(row=><tr key={row.codigo}><td><div className="admin-media">{row.foto?<img loading="lazy" src={`/api/asset/${row.codigo}/foto?v=${encodeURIComponent(row.foto_version || '')}`} alt=""/>:<div className="admin-thumb-empty">Sin foto</div>}<div><strong>{row.codigo}</strong><small>{row.proveedor}</small></div></div></td><td><strong>{row.ciudad}</strong><small className="admin-address">{row.ubicacion || 'Ubicación por confirmar'}</small></td><td><strong>{row.formato || 'Por confirmar'}</strong><small>{money(row.tarifa_mensual_cop)}</small></td><td><span className={'admin-state '+(row.datos_fuente?.archivado_en?'archived':row.estado)}>{row.datos_fuente?.archivado_en?'Eliminada':status(row.estado)}</span></td><td><div className="admin-row-actions">{!row.datos_fuente?.archivado_en&&<button className="secondary" aria-label={'Editar '+row.codigo} onClick={()=>open(row)}>Editar</button>}<button className={row.datos_fuente?.archivado_en?'secondary':'admin-delete'} aria-label={(row.datos_fuente?.archivado_en?'Restaurar ':'Eliminar ')+row.codigo} onClick={()=>{setConfirmArchive(row);setError('');}}>{row.datos_fuente?.archivado_en?'Restaurar':'Eliminar'}</button></div></td></tr>)}</tbody></table>{visible.length===0&&<div className="admin-empty">{scope==='eliminadas'?'No hay vallas eliminadas para esta búsqueda.':'No hay vallas que coincidan con tu búsqueda.'}</div>}</>}
      </section><footer className="admin-pagination"><span>{filtered.length} resultados · Página {currentPage} de {pages}</span><div><button className="secondary" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>Anterior</button><button className="secondary" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>Siguiente</button></div></footer>
    </main>
    {editing!==null&&<div className="admin-overlay"><section className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title" tabIndex={-1} ref={editorRef} onKeyDown={trapFocus}>
      <header className="admin-editor-head"><div><div className="eyebrow">INFORMACIÓN DEL MEDIO</div><h2 id="editor-title">{editing?'Editar '+editing:'Crear valla'}</h2></div><button className="secondary" aria-label="Cerrar editor" onClick={close} disabled={saving}>×</button></header>
      <form onSubmit={save}><div className="admin-editor-body"><fieldset disabled={saving} className="admin-fieldset"><div className="admin-edit-columns"><div>
        <h3>Fotografía</h3><div className="admin-photo-preview">{image?<img src={image} alt="Foto seleccionada de la valla"/>:<span>Añade la fotografía del medio</span>}</div>
        <label className="admin-photo-label">{image?'Cambiar foto':'Seleccionar foto'}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/></label><p className="admin-hint">JPG, PNG o WebP · hasta 4 MB. La foto se guardará en WebP.</p>{photo&&<button type="button" className="secondary" onClick={()=>{setPhoto(null);if(fileInput.current)fileInput.current.value='';}}>Quitar foto seleccionada</button>}
        <div className="admin-help"><strong>Así se actualizan las presentaciones</strong><p>Al guardar, las nuevas propuestas y la ficha individual usarán la información y la foto actual. Los archivos descargados anteriormente conservan su contenido.</p>{selected?.foto&&<a className="secondary" target="_blank" rel="noreferrer" href={`/api/asset/${selected.codigo}/ficha`}>Descargar ficha guardada</a>}</div>
      </div><div><h3>Datos comerciales</h3><div className="admin-fields">{fields.map(([key,label,type,required,maxLength])=><label key={key} className={key==='ubicacion'?'admin-wide':''}>{label}{required?' *':''}<input name={key} type={type} required={required} maxLength={maxLength} value={form[key]} readOnly={key==='codigo'&&!!editing} onChange={e=>change(key,e.target.value)} step={type==='number'?'any':undefined} min={key==='tarifa_mensual_cop'?0:key==='latitud'?-90:key==='longitud'?-180:undefined} max={key==='tarifa_mensual_cop'?1e12:key==='latitud'?90:key==='longitud'?180:undefined} placeholder={key==='codigo'?'MV-BAQ-001':undefined}/></label>)}
        <label>Estado de revisión<select value={form.estado} onChange={e=>change('estado',e.target.value)}><option value="revision_fuente">Revisar fuente</option><option value="completo">Completo</option><option value="duplicado_confirmado">Duplicado confirmado</option></select></label>
        <label>Entorno<select value={form.entorno} onChange={e=>change('entorno',e.target.value)}><option value="">Por confirmar</option><option value="exterior">Vía pública</option><option value="aeropuerto">Aeropuerto</option><option value="centro_comercial">Centro comercial</option></select></label>
        <label>Tipo de soporte<select value={form.tipo_soporte} onChange={e=>change('tipo_soporte',e.target.value)}><option value="">Por confirmar</option><option value="estatica">Valla estática</option><option value="led">Pantalla LED</option></select></label>
        <label className="admin-wide">Condiciones comerciales en la presentación<textarea rows={3} maxLength={300} value={form.condiciones_comerciales} placeholder="Ej.: + IVA / mes. Confirmar disponibilidad y condiciones." onChange={e=>change('condiciones_comerciales',e.target.value)}/></label>
        <label className="admin-wide">Observaciones de revisión<textarea rows={3} maxLength={1500} value={form.observacion_calidad} onChange={e=>change('observacion_calidad',e.target.value)}/></label>
        </div><p className="admin-hint">* Campos obligatorios. La disponibilidad se actualiza desde el catálogo semanal.</p></div></div></fieldset></div>
        <footer className="admin-editor-footer">{error&&<p role="alert">{error}</p>}<div><button type="button" className="secondary" onClick={close} disabled={saving}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving?'Guardando…':editing?'Guardar cambios':'Crear valla'}</button></div></footer>
      </form></section></div>}
    {confirmDiscard&&<Confirm title="¿Descartar los cambios?" busy={saving} onCancel={()=>setConfirmDiscard(false)} onConfirm={()=>{setConfirmDiscard(false);setDirty(false);setEditing(null);setPhoto(null);}} action="Descartar"><p>Los cambios que hiciste en este formulario aún no se han guardado.</p></Confirm>}
    {confirmArchive&&<Confirm title={(confirmArchive.datos_fuente?.archivado_en?'Restaurar ':'Eliminar ')+confirmArchive.codigo} busy={saving} onCancel={()=>setConfirmArchive(null)} onConfirm={archive} action={confirmArchive.datos_fuente?.archivado_en?'Restaurar valla':'Eliminar del catálogo'}><p>{confirmArchive.datos_fuente?.archivado_en?'La valla volverá a aparecer en el catálogo con sus datos y archivos.':'La valla dejará de aparecer en el catálogo y en nuevas propuestas. Sus fotos e historial se conservan y podrás restaurarla desde Eliminadas.'}</p>{error&&<p className="admin-error" role="alert">{error}</p>}</Confirm>}
  </div>;
}

function Confirm({title,children,busy,onCancel,onConfirm,action}) {
  const ref=useRef(null);
  useEffect(()=>{const previous=document.activeElement;ref.current?.focus();return()=>previous?.focus();},[]);
  return <div className="admin-confirm-overlay"><section className="admin-confirm" role="alertdialog" aria-modal="true" aria-label={title} onKeyDown={e=>{
    if(e.key==='Escape'&&!busy)onCancel();
    if(e.key==='Tab'){const nodes=[...e.currentTarget.querySelectorAll('button:not(:disabled)')];if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}
  }}><h2>{title}</h2>{children}<div><button ref={ref} className="secondary" onClick={onCancel} disabled={busy}>Cancelar</button><button className="primary" onClick={onConfirm} disabled={busy}>{busy?'Guardando…':action}</button></div></section></div>;
}

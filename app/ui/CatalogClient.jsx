'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase';
const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const money = n => n ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n) : 'Por confirmar';
function isRecent(date) { const time = Date.parse(date || ''); return Number.isFinite(time) && Date.now() - time < 14*86400000; }
function statusLabel(r) {
  if (r.estadoFicha === 'revision_fuente') return 'Revisar fuente';
  if (r.estadoFicha === 'duplicado_confirmado') return 'Duplicado';
  if (!isRecent(r.fechaDisponibilidad)) return 'Por confirmar';
  if (/no disponible/i.test(r.disponibilidad)) return 'No disponible';
  if (/disponible/i.test(r.disponibilidad)) return 'Disponible*';
  return 'Por confirmar';
}
const canSelect = r => r.ficha && r.estadoFicha === 'completo' && statusLabel(r) !== 'No disponible';
function MapPanel({ records, onPick }) {
  const node = useRef(null), map = useRef(null), layer = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!active || !node.current || map.current) return;
      const m = L.map(node.current, { zoomControl: true }).setView([4.7, -74.1], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
      map.current = m; layer.current = L.layerGroup().addTo(m); setReady(true);
    })();
    return () => { active = false; if (map.current) { map.current.remove(); map.current = null; } };
  }, []);
  useEffect(() => {
    (async () => {
      if (!map.current || !layer.current) return;
      const L = (await import('leaflet')).default;
      layer.current.clearLayers();
      const exact = records.filter(r => r.lat !== null && r.lon !== null && r.estadoFicha === 'completo');
      const bounds = [];
      for (const r of exact) {
        const color = /no disponible/i.test(r.disponibilidad) ? '#ac6873' : '#e5b85c';
        const marker = L.circleMarker([r.lat, r.lon], { radius: 8, weight: 2, color: '#ffffff', fillColor: color, fillOpacity: .95 }).addTo(layer.current);
        marker.bindTooltip(r.codigo + ' · ' + r.ciudad);
        marker.on('click', () => onPick(r.codigo));
        bounds.push([r.lat, r.lon]);
      }
      if (bounds.length) map.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
    })();
  }, [records, onPick, ready]);
  return <div className="map-wrap"><div ref={node} className="map" /><div className="map-note">{records.filter(r => r.lat !== null && r.lon !== null && r.estadoFicha === 'completo').length} puntos con coordenada exacta de esta selección. Las demás vallas se buscan por ciudad y dirección.</div></div>;
}
export default function CatalogClient({ initial }) {
  const [data, setData] = useState(initial), [query, setQuery] = useState(''), [city, setCity] = useState(''), [provider, setProvider] = useState(''), [view, setView] = useState('grid'), [tab, setTab] = useState('catalogo'), [selected, setSelected] = useState(null), [file, setFile] = useState(null), [uploading, setUploading] = useState(false), [result, setResult] = useState(null), [notice, setNotice] = useState(''), [basket, setBasket] = useState([]), [downloading, setDownloading] = useState(false);
  const records = data.records.filter(r => r.estadoFicha !== 'duplicado_confirmado');
  const cities = [...new Set(records.map(r => r.ciudad).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
  const providers = [...new Set(records.map(r => r.proveedor).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
  const filtered = useMemo(() => records.filter(r => (!city || r.ciudad === city) && (!provider || r.proveedor === provider) && (!query || norm([r.codigo,r.ciudad,r.proveedor,r.ubicacion,r.formato].join(' ')).includes(norm(query)))), [records,query,city,provider]);
  const detail = records.find(r => r.codigo === selected);
  const selectedSet = new Set(basket);
  const toggleBasket = code => setBasket(current => current.includes(code) ? current.filter(x => x !== code) : [...current, code]);
  const selectFiltered = () => setBasket(current => [...new Set([...current, ...filtered.filter(canSelect).map(r => r.codigo)])]);
  const downloadProposal = async () => {
    if (!basket.length) return;
    setDownloading(true); setNotice('');
    try {
      const response = await fetch('/api/proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codes: basket }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'No se pudo crear la presentación.'); }
      const blob = await response.blob(), url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Vallas_disponibles_HERCAS_' + new Date().toISOString().slice(0,10) + '.pptx';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setNotice(error.message || 'No se pudo descargar.'); }
    finally { setDownloading(false); }
  };
  const refresh = async () => { const response = await fetch('/api/catalog', { cache: 'no-store' }); if (response.ok) setData(await response.json()); };
  const submit = async e => {
    e.preventDefault(); if (!file || !provider) return setNotice('Selecciona proveedor y archivo.');
    setUploading(true); setNotice(''); setResult(null);
    const body = new FormData(); body.set('file',file); body.set('provider',provider);
    try { const r = await fetch('/api/import',{method:'POST',body}); const j = await r.json(); if (!r.ok) throw new Error(j.error); setResult(j); setTab('actualizar'); }
    catch(err) { setNotice(err.message || 'No se pudo analizar el archivo.'); }
    finally { setUploading(false); }
  };
  const apply = async () => {
    const r = await fetch('/api/import/apply', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stageId:result.stageId}) });
    const j = await r.json(); if (!r.ok) return setNotice(j.error || 'No se pudo aplicar.');
    setNotice('Cambios aplicados: ' + j.updated + '. Casos para revisión: ' + j.review + '.'); await refresh();
  };
  const signOut = async () => {
    const { error } = await supabaseBrowser().auth.signOut({ scope: 'local' });
    if (error) return setNotice('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    window.location.replace('/login');
  };
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">H</div><div><strong>HERCAS</strong><small>MEDIOS EXTERIORES</small></div></div><div className="nav-label">ESPACIO DE TRABAJO</div><button className={'nav '+(tab==='catalogo'?'active':'')} onClick={()=>setTab('catalogo')}>▦ <span>Explorar vallas</span></button><button className={'nav '+(tab==='actualizar'?'active':'')} onClick={()=>setTab('actualizar')}>↻ <span>Actualizar catálogo</span></button><div className="side-bottom"><button className="sign-out" onClick={signOut}>Cerrar sesión</button><span className="live-dot" /> Inventario local · 2026<br/><small>Datos guardados en D:\Aliados exteriores</small></div></aside>
    <main className="main">
      <header className="top"><div><div className="eyebrow">CATÁLOGO COMERCIAL</div><h1>{tab==='catalogo'?'Encuentra la valla indicada':'Actualización de aliados'}</h1><p>{tab==='catalogo'?'Busca por ciudad, dirección o código y abre la ficha lista para propuesta.':'Carga el archivo semanal y revisa las coincidencias antes de cambiar disponibilidades.'}</p></div><div className="top-chip">HERCAS · Inventario de aliados</div></header>
      {tab==='catalogo' ? <>
        <section className="metrics"><div><strong>{records.length}</strong><span>vallas en inventario</span></div><div><strong>{records.filter(r=>r.estadoFicha==='completo').length}</strong><span>fichas listas</span></div><div><strong>{cities.length}</strong><span>zonas registradas</span></div><div><strong>{records.filter(r=>r.lat!==null&&r.lon!==null).length}</strong><span>ubicaciones en mapa</span></div></section>
        <section className="filters"><div className="search"><span>⌕</span><input aria-label="Buscar vallas" placeholder="Buscar código, dirección, formato..." value={query} onChange={e=>setQuery(e.target.value)}/></div><select aria-label="Ciudad" value={city} onChange={e=>setCity(e.target.value)}><option value="">Todas las ciudades</option>{cities.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Proveedor" value={provider} onChange={e=>setProvider(e.target.value)}><option value="">Todos los aliados</option>{providers.map(p=><option key={p}>{p}</option>)}</select></section>
        <section className="result-head"><div><strong>{filtered.length} resultados</strong><span> · marca las vallas para armar una presentación</span></div><div className="result-actions"><button className="select-all" onClick={selectFiltered}>Seleccionar resultados</button><div className="switch"><button className={view==='grid'?'chosen':''} onClick={()=>setView('grid')}>Cuadrícula</button><button className={view==='map'?'chosen':''} onClick={()=>setView('map')}>Mapa</button></div></div></section>
        {view==='map' ? <MapPanel records={filtered} onPick={setSelected}/> : <section className="cards">{filtered.slice(0,120).map(r=><article className="card" key={r.codigo}><button className="card-open" onClick={()=>setSelected(r.codigo)}><div className="card-image">{r.foto?<img src={'/api/asset/'+r.codigo+'/foto'} alt={'Valla '+r.codigo}/>:<div className="no-image">FOTO EN REVISIÓN</div>}<span className={'badge '+(statusLabel(r)==='Disponible*'?'good':statusLabel(r)==='No disponible'?'bad':'neutral')}>{statusLabel(r)}</span></div><div className="card-body"><div className="card-code">{r.codigo}<span>↗</span></div><h3>{r.ubicacion || 'Ubicación por confirmar'}</h3><p>{r.ciudad} · {r.proveedor}</p><div className="card-foot"><span>{r.medidas || r.formato}</span><strong>Ver ficha →</strong></div></div></button><label className="card-select"><input type="checkbox" aria-label={"Seleccionar " + r.codigo} checked={selectedSet.has(r.codigo)} disabled={!canSelect(r)} onChange={()=>toggleBasket(r.codigo)}/><span>Seleccionar</span></label></article>)}</section>}
        {view==='grid' && filtered.length>120 && <p className="limit-note">Mostrando los primeros 120. Usa ciudad, aliado o búsqueda para acotar.</p>}
        {filtered.length===0 && <div className="empty">No hay vallas para esta búsqueda.</div>}{basket.length>0&&<div className="basket-bar"><div><strong>{basket.length} valla{basket.length===1?"":"s"} seleccionada{basket.length===1?"":"s"}</strong><span>PowerPoint con portada y separadores por ciudad</span></div><button className="basket-clear" onClick={()=>setBasket([])}>Limpiar</button><button className="primary" onClick={downloadProposal} disabled={downloading}>{downloading?"Preparando presentación…":"Descargar PowerPoint"}</button></div>}
      </> : <section className="import-layout"><div className="upload-panel"><div className="section-kicker">01 / NUEVO ARCHIVO</div><h2>Revisar disponibilidad semanal</h2><p>Admite Excel, CSV, PowerPoint y PDF con texto. El sistema compara códigos y direcciones del mismo aliado; los casos ambiguos quedan para revisión.</p><form onSubmit={submit}><label>Aliado<select value={provider} onChange={e=>setProvider(e.target.value)} required><option value="">Selecciona un aliado</option>{providers.map(p=><option key={p}>{p}</option>)}</select></label><label>Catálogo recibido<input type="file" accept=".xlsx,.csv,.pptx,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)} required/></label><button className="primary" disabled={uploading}>{uploading?'Analizando…':'Analizar archivo'}</button></form><div className="help">Los cambios no se aplican hasta pulsar “Aplicar coincidencias seguras”. Las vallas nuevas pasan a una cola de producción.</div><div className="queue-summary"><strong>{data.pendingNew.length}</strong> casos en cola de revisión</div></div><div className="results-panel"><div className="section-kicker">02 / RESULTADOS</div><h2>{result?'Comparación del catálogo':'Esperando archivo'}</h2>{result?<><div className="import-stats"><div><strong>{result.scanned}</strong><span>entradas leídas</span></div><div><strong>{result.proposals.filter(x=>x.action==='actualizar').length}</strong><span>coincidencias seguras</span></div><div><strong>{result.proposals.filter(x=>x.action!=='actualizar').length}</strong><span>por revisar</span></div></div><div className="proposal-list">{result.proposals.slice(0,80).map((x,i)=><div className="proposal" key={i}><div><b>{x.matches[0]?.codigo || x.code || 'Posible valla nueva'}</b><small>{x.ref} · {x.status || 'Disponibilidad no indicada'}</small></div><span className={x.action==='actualizar'?'pill-ok':'pill-review'}>{x.action==='actualizar'?'Coincidencia segura':'Revisar'}</span></div>)}</div><button className="primary" onClick={apply} disabled={!result.proposals.some(x=>x.action==='actualizar')}>Aplicar coincidencias seguras</button><p className="small">Archivo original: {result.file}</p></>:<div className="placeholder">Las diferencias aparecerán aquí con el código de la valla y su origen.</div>}</div></section>}
      {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    </main>
    {detail&&<div className="overlay" onClick={()=>setSelected(null)}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)} aria-label="Cerrar">×</button><div className="drawer-image">{detail.foto?<img src={'/api/asset/'+detail.codigo+'/foto'} alt={'Foto HERCAS '+detail.codigo}/>:<div className="no-image">FOTO EN REVISIÓN</div>}</div><div className="drawer-content"><div className="section-kicker">{detail.proveedor} · {detail.ciudad}</div><h2>{detail.codigo}</h2><h3>{detail.ubicacion}</h3><span className={'badge-inline '+(statusLabel(detail)==='Disponible*'?'good':'')}>{statusLabel(detail)}</span><div className="details"><div><span>Formato</span><strong>{detail.formato}</strong></div><div><span>Medidas</span><strong>{detail.medidas||'Por confirmar'}</strong></div><div><span>Tarifa de referencia</span><strong>{money(detail.tarifa)}</strong></div><div><span>Última fecha fuente</span><strong>{detail.fechaDisponibilidad||'No indicada'}</strong></div></div><p className="caution">*Disponibilidad según el último archivo recibido; confirma antes de ofrecer. El precio de la ficha PowerPoint permanece editable.</p><div className="drawer-actions">{canSelect(detail)&&<button className="primary" onClick={()=>toggleBasket(detail.codigo)}>{selectedSet.has(detail.codigo)?"Quitar de selección":"Añadir a selección"}</button>}{detail.ficha&&<a className="secondary" href={'/api/asset/'+detail.codigo+'/ficha'}>Descargar ficha individual</a>}{detail.foto&&<a className="secondary" href={'/api/asset/'+detail.codigo+'/foto'} target="_blank">Abrir foto</a>}{detail.lat!==null&&detail.lon!==null&&<a className="secondary" href={'https://www.openstreetmap.org/?mlat='+detail.lat+'&mlon='+detail.lon+'#map=17/'+detail.lat+'/'+detail.lon} target="_blank" rel="noreferrer">Ver ubicación</a>}</div>{detail.estadoFicha==='revision_fuente'&&<p className="review-box">{detail.revision}</p>}</div></aside></div>}
  </div>;
}

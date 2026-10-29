'use client';
import {matchesCatalogSearch} from '../../lib/catalog-search.mjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase';
import { availabilityState, canSelectForProposal } from '../../lib/availability.mjs';
import { displayRecords } from '../../lib/catalog-display.mjs';
import { mapLocations } from '../../lib/map-locations.mjs';
import { mediaKind, markerKind } from '../../lib/media-kind.mjs';
const money = n => n ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n) : 'Por confirmar';
const statusLabel = availabilityState;
const canSelect = canSelectForProposal;
function MapPanel({ records, activeCity, onCity, onPick }) {
  const node = useRef(null), map = useRef(null), layer = useRef(null);
  const [ready, setReady] = useState(false);
  const locations = useMemo(() => mapLocations(records), [records]);
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
      const bounds = [];
      for (const r of locations.exact) {
        const color = statusLabel(r) === 'Disponible' ? '#5d9b65' : statusLabel(r) === 'No disponible' ? '#ac6873' : '#e5b85c';
        const kind = markerKind(r);
        const icon = L.divIcon({ className: `map-media-marker ${kind}`, html: `<span style="background:${color}"></span>`, iconSize: [28, 28], iconAnchor: [14, 14] });
        const marker = L.marker([r.lat, r.lon], { icon }).addTo(layer.current);
        const tooltip = document.createElement('span');
        tooltip.textContent = r.codigo + ' · ' + r.ciudad + ' · ubicación exacta';
        marker.bindTooltip(tooltip);
        marker.on('click', () => onPick(r.codigo));
        bounds.push([r.lat, r.lon]);
      }
      for (const group of locations.approximate) {
        const anchors = { static: [48, 19], led: [-10, 19], airport: [19, 48], mall: [19, -10] };
        const icon = L.divIcon({ className: `map-city-marker ${group.kind}`, html: '<span>' + group.records.length + '</span>', iconSize: [38, 38], iconAnchor: anchors[group.kind] });
        const marker = L.marker([group.lat, group.lon], { icon }).addTo(layer.current);
        const tooltip = document.createElement('span');
        tooltip.textContent = group.city + ' · ' + group.records.length + ' medios sin coordenadas · referencia de ciudad';
        marker.bindTooltip(tooltip);
        marker.on('click', () => onCity(group.city));
        bounds.push([group.lat, group.lon]);
      }
      if (bounds.length) map.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 12 });
    })();
  }, [locations, onCity, onPick, ready]);
  const cityRecords = activeCity ? records.filter(r => r.ciudad === activeCity && !(Number.isFinite(r.lat) && Number.isFinite(r.lon))) : [];
  return <div className="map-wrap"><div ref={node} className="map" /><div className="map-note"><strong>{locations.exact.length} ubicaciones exactas · {locations.approximate.reduce((sum, group) => sum + group.records.length, 0)} medios agrupados por ciudad</strong><p>Los grupos indican el centro aproximado de la ciudad, no la dirección del medio. La forma indica: círculo valla estática, cuadrado pantalla LED, triángulo aeropuerto, rombo centro comercial.</p><div className="map-city-list">{locations.approximate.map(group=><button key={group.city+'|'+group.kind} type="button" onClick={()=>onCity(group.city)}>{group.city} · {group.kind==='airport'?'Aeropuerto':group.kind==='mall'?'Centro comercial':group.kind==='led'?'LED':'Estática'} ({group.records.length})</button>)}</div></div>{activeCity&&cityRecords.length>0&&<div className="map-valla-list"><strong>{activeCity}: medios sin coordenadas exactas</strong><div>{cityRecords.map(r=><button key={r.codigo} type="button" onClick={()=>onPick(r.codigo)}><b>{r.codigo}</b><span>{r.ubicacion || 'Dirección por confirmar'}</span></button>)}</div></div>}{locations.withoutLocation.length>0&&<div className="map-note">{locations.withoutLocation.length} medios no se pueden ubicar ni por ciudad; consúltalos en la cuadrícula.</div>}</div>;
}
export default function CatalogClient({ initial, canManage = false, isAdmin = false }) {
  const [data, setData] = useState(initial), [query, setQuery] = useState(''), [city, setCity] = useState(''), [provider, setProvider] = useState(''), [availability, setAvailability] = useState(''), [support, setSupport] = useState(''), [setting, setSetting] = useState(''), [assetView, setAssetView] = useState('ready'), [view, setView] = useState('grid'), [tab, setTab] = useState('catalogo'), [selected, setSelected] = useState(null), [file, setFile] = useState(null), [uploading, setUploading] = useState(false), [result, setResult] = useState(null), [notice, setNotice] = useState(''), [basket, setBasket] = useState([]), [downloading, setDownloading] = useState(false), [fullSnapshot, setFullSnapshot] = useState(true);
  const records = displayRecords(data.records, 'all');
  const readyCount = displayRecords(records, 'ready').length;
  const reviewCount = displayRecords(records, 'review').length;
  const cities = [...new Set(records.map(r => r.ciudad).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
  const providers = [...new Set(records.map(r => r.proveedor).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es'));
  const filtered = useMemo(() => displayRecords(records, assetView).filter(r => { const kind=mediaKind(r); return (!city || r.ciudad === city) && (!provider || r.proveedor === provider) && (!availability || statusLabel(r) === availability) && (!support || kind.soporte === support) && (!setting || kind.entorno === setting) && (!query || matchesCatalogSearch(r,query)); }), [records,assetView,query,city,provider,availability,support,setting]);
  const detail = records.find(r => r.codigo === selected);
  const selectedSet = new Set(basket);
  const toggleBasket = code => setBasket(current => current.includes(code) ? current.filter(x => x !== code) : [...current, code]);
  const selectFiltered = () => setBasket(current => [...new Set([...current, ...filtered.filter(r => canSelect(r)).map(r => r.codigo)])]);
  const deselectFiltered = () => { const codes = new Set(filtered.map(r => r.codigo)); setBasket(current => current.filter(code => !codes.has(code))); };
  const selectableFiltered = filtered.filter(r => canSelect(r));
  const selectedFiltered = filtered.filter(r => selectedSet.has(r.codigo)).length;
  const downloadProposal = async () => {
    if (!basket.length) return;
    setDownloading(true); setNotice('');
    try {
      const response = await fetch('/api/proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codes: basket }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'No se pudo crear la presentación.'); }
      const {url} = await response.json();
      if (!url) throw new Error('No se obtuvo el enlace de descarga.');
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Vallas_disponibles_HERCAS_' + new Date().toISOString().slice(0,10) + '.pptx';
      document.body.appendChild(link); link.click(); link.remove();
    } catch (error) { setNotice(error.message || 'No se pudo descargar.'); }
    finally { setDownloading(false); }
  };
  const refresh = async () => { const response = await fetch('/api/catalog', { cache: 'no-store' }); if (response.ok) { const next = await response.json(); setData(next); const offered = new Set(next.records.filter(r => canSelect(r)).map(r => r.codigo)); setBasket(current => current.filter(code => offered.has(code))); } };
  const submit = async e => {
    e.preventDefault(); if (!file || !provider) return setNotice('Selecciona proveedor y archivo.');
    setUploading(true); setNotice(''); setResult(null);
    try { const {uploadWeeklyCatalog}=await import('../../lib/upload-catalog-client'); const storagePath=await uploadWeeklyCatalog(file, ratio=>setNotice(`Subiendo catálogo: ${Math.round(ratio*100)} %`)); setNotice('Analizando catálogo…'); const r = await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,storagePath,originalName:file.name,fullSnapshot})}); const j = await r.json(); if (!r.ok) throw new Error(j.error); setResult(j); setNotice('Análisis listo para revisar.'); setTab('actualizar'); }
    catch(err) { setNotice(err.message || 'No se pudo analizar el archivo.'); }
    finally { setUploading(false); }
  };
  const apply = async () => {
    const approvedRows=result.proposals.map((item,index)=>item.action==='actualizar'&&item.selected?index+1:null).filter(Boolean);
    const r = await fetch('/api/import/apply', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stageId:result.stageId,approvedRows}) });
    const j = await r.json(); if (!r.ok) return setNotice(j.error || 'No se pudo aplicar.');
    setNotice('Disponibilidades actualizadas: ' + j.updated + '. Por confirmar: ' + j.unconfirmed + '. Casos para revisión: ' + j.review + '.' + (result.fullSnapshot && !j.snapshotApplied ? ' La lectura no cubrió suficientes vallas para reemplazar la lista completa; las anteriores vencerán a los ocho días.' : '')); setResult(null); await refresh();
  };
  const toggleImportRow = index => setResult(current=>({...current,proposals:current.proposals.map((item,i)=>i===index?{...item,selected:!item.selected}:item)}));
  const revertImport = async stageId => {
    const r=await fetch('/api/import/revert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stageId})});
    const j=await r.json();
    if(!r.ok) return setNotice(j.error||'No se pudo revertir la importación.');
    setNotice('Importación revertida; se conservó el archivo original.');
    await refresh();
  };
  const signOut = async () => {
    const { error } = await supabaseBrowser().auth.signOut({ scope: 'local' });
    if (error) return setNotice('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    window.location.replace('/login');
  };
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">H</div><div><strong>HERCAS</strong><small>MEDIOS EXTERIORES</small></div></div><div className="nav-label">ESPACIO DE TRABAJO</div><button className={'nav '+(tab==='catalogo'?'active':'')} onClick={()=>setTab('catalogo')}>▦ <span>Explorar medios</span></button>{canManage&&<button className={'nav '+(tab==='actualizar'?'active':'')} onClick={()=>setTab('actualizar')}>↻ <span>Actualizar catálogo</span></button>}{isAdmin&&<a className="nav" href="/admin" aria-label="Administrar vallas">⚙ <span>Administrar vallas</span></a>}<div className="side-bottom"><button className="sign-out" onClick={signOut}>Cerrar sesión</button><span className="live-dot" /> Catálogo HERCAS · 2026<br/><small>Información centralizada</small></div></aside>
    <main className="main">
      <header className="top"><div><div className="eyebrow">CATÁLOGO COMERCIAL</div><h1>{tab==='catalogo'?'Encuentra el medio indicado':'Actualización de aliados'}</h1><p>{tab==='catalogo'?'Busca por ciudad, dirección o código y abre la ficha lista para propuesta.':'Carga el archivo semanal y revisa las coincidencias antes de cambiar disponibilidades.'}</p></div><div className="top-chip">HERCAS · Inventario de aliados</div></header>
      {tab==='catalogo' ? <>
        <section className="metrics"><div><strong>{records.length}</strong><span>medios en inventario</span></div><div><strong>{readyCount}</strong><span>con montaje y ficha</span></div><div><strong>{reviewCount}</strong><span>sin ambos archivos</span></div><div><strong>{cities.length}</strong><span>ciudades registradas</span></div></section>
        <section className="catalog-scope" aria-label="Archivos de las vallas"><button className={assetView==='ready'?'active':''} onClick={()=>setAssetView('ready')}>Con montaje y ficha ({readyCount})</button><button className={assetView==='review'?'active':''} onClick={()=>setAssetView('review')}>Sin completar ({reviewCount})</button><button className={assetView==='all'?'active':''} onClick={()=>setAssetView('all')}>Todas ({records.length})</button></section>
        <section className="filters"><div className="search"><span>⌕</span><input aria-label="Buscar vallas" placeholder="Código HERCAS, código del aliado o dirección" value={query} onChange={e=>setQuery(e.target.value)}/></div><select aria-label="Ciudad" value={city} onChange={e=>setCity(e.target.value)}><option value="">Todas las ciudades</option>{cities.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Proveedor" value={provider} onChange={e=>setProvider(e.target.value)}><option value="">Todos los aliados</option>{providers.map(p=><option key={p}>{p}</option>)}</select><select aria-label="Tipo de pantalla" value={support} onChange={e=>setSupport(e.target.value)}><option value="">LED y estáticas</option><option value="led">Pantalla LED</option><option value="estatica">Valla estática</option></select><select aria-label="Entorno" value={setting} onChange={e=>setSetting(e.target.value)}><option value="">Todos los entornos</option><option value="exterior">Vía pública</option><option value="aeropuerto">Aeropuerto</option><option value="centro_comercial">Centro comercial</option></select><select aria-label="Disponibilidad" value={availability} onChange={e=>setAvailability(e.target.value)}><option value="">Cualquier disponibilidad</option><option value="Disponible">Disponibles vigentes</option><option value="Por confirmar">Por confirmar</option><option value="No disponible">No disponibles</option><option value="Revisar fuente">Revisar fuente</option></select></section>
        <section className="result-head"><div><strong>{filtered.length} resultados</strong><span> · {selectableFiltered.length} con montaje y ficha · {selectedFiltered} seleccionadas en este filtro</span></div><div className="result-actions"><button className="select-all" onClick={selectFiltered} disabled={!selectableFiltered.length}>Seleccionar todas las {selectableFiltered.length} filtradas</button><button className="select-all" onClick={deselectFiltered} disabled={!selectedFiltered}>Quitar selección filtrada</button><div className="switch"><button className={view==='grid'?'chosen':''} onClick={()=>setView('grid')}>Cuadrícula</button><button className={view==='map'?'chosen':''} onClick={()=>setView('map')}>Mapa</button></div></div></section>
        {view==='map' ? <MapPanel records={filtered} activeCity={city} onCity={setCity} onPick={setSelected}/> : <section className="cards">{filtered.map(r=><article className="card" key={r.codigo}><button className="card-open" onClick={()=>setSelected(r.codigo)}><div className="card-image">{r.foto?<img loading="lazy" src={'/api/asset/'+r.codigo+'/foto'} alt={'Valla '+r.codigo}/>:<div className="no-image">FOTO EN REVISIÓN</div>}<span className={'badge '+(statusLabel(r)==='Disponible'?'good':statusLabel(r)==='No disponible'?'bad':'neutral')}>{statusLabel(r)}</span></div><div className="card-body"><div className="card-code">{r.codigo}<span>↗</span></div><h3>{r.ubicacion || 'Ubicación por confirmar'}</h3><p>{r.ciudad} · {r.proveedor}</p><div className="card-foot"><span>{r.medidas || r.formato}</span><strong>Ver ficha →</strong></div></div></button><label className="card-select"><input type="checkbox" aria-label={"Seleccionar " + r.codigo} checked={selectedSet.has(r.codigo)} disabled={!canSelect(r)} onChange={()=>toggleBasket(r.codigo)}/><span>Seleccionar</span></label></article>)}</section>}
        {filtered.length===0 && <div className="empty">No hay vallas para esta búsqueda.</div>}{basket.length>0&&<div className="basket-bar"><div><strong>{basket.length} valla{basket.length===1?"":"s"} seleccionada{basket.length===1?"":"s"}</strong><span>PowerPoint con portada y separadores por ciudad</span></div><button className="basket-clear" onClick={()=>setBasket([])}>Limpiar</button><button className="primary" onClick={downloadProposal} disabled={downloading}>{downloading?"Preparando presentación…":"Descargar PowerPoint"}</button></div>}
      </> : <section className="import-layout"><div className="upload-panel"><div className="section-kicker">01 / NUEVO ARCHIVO</div><h2>Revisar disponibilidad semanal</h2><p>Admite Excel, CSV, PowerPoint y PDF con texto. Se comparan códigos y direcciones del mismo aliado; los casos ambiguos quedan para revisión.</p><form onSubmit={submit}><label>Aliado<select value={provider} onChange={e=>setProvider(e.target.value)} required><option value="">Selecciona un aliado</option>{providers.map(p=><option key={p}>{p}</option>)}</select></label><label>Catálogo recibido<input type="file" accept=".xlsx,.csv,.pptx,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)} required/></label><label className="snapshot-option"><input type="checkbox" checked={fullSnapshot} onChange={e=>setFullSnapshot(e.target.checked)}/> Esta presentación contiene la lista completa de vallas disponibles del aliado. Las no incluidas quedan por confirmar.</label><button className="primary" disabled={uploading}>{uploading?'Analizando…':'Analizar archivo'}</button></form><div className="help">Una confirmación dura ocho días. Revisa las coincidencias antes de aplicar; las vallas nuevas quedan en cola para validar foto y ubicación.</div><div className="queue-summary"><strong>{data.pendingNew.length}</strong> casos en cola de revisión</div><div className="import-history"><h3>Importaciones recientes</h3>{(data.importHistory||[]).slice(0,10).map(x=><div className="history-item" key={x.id}><div><b>{x.proveedor}</b><small>{x.archivo} · {x.estado}</small></div>{x.estado==="aplicado"&&<button type="button" onClick={()=>revertImport(x.id)}>Revertir</button>}</div>)}</div></div><div className="results-panel"><div className="section-kicker">02 / RESULTADOS</div><h2>{result?'Comparación del catálogo':'Esperando archivo'}</h2>{result?<><div className="import-stats"><div><strong>{result.scanned}</strong><span>entradas leídas</span></div><div><strong>{result.proposals.filter(x=>x.action==='actualizar').length}</strong><span>coincidencias seguras</span></div><div><strong>{result.proposals.filter(x=>x.action!=='actualizar').length}</strong><span>por revisar</span></div></div><div className="proposal-list">{result.proposals.map((x,i)=><div className="proposal" key={i}><div><b>{x.matches[0]?.codigo || x.code || 'Posible valla nueva'}</b><small>{x.ref} · {x.status || 'Disponibilidad no indicada'}</small></div>{x.action==='actualizar'&&<label><input type="checkbox" checked={!!x.selected} onChange={()=>toggleImportRow(i)} aria-label={'Aprobar '+x.ref}/> Aprobar</label>}<span className={x.action==='actualizar'?'pill-ok':'pill-review'}>{x.action==='actualizar'?'Coincidencia segura':'Revisar'}</span></div>)}</div><button className="primary" onClick={apply} disabled={!result.proposals.some(x=>x.action==='actualizar'&&x.selected)}>Aplicar coincidencias seguras</button><p className="small">Archivo original: {result.file}</p></>:<div className="placeholder">Las diferencias aparecerán aquí con el código de la valla y su origen.</div>}</div></section>}
      {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
    </main>
    {detail&&<div className="overlay" onClick={()=>setSelected(null)}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)} aria-label="Cerrar">×</button><div className="drawer-image">{detail.foto?<img src={'/api/asset/'+detail.codigo+'/foto'} alt={'Foto HERCAS '+detail.codigo}/>:<div className="no-image">FOTO EN REVISIÓN</div>}</div><div className="drawer-content"><div className="section-kicker">{detail.proveedor} · {detail.ciudad}</div><h2>{detail.codigo}</h2><h3>{detail.ubicacion}</h3><span className={'badge-inline '+(statusLabel(detail)==='Disponible'?'good':'')}>{statusLabel(detail)}</span><div className="details"><div><span>Formato</span><strong>{detail.formato}</strong></div><div><span>Medidas</span><strong>{detail.medidas||'Por confirmar'}</strong></div><div><span>Tarifa de referencia</span><strong>{money(detail.tarifa)}</strong></div><div><span>Última fecha fuente</span><strong>{detail.fechaDisponibilidad||'No indicada'}</strong></div></div><p className="caution">Puedes incluir esta ficha en una propuesta si tiene montaje y PowerPoint. La disponibilidad vence ocho días después del último archivo aplicado; confírmala antes de contratar. El precio permanece editable.</p><div className="drawer-actions">{canSelect(detail)&&<button className="primary" onClick={()=>toggleBasket(detail.codigo)}>{selectedSet.has(detail.codigo)?"Quitar de selección":"Añadir a selección"}</button>}{detail.ficha&&<a className="secondary" href={'/api/asset/'+detail.codigo+'/ficha'}>Descargar ficha individual</a>}{detail.foto&&<a className="secondary" href={'/api/asset/'+detail.codigo+'/foto'} target="_blank">Abrir foto</a>}{detail.lat!==null&&detail.lon!==null&&<a className="secondary" href={'https://www.openstreetmap.org/?mlat='+detail.lat+'&mlon='+detail.lon+'#map=17/'+detail.lat+'/'+detail.lon} target="_blank" rel="noreferrer">Ver ubicación</a>}</div>{detail.estadoFicha==='revision_fuente'&&<p className="review-box">{detail.revision}</p>}</div></aside></div>}
  </div>;
}



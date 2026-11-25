'use client';
import {useEffect,useRef,useState} from 'react';
import {highlightKey} from '../../lib/highlights-filter.mjs';

export default function HighlightsFilter({options,selected,mode,onChange,onModeChange}) {
  const [search,setSearch]=useState('');
  const details=useRef(null);
  const toggle=key=>onChange(selected.includes(key)?selected.filter(item=>item!==key):[...selected,key]);
  const close=()=>{if(details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}};
  useEffect(()=>{
    const outside=event=>{if(details.current?.open&&!details.current.contains(event.target))details.current.open=false;};
    const escape=event=>{if(event.key==='Escape'&&details.current?.open)close();};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
  const shown=options.filter(option=>highlightKey(option.label).includes(highlightKey(search)));
  const byKey=new Map(options.map(option=>[option.key,option.label]));
  return <section className="highlights-filter" aria-label="Filtrar por destacados">
    <details ref={details} className="highlights-picker">
      <summary>Destacados{selected.length?` (${selected.length})`:''}<span aria-hidden="true">⌄</span></summary>
      <div className="highlights-filter-panel">
        <label className="highlights-search">Buscar destacado<input type="search" value={search} placeholder="Universidades, restaurantes…" onChange={event=>setSearch(event.target.value)}/></label>
        <div className="highlights-options" role="group" aria-label="Opciones de destacados">{shown.map(option=><label key={option.key}><input type="checkbox" checked={selected.includes(option.key)} onChange={()=>toggle(option.key)}/><span>{option.label}</span><small>{option.count}</small></label>)}</div>
        {!shown.length&&<p className="highlights-filter-empty">{options.length?'No hay destacados con esa búsqueda.':'No hay destacados registrados todavía.'}</p>}
        <div className="highlights-filter-actions"><span>Los cambios se aplican al seleccionar.</span><button type="button" onClick={close}>Listo</button></div>
      </div>
    </details>
    <label className="highlights-match">Coincidir con<select value={mode} onChange={event=>onModeChange(event.target.value)}><option value="all">Todos los seleccionados</option><option value="any">Cualquiera de los seleccionados</option></select></label>
    {selected.length>0&&<button type="button" className="highlights-clear" onClick={()=>onChange([])}>Limpiar destacados</button>}
    {selected.length>0&&<ul className="highlights-selected" aria-label="Destacados seleccionados">{selected.map(key=><li key={key}><span>{byKey.get(key)||key}</span><button type="button" onClick={()=>toggle(key)} aria-label={`Quitar filtro ${byKey.get(key)||key}`}>×</button></li>)}</ul>}
  </section>;
}

'use client';
import {useId,useRef,useState} from 'react';
import {highlightItems,mergeHighlightDraft,HIGHLIGHT_LIMIT,HIGHLIGHT_LENGTH} from '../../lib/valla-highlights.mjs';

export default function HighlightsInput({value,draft,onChange,onDraftChange}) {
  const id=useId(),input=useRef(null),[error,setError]=useState('');
  const items=highlightItems(value);
  const add=(text=draft)=>{
    try {
      onChange(mergeHighlightDraft(items,text).join('\n'));
      onDraftChange('');setError('');input.current?.focus();
    } catch(e){setError(e.message);}
  };
  const remove=index=>{
    onChange(items.filter((_,i)=>i!==index).join('\n'));
    setError('');input.current?.focus();
  };
  return <div className="admin-wide highlights-field">
    <label htmlFor={id} id={`${id}-label`}>Destacados de la valla</label>
    <div className="highlights-input" role="group" aria-labelledby={`${id}-label`}>
      {items.length>0&&<ul aria-label="Destacados agregados">{items.map((item,index)=><li key={item.toLocaleLowerCase('es-CO')}><span>{item}</span><button type="button" onClick={()=>remove(index)} aria-label={`Quitar ${item}`}><span aria-hidden="true">×</span></button></li>)}</ul>}
      <div className="highlights-entry"><input ref={input} id={id} value={draft} maxLength={HIGHLIGHT_LENGTH} autoComplete="off" placeholder={items.length?'Agregar otro destacado…':'Ej.: Cerca de universidades'} aria-describedby={`${id}-help${error?` ${id}-error`:''}`} aria-invalid={!!error} onChange={e=>{onDraftChange(e.target.value);setError('');}} onKeyDown={e=>{
        if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.keyCode!==229){e.preventDefault();add();}
      }} onPaste={e=>{
        const text=e.clipboardData.getData('text');
        if(/[\r\n]/.test(text)){
          e.preventDefault();
          const node=e.currentTarget;
          const combined=draft.slice(0,node.selectionStart)+text+draft.slice(node.selectionEnd);
          add(combined);
        }
      }}/><button type="button" className="highlights-add" onClick={()=>add()} disabled={!draft.trim()}>Agregar</button></div>
    </div>
    <span id={`${id}-help`} className="highlights-help">Escribe y pulsa Enter o Agregar. Quita etiquetas con ×. {items.length}/{HIGHLIGHT_LIMIT} destacados; máximo {HIGHLIGHT_LENGTH} caracteres por etiqueta.</span>
    {error&&<span id={`${id}-error`} className="highlights-error" role="alert">{error}</span>}
  </div>;
}

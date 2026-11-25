import {highlightItems} from './valla-highlights.mjs';

export const highlightKey=value=>String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CO').trim().replace(/\s+/g,' ');

export function highlightOptions(records) {
  const options=new Map();
  for(const record of records) {
    const seen=new Set();
    for(const label of highlightItems(record.destacados)) {
      const key=highlightKey(label);
      if(seen.has(key))continue;
      seen.add(key);
      if(!options.has(key))options.set(key,{key,label,count:0});
      options.get(key).count++;
    }
  }
  return [...options.values()].sort((a,b)=>a.label.localeCompare(b.label,'es'));
}

export function matchesHighlights(record,selected=[],mode='all') {
  if(!selected.length)return true;
  const available=new Set(highlightItems(record.destacados).map(highlightKey));
  const keys=selected.map(highlightKey);
  return mode==='any'?keys.some(key=>available.has(key)):keys.every(key=>available.has(key));
}

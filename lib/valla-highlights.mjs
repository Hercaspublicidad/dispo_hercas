export const HIGHLIGHT_LIMIT=10;
export const HIGHLIGHT_LENGTH=100;

export function highlightItems(value) {
  const lines=Array.isArray(value)?value:typeof value==='string'?value.split(/\r?\n/):[];
  const seen=new Set();
  return lines.filter(item=>typeof item==='string').map(item=>item.trim()).filter(item=>{
    const key=item.toLocaleLowerCase('es-CO');
    if(!item||seen.has(key))return false;
    seen.add(key);return true;
  });
}

export function validateHighlights(value) {
  if(value==null||value==='')return [];
  if((typeof value!=='string'&&!Array.isArray(value)) || (typeof value==='string'&&value.length>2000) || (Array.isArray(value)&&(value.length>100||value.some(item=>typeof item!=='string'))))throw new Error('Destacados inválidos: escribe un destacado por línea.');
  const items=highlightItems(value);
  if(items.length>HIGHLIGHT_LIMIT||items.some(item=>item.length>HIGHLIGHT_LENGTH))throw new Error('Agrega hasta 10 destacados, de máximo 100 caracteres cada uno.');
  return items;
}

// The same merge is used by Enter/Add and by Save, so unfinished input is retained.
export function mergeHighlightDraft(value,draft) {
  return validateHighlights([...highlightItems(value),...highlightItems(draft)]);
}

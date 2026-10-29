import {validateValla} from './valla-admin.mjs';

export const TRANSFER_VERSION = 1;
export const TRANSFER_COLUMNS = ['codigo','codigo_proveedor','proveedor','ciudad','ubicacion','categoria','formato','medidas','tarifa_mensual_cop','latitud','longitud','estado','entorno','tipo_soporte','observacion_calidad','condiciones_comerciales','foto'];
const numeric = new Set(['tarifa_mensual_cop','latitud','longitud']);
export const safeTransferPath = value => typeof value === 'string' && value.length <= 300 && /^[^\\\x00-\x1f:]+$/.test(value) && !value.startsWith('/') && value.split('/').every(part=>part && part !== '.' && part !== '..');

export function encodeTransferCsv(rows) {
  const cell = (value,key) => {
    let text = String(value ?? '');
    if (!numeric.has(key) && /^[=+\-@\t\r]/.test(text)) text = "'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\ufeff'+[TRANSFER_COLUMNS,...rows.map(row=>TRANSFER_COLUMNS.map(key=>row[key] ?? ''))].map((row,i)=>row.map((value,j)=>cell(value,i ? TRANSFER_COLUMNS[j] : '')).join(';')).join('\r\n')+'\r\n';
}

export function decodeTransferCsv(text) {
  text = text.replace(/^\ufeff/,'');
  const delimiter = text.split(/\r?\n/,1)[0].includes(';') ? ';' : ',';
  const rows = []; let row = [], field = '', quoted = false, endedQuote = false;
  for (let i=0;i<text.length;i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {if(text[i+1] === '"'){field+='"';i++;}else{quoted=false;endedQuote=true;}}
      else field+=char;
    } else if (char === '"') {
      if(field || endedQuote)throw new Error('CSV inválido: comillas fuera de una celda.');
      quoted=true;
    } else if (char === delimiter || char === '\n' || char === '\r') {
      row.push(field);field='';endedQuote=false;
      if(char !== delimiter){if(char==='\r' && text[i+1]==='\n')i++;if(row.some(value=>value.trim()))rows.push(row);row=[];}
    } else {if(endedQuote)throw new Error('CSV inválido: texto después de comillas.');field+=char;}
  }
  if(quoted)throw new Error('CSV inválido: faltan comillas de cierre.');
  if(field || row.length){row.push(field);if(row.some(value=>value.trim()))rows.push(row);}
  const headers = rows.shift()?.map(value=>value.trim()) || [];
  if(!headers.includes('codigo') || new Set(headers).size!==headers.length)throw new Error('El CSV debe incluir codigo y no repetir columnas.');
  const unknown=headers.filter(key=>!TRANSFER_COLUMNS.includes(key));
  if(unknown.length)throw new Error('Columnas desconocidas: '+unknown.join(', '));
  if(rows.length>2000)throw new Error('Importa hasta 2.000 vallas por archivo.');
  return rows.map((values,i)=>{
    if(values.length!==headers.length)throw new Error(`Fila ${i+2}: cantidad incorrecta de columnas.`);
    return Object.fromEntries(headers.map((key,j)=>[key,key==='codigo' ? values[j].trim() : !numeric.has(key) ? values[j].replace(/^'(?=[=+\-@\t\r])/,'') : values[j]]));
  });
}

export function transferInput(record) {
  return Object.fromEntries(TRANSFER_COLUMNS.filter(key=>key!=='foto').map(key=>[key,record[key] ?? record.datos_fuente?.[key] ?? '']));
}

export function validateTransferInput(input, previous = {}, source = {}) {
  if(!source || typeof source!=='object' || Array.isArray(source) || JSON.stringify(source).length>24000)throw new Error('Datos de origen inválidos o demasiado extensos.');
  const safeSource = {...source};
  for(const key of ['__proto__','constructor','prototype','editado_por','gestion_admin','archivado_en'])delete safeSource[key];
  // A spreadsheet changes only supplied columns. An empty cell explicitly clears it.
  const sourceData={...previous.datos_fuente,...safeSource};
  const merged = {...transferInput({...previous,datos_fuente:sourceData}),...input};
  delete merged.foto;
  if(!merged.estado)merged.estado='revision_fuente';
  const payload=validateValla(merged,{...previous,datos_fuente:sourceData},{allowMissingLocation:true});
  return payload;
}

export function reviewTransferRows(rows, existing, metadata = []) {
  const byCode=new Map(existing.map(record=>[record.codigo,record]));
  const sources=new Map(metadata.map(record=>[record.codigo,record.datos_fuente || {}]));
  const counts=new Map();for(const row of rows)counts.set(row.codigo,(counts.get(row.codigo)||0)+1);
  return rows.map(input=>{
    const previous=byCode.get(input.codigo);
    try {
      if(counts.get(input.codigo)>1)throw new Error('Código repetido dentro del archivo.');
      if(previous?.datos_fuente?.archivado_en || sources.get(input.codigo)?.archivado_en)throw new Error('Esta valla está eliminada. Restáurala y exporta de nuevo antes de importarla.');
      const payload=validateTransferInput(input,previous,sources.get(input.codigo));
      const before=transferInput(previous || {}), after=transferInput(payload);
      const changes=Object.keys(after).filter(key=>String(before[key] ?? '')!==String(after[key] ?? '')).map(key=>({campo:key,antes:before[key],despues:after[key]}));
      return {codigo:input.codigo,input,source:sources.get(input.codigo)||{},mode:previous?'update':'create',expected:previous?.actualizado_en || null,selected:!previous,changes,error:null};
    } catch(error){return {codigo:input.codigo,input,selected:false,error:error.message};}
  });
}

export function makeExportGroups(records, files, maxBytes = 64*1024*1024) {
  const groups=[];let group={records:[],files:[],bytes:0};
  for(const record of records) {
    const images=files.filter(file=>file.codigo===record.codigo && ['foto','vista'].includes(file.tipo));
    const size=images.reduce((n,file)=>n+Number(file.tamano_bytes || 0),0);
    if(group.records.length && (group.bytes+size>maxBytes || group.records.length>=100)) {groups.push(group);group={records:[],files:[],bytes:0};}
    group.records.push(record);group.files.push(...images);group.bytes+=size;
  }
  if(group.records.length)groups.push(group);
  return groups;
}

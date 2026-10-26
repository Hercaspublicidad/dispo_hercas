import JSZip from 'jszip';
import ExcelJS from 'exceljs';

const norm = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const statusOf = value => {
  const text = norm(value);
  if (/\b(NO (?:SE ENCUENTRA |ESTA )?DISPONIBLES?|NO (?:HAY )?DISPONIBILIDAD|SIN DISPONIBILIDAD|OCUPAD[AO]S?|RESERVAD[AO]S?|VENDID[AO]S?)\b/.test(text)) return 'No disponible';
  if (/\b(DISPONIBLES?|LIBRES?|VACANTES?)\b/.test(text)) return 'Disponible';
  return null;
};
const xmlText = xml => [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(hit => hit[1].replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[entity])).join('\n');

async function pptxItems(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a,b) => Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
  return Promise.all(slides.map(async (path,index) => ({ref:`diapositiva ${index+1}`,code:'',city:'',address:'',status:'',text:xmlText(await zip.file(path).async('string')).slice(0,5000)})));
}

async function pdfItems(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({data:new Uint8Array(buffer),useSystemFonts:true,disableFontFace:true}).promise;
  const out = [];
  for (let pageNumber=1; pageNumber<=document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    out.push({ref:`página ${pageNumber}`,code:'',city:'',address:'',status:'',text:content.items.map(item=>item.str||'').join(' ').slice(0,5000)});
  }
  return out;
}

function rowItems(rows, sheetName) {
  const headerIndex = rows.slice(0,25).findIndex(row => row.filter(cell => /CODIGO|REFERENCIA|UBICACION|DIRECCION|CIUDAD|MUNICIPIO|DISPONIBILIDAD|ESTADO/.test(norm(cell))).length >= 2);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(norm);
  const val = (row,keys) => {const index=headers.findIndex(header=>keys.some(key=>header.includes(key))); return index<0 ? '' : String(row[index]??'').trim();};
  return rows.slice(headerIndex+1).map((row,index)=>({ref:`${sheetName}!${headerIndex+index+2}`,code:val(row,['CODIGO','REFERENCIA','ID VALLA']),city:val(row,['CIUDAD','MUNICIPIO']),address:val(row,['UBICACION','DIRECCION','LUGAR']),status:val(row,['DISPONIBILIDAD','ESTADO','CUPO']),text:row.filter(Boolean).join(' | ').slice(0,2500)})).filter(item=>item.code||item.address);
}

async function xlsxItems(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets.flatMap(sheet=>rowItems(sheet.getSheetValues().slice(1).map(row=>(row||[]).slice(1).map(cell=>typeof cell==='object' ? cell?.text??cell?.result??'' : cell)),sheet.name));
}

function csvItems(buffer) {
  const text=buffer.toString('utf8').replace(/^\uFEFF/,'');
  const lines=text.split(/\r?\n/).filter(Boolean);
  const delimiter=(lines[0]?.match(/;/g)||[]).length>(lines[0]?.match(/,/g)||[]).length?';':',';
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(char==='"') {if(quoted&&text[i+1]==='"') {cell+='"';i++;} else quoted=!quoted;}
    else if(char===delimiter&&!quoted) {row.push(cell);cell='';}
    else if((char==='\n'||char==='\r')&&!quoted) {if(char==='\r'&&text[i+1]==='\n') i++;row.push(cell);if(row.some(value=>value.trim())) rows.push(row);row=[];cell='';}
    else cell+=char;
  }
  row.push(cell);if(row.some(value=>value.trim())) rows.push(row);
  return rowItems(rows,'CSV');
}

export async function extractCatalogItems(buffer, extension) {
  if (extension==='.pptx') return pptxItems(buffer);
  if (extension==='.pdf') return pdfItems(buffer);
  if (extension==='.xlsx') return xlsxItems(buffer);
  if (extension==='.csv') return csvItems(buffer);
  throw new Error('Formato admitido: PPTX, PDF, XLSX o CSV.');
}

export function matchCatalogItems(items,records,provider,{fullSnapshot=false,extension=''}={}) {
  const candidates=records.filter(record=>norm(record.proveedor)===norm(provider)&&record.estadoFicha!=='duplicado_confirmado');
  const proposals=[];
  for (const item of items) {
    const text=norm(item.text), code=norm(item.code), address=norm(item.address), city=norm(item.city);
    const hits=[];
    for (const record of candidates) {
      const ownCode=norm(record.codigo), sourceCode=norm(record.codigoProveedor), location=norm(record.ubicacion);
      const exactCode=code&&(code===ownCode||code===sourceCode);
      const textCode=[ownCode,sourceCode].some(token=>token.length>=4&&new RegExp(`(?:^| )${token.replace(/ /g,' ')}(?: |$)`).test(text));
      const locationHit=location.length>=12&&text.includes(location)&&(city===''||city===norm(record.ciudad));
      const addressHit=address.length>=12&&address===location&&(city===''||city===norm(record.ciudad));
      if (exactCode||textCode||addressHit||locationHit) hits.push({score:exactCode||textCode?1:.94,codigo:record.codigo,ubicacion:record.ubicacion});
    }
    hits.sort((a,b)=>b.score-a.score||a.codigo.localeCompare(b.codigo));
    const status=statusOf(item.status)||statusOf(item.text)||(fullSnapshot&&['.pptx','.pdf'].includes(extension)?'Disponible':null);
    const unique=hits.length===1&&hits[0].score>=.9;
    const possibleNew=/\b(VALLA|SOPORTE|CALLE|CARRERA|AUTOPISTA|AVENIDA|KM|DIAGONAL|TRANSVERSAL)\b/.test(text);
    if (hits.length||item.code||item.address||possibleNew) proposals.push({ref:item.ref,code:item.code,city:item.city,address:item.address,status,matches:hits.slice(0,3),action:unique&&status?'actualizar':'nueva_o_revision',selected:unique&&!!status,excerpt:item.text.slice(0,500)});
  }
  return {scanned:items.length,proposals};
}

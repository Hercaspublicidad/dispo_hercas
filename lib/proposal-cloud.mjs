import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const NAVY = '061933';
const DEEP_BLUE = '001746';
const YELLOW = 'FFCF14';
const WHITE = 'FFFFFF';
const LIGHT = 'D4E0F0';
const fmt = value => value == null ? 'Por confirmar' : new Intl.NumberFormat('es-CO', {maximumFractionDigits:0}).format(Number(value));

async function photoData(input) {
  const jpeg = await sharp(input).rotate().resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

let brandImage;
async function addBrand(slide) {
  brandImage??=readFile(path.join(process.cwd(),'public','brand','hercas-logo.png')).then(bytes=>`image/png;base64,${bytes.toString('base64')}`);
  slide.addImage({data:await brandImage,x:.48,y:.08,w:.92,h:.92,altText:'Hercas Publicidad Exterior'});
}

async function addOfficialSlide(pptx,filename) {
  // Embed the supplied artwork unchanged, with no overlays.
  const image=await readFile(path.join(process.cwd(),'public','presentations',filename));
  const slide = pptx.addSlide();
  slide.addImage({data:`image/png;base64,${image.toString('base64')}`,x:0,y:0,w:13.333333,h:7.5});
}

async function addCity(pptx, city, background) {
  const slide = pptx.addSlide();
  slide.addImage({data:background,x:0,y:0,w:13.333333,h:7.5});
  // Match the reference's blue veil, central brand silhouette and yellow bowl.
  const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00112f" stop-opacity=".78"/><stop offset="1" stop-color="#153c92" stop-opacity=".82"/></linearGradient></defs><rect width="1200" height="675" fill="url(#blue)"/><path d="M575 462V317a104 112 0 0 1 208 0v145Z" fill="#001236" fill-opacity=".5"/><path d="M295 262h78c-2 37-18 62-39 62s-37-25-39-62Z" fill="#ffda00"/></svg>`;
  const veil=await sharp(Buffer.from(overlay)).png().toBuffer();
  slide.addImage({data:`image/png;base64,${veil.toString('base64')}`,x:0,y:0,w:13.333333,h:7.5});
  slide.addText('ZONA', {x:4.27,y:2.72,w:5.8,h:1.14,fontFace:'Montserrat',fontSize:78,bold:true,color:WHITE,transparency:100,outline:{color:WHITE,size:1.7},margin:0,breakLine:false});
  slide.addText(city.toLocaleUpperCase('es-CO'), {x:4.27,y:3.79,w:8.6,h:1.22,fontFace:'Montserrat',fontSize:city.length > 20 ? 43 : city.length > 13 ? 56 : 76,bold:true,color:WHITE,margin:0,fit:'shrink',breakLine:false});
}

async function addValla(pptx, record, photo, {includePrices = false} = {}) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  await addBrand(slide);
  const technical=[record.sentido ? `Sentido: ${record.sentido}` : '',record.estructura ? `Estructura: ${record.estructura}` : ''].filter(Boolean);
  slide.addShape('rect', {x:.4,y:1.04,w:8.03,h:technical.length?6.28:5.78,line:{color:'E5EAF0',width:1},fill:{color:'E5EAF0'}});
  slide.addImage({data:photo,x:.42,y:1.68,w:7.99,h:4.49});
  const extra = [record.estrato != null && record.estrato !== '' ? `Estrato: ${record.estrato}` : '', record.iluminacion ? `Iluminación: ${record.iluminacion}` : '', record.flujo_personas_vehiculos != null && record.flujo_personas_vehiculos !== '' ? `Flujo personas / vehículos: ${fmt(record.flujo_personas_vehiculos)}` : ''].filter(Boolean);
  const details=[extra.join(' · '),...technical].filter(Boolean);
  if (details.length) slide.addText(details.join('\n'), {x:.6,y:6.28,w:7.62,h:technical.length ? .94 : .42,fontFace:'Arial',fontSize:11,color:NAVY,margin:0,fit:'shrink'});
  slide.addShape('rect', {x:8.66,y:0,w:4.673,h:7.5,line:{color:NAVY,transparency:100},fill:{color:NAVY}});
  slide.addText(record.codigo, {x:9.04,y:.77,w:3.9,h:.52,fontFace:'Arial',fontSize:24,bold:true,color:YELLOW,margin:0});
  slide.addText(`${record.ciudad} · ${record.proveedor}`, {x:9.04,y:1.42,w:3.9,h:.5,fontFace:'Arial',fontSize:15,bold:true,color:WHITE,margin:0,fit:'shrink'});
  slide.addText(record.ubicacion || 'Ubicación por confirmar', {x:9.04,y:2.08,w:3.83,h:1.15,fontFace:'Arial',fontSize:18,color:WHITE,margin:0,fit:'shrink'});
  slide.addText('FORMATO', {x:9.04,y:3.45,w:3.8,h:.28,fontFace:'Arial',fontSize:10,bold:true,color:LIGHT,margin:0});
  slide.addText(record.formato || 'Valla exterior', {x:9.04,y:3.78,w:3.8,h:.4,fontFace:'Arial',fontSize:16,color:WHITE,margin:0});
  slide.addText('MEDIDAS', {x:9.04,y:4.4,w:3.8,h:.28,fontFace:'Arial',fontSize:10,bold:true,color:LIGHT,margin:0});
  slide.addText(record.medidas || 'Por confirmar', {x:9.04,y:4.72,w:3.8,h:.4,fontFace:'Arial',fontSize:16,color:WHITE,margin:0});
  slide.addShape('line', {x:9.04,y:5.43,w:3.72,h:0,line:{color:'446180',width:1}});
  if (includePrices) {
    slide.addText('TARIFA MENSUAL DE REFERENCIA · COP', {x:9.04,y:5.63,w:3.86,h:.34,fontFace:'Arial',fontSize:10,bold:true,color:LIGHT,margin:0});
    slide.addText(fmt(record.tarifa), {x:9.04,y:6.05,w:3.85,h:.75,fontFace:'Arial',fontSize:29,bold:true,color:YELLOW,margin:0,fit:'shrink'});
  }
  slide.addText((includePrices && record.condicionesComerciales) || 'Confirmar disponibilidad y condiciones.', {x:9.04,y:6.94,w:3.9,h:.42,fontFace:'Arial',fontSize:8,color:LIGHT,margin:0,fit:'shrink'});
}

export async function buildProposal(records, getPhoto, {includePrices = false} = {}) {
  if (!Array.isArray(records) || records.length < 1 || records.length > 550) throw new Error('Seleccione entre 1 y 550 vallas');
  if (new Set(records.map(r => r.codigo)).size !== records.length) throw new Error('Hay códigos repetidos');
  if (records.some(r => !r.foto || !r.ficha || r.estadoFicha === 'duplicado_confirmado')) throw new Error('Hay fichas sin foto o presentación HERCAS');
  const ordered = [...records].sort((a,b) => a.ciudad.localeCompare(b.ciudad,'es') || a.codigo.localeCompare(b.codigo));
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'HERCAS';
  pptx.subject = 'Vallas disponibles';
  pptx.title = 'Vallas disponibles HERCAS';
  pptx.lang = 'es-CO';
  await addOfficialSlide(pptx,'portada-hercas.png');
  const photos = new Array(ordered.length);
  let next = 0;
  await Promise.all(Array.from({length:Math.min(8,ordered.length)},async()=>{
    while(next<ordered.length) {
      const index=next++;
      photos[index]=await photoData(await getPhoto(ordered[index].codigo));
    }
  }));
  let lastCity = null;
  for (const [index,record] of ordered.entries()) {
    const photo = photos[index];
    if (record.ciudad !== lastCity) { await addCity(pptx, record.ciudad, photo); lastCity = record.ciudad; }
    await addValla(pptx, record, photo, {includePrices: includePrices === true});
  }
  await addOfficialSlide(pptx,'cierre-hercas.png');
  return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }));
}

// Individual sheets use the same current data and photo as composed proposals.
export async function buildIndividualFiche(record, photo, {includePrices = false} = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'HERCAS';
  pptx.title = `Ficha ${record.codigo}`;
  pptx.lang = 'es-CO';
  await addValla(pptx, record, await photoData(photo), {includePrices: includePrices === true});
  return Buffer.from(await pptx.write({outputType:'nodebuffer'}));
}

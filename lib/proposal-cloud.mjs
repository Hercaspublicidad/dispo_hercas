import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';

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

function addBrand(slide, dark = false) {
  slide.addText('HERCAS', { x:.48, y:.28, w:2.1, h:.4, fontFace:'Arial', fontSize:21, bold:true, color:dark ? NAVY : WHITE, margin:0, breakLine:false });
  slide.addShape('rect', {x:.48,y:.75,w:.75,h:.055,line:{color:YELLOW},fill:{color:YELLOW}});
}

function addCover(pptx, count, cities) {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  addBrand(slide);
  slide.addShape('ellipse', {x:7.5,y:-1.8,w:7.2,h:7.2,line:{color:DEEP_BLUE,transparency:100},fill:{color:DEEP_BLUE}});
  slide.addShape('ellipse', {x:9.3,y:3.3,w:5.7,h:5.7,line:{color:YELLOW,transparency:100},fill:{color:YELLOW}});
  slide.addText('VALLAS\nDISPONIBLES', {x:.75,y:1.72,w:8.7,h:2.65,fontFace:'Arial',fontSize:47,bold:true,color:YELLOW,margin:0,breakLine:false});
  slide.addText(`${count} vallas seleccionadas  ·  ${cities} ${cities === 1 ? 'ciudad' : 'ciudades'}`, {x:.78,y:5.25,w:8,h:.55,fontFace:'Arial',fontSize:19,color:WHITE,margin:0});
  slide.addText('Disponibilidad sujeta a confirmación antes de contratar.', {x:.78,y:6.65,w:8.5,h:.3,fontFace:'Arial',fontSize:12,color:LIGHT,margin:0});
}

function addCity(pptx, city, background) {
  const slide = pptx.addSlide();
  slide.addImage({data:background,x:0,y:0,w:13.333,h:7.5});
  slide.addShape('rect', {x:0,y:0,w:13.333,h:7.5,line:{color:DEEP_BLUE,transparency:100},fill:{color:DEEP_BLUE,transparency:20}});
  slide.addShape('ellipse', {x:3.0,y:1.75,w:5.4,h:4.2,line:{color:DEEP_BLUE,transparency:100},fill:{color:DEEP_BLUE,transparency:14}});
  slide.addShape('ellipse', {x:2.85,y:2.65,w:.88,h:.88,line:{color:YELLOW,transparency:100},fill:{color:YELLOW}});
  slide.addShape('rect', {x:2.82,y:2.60,w:.96,h:.42,line:{color:DEEP_BLUE,transparency:100},fill:{color:DEEP_BLUE,transparency:100}});
  slide.addText('ZONA', {x:3.95,y:2.43,w:6.5,h:.96,fontFace:'Arial',fontSize:56,bold:false,color:DEEP_BLUE,outline:{color:WHITE,size:1.3},margin:0});
  slide.addText(city.toLocaleUpperCase('es-CO'), {x:3.95,y:3.47,w:8.6,h:1.25,fontFace:'Arial',fontSize:city.length > 20 ? 38 : city.length > 13 ? 47 : 61,bold:true,color:WHITE,margin:0,fit:'shrink'});
}

function addValla(pptx, record, photo, {includePrices = false} = {}) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addBrand(slide, true);
  slide.addShape('rect', {x:.4,y:1.04,w:8.03,h:5.78,line:{color:'E5EAF0',width:1},fill:{color:'E5EAF0'}});
  slide.addImage({data:photo,x:.42,y:1.68,w:7.99,h:4.49});
  const extra = [record.estrato != null && record.estrato !== '' ? `Estrato: ${record.estrato}` : '', record.iluminacion ? `Iluminación: ${record.iluminacion}` : '', record.flujo_personas_vehiculos != null && record.flujo_personas_vehiculos !== '' ? `Flujo personas / vehículos: ${fmt(record.flujo_personas_vehiculos)}` : ''].filter(Boolean);
  if (extra.length) slide.addText(extra.join(' · '), {x:.6,y:6.31,w:7.62,h:.42,fontFace:'Arial',fontSize:11,color:NAVY,margin:0,fit:'shrink'});
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
  const cities = new Set(ordered.map(r => r.ciudad));
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'HERCAS';
  pptx.subject = 'Vallas disponibles';
  pptx.title = 'Vallas disponibles HERCAS';
  pptx.lang = 'es-CO';
  addCover(pptx, ordered.length, cities.size);
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
    if (record.ciudad !== lastCity) { addCity(pptx, record.ciudad, photo); lastCity = record.ciudad; }
    addValla(pptx, record, photo, {includePrices: includePrices === true});
  }
  return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }));
}

// Individual sheets use the same current data and photo as composed proposals.
export async function buildIndividualFiche(record, photo, {includePrices = false} = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'HERCAS';
  pptx.title = `Ficha ${record.codigo}`;
  pptx.lang = 'es-CO';
  addValla(pptx, record, await photoData(photo), {includePrices: includePrices === true});
  return Buffer.from(await pptx.write({outputType:'nodebuffer'}));
}

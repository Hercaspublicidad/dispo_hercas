import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const YELLOW = 'FFCF14';
const WHITE = 'FFFFFF';
const LIGHT = 'D4E0F0';
const fmt = value => value == null ? 'Por confirmar' : new Intl.NumberFormat('es-CO', {maximumFractionDigits:0}).format(Number(value));

async function photoData(input,{width=1600,height=1200,fit='inside'}={}) {
  const jpeg = await sharp(input).rotate().resize(width,height,{fit,withoutEnlargement:fit==='inside'}).jpeg({ quality:70,mozjpeg:true }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

let brandImage;
async function addBrand(slide) {
  brandImage??=readFile(path.join(process.cwd(),'public','brand','hercas-logo.png')).then(bytes=>`image/png;base64,${bytes.toString('base64')}`);
  slide.addImage({data:await brandImage,x:12.15,y:6.54,w:.85,h:.85,altText:'Hercas Publicidad Exterior'});
}

async function addOfficialSlide(pptx,filename) {
  // Embed the supplied artwork unchanged, with no overlays.
  const image=await readFile(path.join(process.cwd(),'public','presentations',filename));
  const slide = pptx.addSlide();
  slide.addImage({data:`image/png;base64,${image.toString('base64')}`,x:0,y:0,w:13.333333,h:7.5});
}

async function addCity(pptx, city, background) {
  const slide = pptx.addSlide();
  const wide=await photoData(Buffer.from(background.split(',')[1],'base64'),{width:1280,height:720,fit:'cover'});
  slide.addImage({data:wide,x:0,y:0,w:13.333333,h:7.5});
  // Match the reference's blue veil, central brand silhouette and yellow bowl.
  const overlay=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00112f" stop-opacity=".78"/><stop offset="1" stop-color="#153c92" stop-opacity=".82"/></linearGradient></defs><rect width="1200" height="675" fill="url(#blue)"/><path d="M575 462V317a104 112 0 0 1 208 0v145Z" fill="#001236" fill-opacity=".5"/><path d="M295 262h78c-2 37-18 62-39 62s-37-25-39-62Z" fill="#ffda00"/></svg>`;
  const veil=await sharp(Buffer.from(overlay)).png().toBuffer();
  slide.addImage({data:`image/png;base64,${veil.toString('base64')}`,x:0,y:0,w:13.333333,h:7.5});
  slide.addText('ZONA', {x:4.27,y:2.72,w:5.8,h:1.14,fontFace:'Montserrat',fontSize:78,bold:true,color:WHITE,transparency:100,outline:{color:WHITE,size:1.7},margin:0,breakLine:false});
  slide.addText(city.toLocaleUpperCase('es-CO'), {x:4.27,y:3.79,w:8.6,h:1.22,fontFace:'Montserrat',fontSize:city.length > 20 ? 43 : city.length > 13 ? 56 : 76,bold:true,color:WHITE,margin:0,fit:'shrink',breakLine:false});
}

let ficheArtwork;
async function ficheImages() {
  ficheArtwork??=Promise.all([
    sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><defs><linearGradient id="g"><stop stop-color="#040a20"/><stop offset=".65" stop-color="#163774"/><stop offset="1" stop-color="#060d25"/></linearGradient></defs><rect width="1200" height="675" fill="#071534"/><path d="M0 0h1200v82H0zM0 579h1200v96H0z" fill="url(#g)"/></svg>')).png().toBuffer(),
    sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="496"><defs><linearGradient id="f"><stop stop-color="#071534" stop-opacity="0"/><stop offset="1" stop-color="#071534"/></linearGradient></defs><rect width="200" height="496" fill="url(#f)"/></svg>')).png().toBuffer(),
  ]).then(images=>images.map(bytes=>`image/png;base64,${bytes.toString('base64')}`));
  return ficheArtwork;
}

async function addValla(pptx, record, photo, {includePrices = false} = {}) {
  const slide=pptx.addSlide();
  slide.background={color:'071534'};
  const [backdrop,fade]=await ficheImages();
  slide.addImage({data:backdrop,x:0,y:0,w:13.333333,h:7.5});
  const portrait=await photoData(Buffer.from(photo.split(',')[1],'base64'),{width:1360,height:992,fit:'cover'});
  slide.addImage({data:portrait,x:0,y:.911111,w:7.555556,h:5.522222});
  slide.addImage({data:fade,x:5.333333,y:.911111,w:2.222223,h:5.522222});
  const text=(value,x,y,w,h,fontSize=15,extra={})=>slide.addText(String(value ?? ''),{x,y,w,h,fontFace:'Arial',fontSize,color:WHITE,margin:0,fit:'shrink',...extra});
  text(record.codigo,.49,.2,8.25,.52,27,{bold:true,color:YELLOW});
  text(`Zona ${record.ciudad || 'por confirmar'}`,8.5,.25,4.45,.45,20,{bold:true,align:'right'});
  const flow=record.flujo_personas_vehiculos;
  text(flow == null ? 'Por confirmar' : fmt(flow),7.82,1.23,5.25,.73,flow == null?30:43,{bold:true});
  text('Flujo personas / vehículos',7.82,1.99,5.25,.35,17,{bold:true});
  text([record.ciudad,record.proveedor].filter(Boolean).join(' · '),7.82,2.52,5.25,.62,22,{bold:true});
  slide.addShape('rect',{x:7.75,y:3.23,w:5.41,h:.065,line:{color:YELLOW,transparency:100},fill:{color:YELLOW}});
  text(record.ubicacion || 'Ubicación por confirmar',7.82,3.51,5.22,.91,14);
  const technical=[record.sentido?`Sentido: ${record.sentido}`:'',record.estructura?`Estructura: ${record.estructura}`:''].filter(Boolean);
  if(technical.length)text(technical.join('\n'),7.82,4.5,5.22,1.45,14);
  const footer=(label,value,x,w)=>{
    slide.addShape('line',{x:x-.16,y:6.71,w:0,h:.54,line:{color:YELLOW,width:1.5}});
    text(label,x,6.67,w,.27,14,{bold:true});
    text(value,x,6.99,w,.37,12);
  };
  footer('Estrato',record.estrato ?? 'Por confirmar',.55,1.3);
  footer('Iluminación',record.iluminacion || 'Por confirmar',2.22,2.05);
  footer('Tamaño',[record.medidas || 'Por confirmar',record.formato || 'Valla exterior'].join('\n'),4.57,2.98);
  slide.addShape('line',{x:7.75,y:6.68,w:0,h:.63,line:{color:LIGHT,width:.5,transparency:40}});
  if(includePrices) {
    text('Arrendamiento / mes · COP',8.06,6.54,3.83,.25,13,{bold:true,color:YELLOW});
    // Keep the amount editable; never invent a minimum price or tax conditions.
    slide.addText([{text:record.tarifa == null?'':'$ '},{text:fmt(record.tarifa)}],{x:8.06,y:6.83,w:3.83,h:.38,fontFace:'Arial',fontSize:20,bold:true,color:YELLOW,margin:0,fit:'shrink'});
    if(record.condicionesComerciales)text(record.condicionesComerciales,8.06,7.2,3.83,.23,9,{color:YELLOW});
  } else text('Confirmar disponibilidad y condiciones.',8.06,6.86,3.83,.37,11,{color:LIGHT});
  await addBrand(slide);
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

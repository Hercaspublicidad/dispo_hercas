import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import JSZip from 'jszip';
import {readFile} from 'node:fs/promises';
import { buildProposal, buildIndividualFiche } from '../lib/proposal-cloud.mjs';

test('PowerPoint masivo incluye portada, separadores y precio editable', async () => {
  const photo = await sharp({create:{width:160,height:90,channels:3,background:'#abcde0'}}).png().toBuffer();
  const records = [
    {codigo:'MV-BAQ-001',ciudad:'Barranquilla',proveedor:'METRO VIAS',ubicacion:'Calle 45',formato:'Valla',medidas:'12 x 4',tarifa:9700000,foto:true,ficha:true},
    {codigo:'ICO-BOG-001',ciudad:'Bogotá',proveedor:'ICO MEDIOS',ubicacion:'Carrera 7',formato:'Valla',medidas:'10 x 4',tarifa:8000000,foto:true,ficha:true},
  ];
  const output = await buildProposal(records, async () => photo, {includePrices:true});
  const zip = await JSZip.loadAsync(output);
  const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
  assert.equal(slides.length, 6);
  const xml = (await Promise.all(slides.map(name => zip.file(name).async('string')))).join('\n');
  for (const text of ['BARRANQUILLA', 'BOGOTÁ', 'MV-BAQ-001']) assert.ok(xml.includes(text), text);
  const cover=await zip.file('ppt/slides/slide1.xml').async('string');
  assert.equal((cover.match(/<p:pic>/g)||[]).length,1);
  assert.ok(!cover.includes('<a:t>'),'la portada oficial no lleva textos superpuestos');
  assert.ok(cover.includes('<a:off x="0" y="0"/>')&&cover.includes('<a:ext cx="12192000" cy="6858000"/>'),'la imagen ocupa toda la diapositiva 16:9');
  const relation=await zip.file('ppt/slides/_rels/slide1.xml.rels').async('string');
  const imageTarget=relation.match(/Target="\.\.\/media\/([^"]+)"[^>]*Type="[^"]*\/image"/)?.[1]
    || relation.match(/Type="[^"]*\/image"[^>]*Target="\.\.\/media\/([^"]+)"/)?.[1];
  assert.ok(imageTarget,'la portada tiene una imagen incrustada');
  assert.deepEqual(await zip.file(`ppt/media/${imageTarget}`).async('nodebuffer'),await readFile(new URL('../public/presentations/portada-hercas.png',import.meta.url)),'se conserva exactamente la imagen entregada');
  const closing=await zip.file('ppt/slides/slide6.xml').async('string');
  assert.equal((closing.match(/<p:pic>/g)||[]).length,1);
  assert.ok(!closing.includes('<a:t>'),'el cierre oficial no lleva textos superpuestos');
  assert.ok(closing.includes('<a:off x="0" y="0"/>')&&closing.includes('<a:ext cx="12192000" cy="6858000"/>'));
  const closingRelation=await zip.file('ppt/slides/_rels/slide6.xml.rels').async('string');
  const closingTarget=closingRelation.match(/Target="\.\.\/media\/([^"]+)"[^>]*Type="[^"]*\/image"/)?.[1]
    || closingRelation.match(/Type="[^"]*\/image"[^>]*Target="\.\.\/media\/([^"]+)"/)?.[1];
  assert.ok(closingTarget);
  assert.deepEqual(await zip.file(`ppt/media/${closingTarget}`).async('nodebuffer'),await readFile(new URL('../public/presentations/cierre-hercas.png',import.meta.url)),'el cierre conserva exactamente la imagen entregada');
  const zone=await zip.file('ppt/slides/slide2.xml').async('string');
  assert.ok(zone.includes('<a:t>ZONA</a:t>')&&zone.includes('<a:t>BARRANQUILLA</a:t>'));
  assert.ok(zone.includes('typeface="Montserrat"'));
  assert.ok(zone.includes('<a:alpha val="0"/>'),'ZONA tiene relleno transparente y contorno blanco');
  assert.ok(zone.includes('<a:ln w="21590">'),'ZONA conserva su contorno');
  assert.equal((zone.match(/<p:pic>/g)||[]).length,2,'foto y velo azul con símbolo, compatibles sin SVG');
  assert.ok(!xml.includes('SIMULACIÓN DE PAUTA HERCAS'));
  assert.ok(!xml.includes('Sentido:')&&!xml.includes('Estructura:'),'los campos vacíos no generan etiquetas sin datos');
  assert.ok(xml.includes('<a:t>9.700.000</a:t>'), 'el precio debe ser texto editable');
});

test('fichas y propuestas omiten precios y condiciones comerciales salvo selección explícita', async () => {
  const photo = await sharp({create:{width:160,height:90,channels:3,background:'#abcde0'}}).webp().toBuffer();
  const record = {codigo:'TEST-CAL-001',ciudad:'Cali',proveedor:'Aliado',tarifa:9876543,condicionesComerciales:'Costo adicional 12345 COP',foto:true,ficha:true};
  for (const includePrices of [undefined, false, true, 'true']) {
    const options = includePrices === undefined ? undefined : {includePrices};
    for (const bytes of [await buildIndividualFiche(record, photo, options), await buildProposal([record], async()=>photo, options)]) {
      const zip = await JSZip.loadAsync(bytes);
      const slides = Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
      const xml = (await Promise.all(slides.map(name=>zip.file(name).async('string')))).join('');
      assert.equal(xml.includes('9.876.543'), includePrices === true);
      assert.equal(xml.includes('TARIFA MENSUAL'), includePrices === true);
      assert.equal(xml.includes('Costo adicional 12345 COP'), includePrices === true);
      assert.ok(xml.includes('TEST-CAL-001'));
    }
  }
});

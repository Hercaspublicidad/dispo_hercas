import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import JSZip from 'jszip';
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
  assert.equal(slides.length, 5);
  const xml = (await Promise.all(slides.map(name => zip.file(name).async('string')))).join('\n');
  for (const text of ['VALLAS', 'DISPONIBLES', 'BARRANQUILLA', 'BOGOTÁ', 'MV-BAQ-001']) assert.ok(xml.includes(text), text);
  assert.ok(!xml.includes('SIMULACIÓN DE PAUTA HERCAS'));
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

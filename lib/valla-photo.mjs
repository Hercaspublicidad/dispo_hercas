import sharp from 'sharp';
import {PHOTO_LIMIT} from './valla-admin.mjs';

export async function prepareVallaPhoto(bytes) {
  if (!bytes.length || bytes.length > PHOTO_LIMIT) throw new Error('La foto debe pesar entre 1 byte y 4 MB.');
  const image = sharp(bytes, {limitInputPixels: 40000000, animated: false});
  const info = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(info.format) || (info.pages || 1) > 1) throw new Error('Selecciona una imagen JPG, PNG o WebP sin animación.');
  return image.rotate().resize({width:2400, height:1800, fit:'inside', withoutEnlargement:true}).webp({quality:85}).toBuffer();
}

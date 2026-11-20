export const THUMBNAIL_REVISION = 'v1';
export const THUMBNAIL_SIZES = {
  card: {width:640,height:360,quality:72},
  admin: {width:160,height:100,quality:65},
};

export function thumbnailUrl(code,version,size='card') {
  return `/api/asset/${encodeURIComponent(code)}/miniatura?size=${size}&v=${encodeURIComponent(version || '')}`;
}

export function thumbnailPath(photo,size='card') {
  if(!Object.hasOwn(THUMBNAIL_SIZES,size) || !/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(photo.codigo) || !/^[a-f0-9]{64}$/.test(photo.sha256))throw new Error('Miniatura inválida.');
  return `${photo.codigo}/miniaturas/${THUMBNAIL_REVISION}/${photo.sha256}/${size}.webp`;
}

export function thumbnailHeaders(photo,size='card') {
  thumbnailPath(photo,size);
  return {'Content-Type':'image/webp','Cache-Control':'private, no-cache',Vary:'Cookie',ETag:`"${THUMBNAIL_REVISION}-${photo.sha256}-${size}"`};
}

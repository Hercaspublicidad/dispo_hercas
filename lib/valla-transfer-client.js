import {PHOTO_LIMIT} from './valla-admin.mjs';

export function downloadTransfer(bytes,name,type='application/zip') {
  const url=URL.createObjectURL(new Blob([bytes],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export async function prepareBrowserTransferImage(image) {
  const blob=new Blob([image.bytes]);
  const bitmap=await createImageBitmap(blob);
  try {
    if(bitmap.width*bitmap.height>40000000)throw new Error('La imagen supera 40 megapíxeles.');
    if(/\.webp$/i.test(image.path) && blob.size<=PHOTO_LIMIT && bitmap.width<=2400 && bitmap.height<=1800)return blob;
    const scale=Math.min(1,2400/bitmap.width,1800/bitmap.height);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const converted=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.85));
    if(!converted || converted.type!=='image/webp' || converted.size>PHOTO_LIMIT)throw new Error('No se pudo preparar la imagen WebP de hasta 4 MB.');
    return converted;
  } finally {bitmap.close();}
}

export async function postTransfer(body,image=null) {
  const form=new FormData();form.append('datos',JSON.stringify(body));if(image)form.append('imagen',image,'imagen.webp');
  const response=await fetch('/api/admin/transfer',{method:'POST',body:form});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error || 'No se pudo importar esta valla.');
  return result;
}

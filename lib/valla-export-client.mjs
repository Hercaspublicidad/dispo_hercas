export async function fetchExportImage(image, {signal, fetcher=fetch, timeoutMs=45000, maxTimeMs=300000, retries=2,onBytes=()=>{}}={}) {
  for(let attempt=0;attempt<=retries;attempt++) {
    if(signal?.aborted)throw new Error('Exportación detenida.');
    const idle=new AbortController(),deadline=AbortSignal.timeout(maxTimeMs);
    let timer;
    const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>idle.abort(new DOMException('Sin avance en la descarga.','TimeoutError')),timeoutMs);};
    const combined=AbortSignal.any([idle.signal,deadline,...(signal?[signal]:[])]);
    arm();onBytes(0,attempt);
    try {
      const response=await fetcher(image.signedUrl,{signal:combined,credentials:'omit'});
      if(!response.ok) {
        await response.body?.cancel();
        const error=new Error(`No se pudo descargar ${image.codigo} (${image.tipo}): HTTP ${response.status}.`);
        error.retryable=response.status===429 || response.status>=500;
        throw error;
      }
      arm();
      let bytes;
      if(response.body?.getReader) {
        const reader=response.body.getReader(),chunks=[];let size=0;
        const cancel=()=>{reader.cancel(combined.reason).catch(()=>{});};
        combined.addEventListener('abort',cancel,{once:true});
        if(combined.aborted)cancel();
        try {
          for(;;) {
            const {done,value}=await reader.read();if(done)break;
            arm();size+=value.length;
            if(size>Number(image.tamano_bytes)) {const error=new Error(`La imagen de ${image.codigo} cambió de tamaño.`);error.retryable=false;await reader.cancel();throw error;}
            chunks.push(value);onBytes(size,attempt);
          }
          if(combined.aborted)throw combined.reason;
          bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
        } finally {combined.removeEventListener('abort',cancel);reader.releaseLock();}
      } else bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length!==Number(image.tamano_bytes)) {
        const error=new Error(`La imagen de ${image.codigo} cambió. Prepara de nuevo la exportación.`);error.retryable=false;throw error;
      }
      return bytes;
    } catch(error) {
      if(signal?.aborted)throw new Error('Exportación detenida.');
      const message=idle.signal.aborted||deadline.aborted ? `Supabase dejó de enviar la imagen de ${image.codigo} (${image.tipo}). Vuelve a intentar este paquete.` : error.message;
      if(error.retryable===false || attempt===retries)throw new Error(message);
      await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    } finally {clearTimeout(timer);}
  }
}

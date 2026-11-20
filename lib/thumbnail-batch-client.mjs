export const thumbnailKey=(record,size='card')=>`${size}|${record.codigo}|${record.fotoVersion ?? record.foto_version ?? ''}`;

export function createThumbnailLoader({fetcher=fetch,now=()=>Date.now(),initialSources=[]}={}) {
  const cache=new Map(),pending=new Map();
  for(const image of initialSources)if(image.url)cache.set(thumbnailKey({codigo:image.codigo,fotoVersion:image.version}),{url:image.url,expiresAt:now()+540000});
  const cached=(record,size)=>{const item=cache.get(thumbnailKey(record,size));return item && item.expiresAt>now()?item.url:null;};
  async function load(records,size='card') {
    const unique=[...new Map(records.map(row=>[thumbnailKey(row,size),row])).values()];
    const needed=unique.filter(row=>!cached(row,size)&&!pending.has(thumbnailKey(row,size)));
    for(let start=0;start<needed.length;start+=50) {
      const batch=needed.slice(start,start+50);
      const request=(async()=>{
        const response=await fetcher('/api/thumbnails',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:batch.map(row=>row.codigo),size}),cache:'no-store',signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error('No se pudieron preparar las miniaturas.');
        const body=await response.json();
        const expiresAt=now()+Math.max(0,Math.min(Number(body.expiresIn)||600,600)-60)*1000;
        const images=new Map(body.images.map(item=>[item.codigo,item]));
        for(const row of batch){const image=images.get(row.codigo);if(image?.url)cache.set(thumbnailKey(row,size),{url:image.url,expiresAt});}
      })();
      for(const row of batch) {
        const key=thumbnailKey(row,size);
        const task=request.then(()=>cached(row,size));pending.set(key,task);
        task.finally(()=>{if(pending.get(key)===task)pending.delete(key);}).catch(()=>{});
      }
    }
    const result=await Promise.all(unique.map(async row=>[row.codigo,cached(row,size) || await pending.get(thumbnailKey(row,size)) || null]));
    return Object.fromEntries(result);
  }
  return {load,cached};
}

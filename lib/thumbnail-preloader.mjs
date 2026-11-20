// Keep decoded images in a bounded, component-owned cache. No cross-user storage.
export function createThumbnailPreloader({createImage=()=>new Image(),concurrency=4,maxImages=100}={}) {
  const loaded=new Map(),pending=new Map();
  let queue=[];
  function pump() {
    while(pending.size<concurrency && queue.length) {
      const url=queue.shift();
      if(loaded.has(url)||pending.has(url))continue;
      const image=createImage();
      pending.set(url,image);
      image.decoding='async';image.fetchPriority='low';
      const finish=success=>{
        image.onload=image.onerror=null;
        pending.delete(url);
        if(success){loaded.set(url,image);while(loaded.size>maxImages)loaded.delete(loaded.keys().next().value);}
        pump();
      };
      image.onload=()=>finish(true);image.onerror=()=>finish(false);
      image.src=url;
    }
  }
  return {
    preload(urls) {
      queue=[...new Set(urls.filter(Boolean))].filter(url=>!pending.has(url)&&!loaded.has(url));
      // Touch retained images so recent pages survive cache eviction.
      for(const url of urls)if(loaded.has(url)){const image=loaded.get(url);loaded.delete(url);loaded.set(url,image);}
      pump();
    },
    clearQueue(){queue=[];},
  };
}

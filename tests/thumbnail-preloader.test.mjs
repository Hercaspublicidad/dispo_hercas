import test from 'node:test';
import assert from 'node:assert/strict';
import {createThumbnailPreloader} from '../lib/thumbnail-preloader.mjs';

function harness(options={}) {
  const images=[];
  const preloader=createThumbnailPreloader({...options,createImage:()=>{
    const image={};images.push(image);return image;
  }});
  return {images,...preloader};
}

test('precarga las 50 fotos siguientes con cuatro descargas simultáneas y reutiliza las completas',()=>{
  const cache=harness();
  const urls=Array.from({length:50},(_,i)=>`https://storage.invalid/${i}.webp`);
  cache.preload(urls);
  assert.equal(cache.images.length,4);
  for(let i=0;i<50;i++) {
    assert.equal(cache.images[i].src,urls[i]);
    assert.equal(cache.images[i].fetchPriority,'low');
    cache.images[i].onload();
    assert.equal(cache.images.length,Math.min(50,i+5));
  }
  cache.preload(urls);
  assert.equal(cache.images.length,50);
});

test('al navegar abandona la cola anterior, comparte descargas pendientes y reintenta errores',()=>{
  const cache=harness({concurrency:1});
  cache.preload(['a','b','c']);
  cache.clearQueue();
  cache.preload(['a','d']);
  assert.equal(cache.images.length,1);
  cache.images[0].onload();
  assert.equal(cache.images[1].src,'d');
  cache.images[1].onerror();
  cache.preload(['a','d']);
  assert.equal(cache.images[2].src,'d');
  cache.images[2].onload();
  assert.equal(cache.images.length,3);
});

test('la caché de imágenes conserva las páginas recientes y limita la memoria',()=>{
  const cache=harness({concurrency:1,maxImages:2});
  cache.preload(['a','b']);cache.images[0].onload();cache.images[1].onload();
  cache.preload(['a']); // a is the most recently used.
  cache.preload(['c']);cache.images[2].onload();
  cache.preload(['a','c']);assert.equal(cache.images.length,3);
  cache.preload(['b']);assert.equal(cache.images[3].src,'b');
});

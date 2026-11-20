'use client';
import {useEffect,useRef,useState} from 'react';
import {THUMBNAIL_SIZES,thumbnailUrl} from '../../lib/valla-thumbnail-config.mjs';

export default function VallaThumbnail({codigo,version,size='card',alt='',source=null,pending=false,priority=false}) {
  const [failure,setFailure]=useState({key:null,index:0}),[loaded,setLoaded]=useState(null);
  const image=useRef(null);
  const candidates=[...new Set([source,thumbnailUrl(codigo,version,size),`/api/asset/${encodeURIComponent(codigo)}/foto?v=${encodeURIComponent(version || '')}`].filter(Boolean))];
  const key=JSON.stringify(candidates),index=failure.key===key?failure.index:0;
  const src=pending&&!source?null:candidates[index];
  const unavailable=!src && !(pending&&!source),ready=!!src && loaded===src;
  const {width,height}=THUMBNAIL_SIZES[size];
  useEffect(()=>{
    if(src && image.current?.complete) {
      if(image.current.naturalWidth>0)setLoaded(src);
      else setFailure({key,index:index+1});
    }
  },[src,key,index]);
  return <span className={`valla-thumbnail ${ready?'is-loaded':unavailable?'is-unavailable':'is-loading'}`} aria-busy={!ready&&!unavailable}>
    {src&&<img ref={image} src={src} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" width={width} height={height} alt={alt} onLoad={()=>setLoaded(src)} onError={()=>setFailure({key,index:index+1})}/>}
    {!ready&&<span className="valla-thumbnail-placeholder" aria-hidden={!unavailable}>{size==='card'?(unavailable?'Foto no disponible':'Cargando foto…'):''}</span>}
  </span>;
}

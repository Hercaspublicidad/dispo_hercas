'use client';
import {useState} from 'react';
import {THUMBNAIL_SIZES,thumbnailUrl} from '../../lib/valla-thumbnail-config.mjs';

export default function VallaThumbnail({codigo,version,size='card',alt=''}) {
  const [failed,setFailed]=useState(null);
  const src=thumbnailUrl(codigo,version,size);
  const {width,height}=THUMBNAIL_SIZES[size];
  return <img src={failed===src ? `/api/asset/${encodeURIComponent(codigo)}/foto?v=${encodeURIComponent(version || '')}` : src} loading="lazy" decoding="async" width={width} height={height} alt={alt} onError={()=>setFailed(src)}/>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import {createThumbnailLoader} from '../../lib/thumbnail-batch-client.mjs';

export default function usePageThumbnails(records,nextRecords=[],size='card',initialSources=[]) {
  const loader=useRef(null),preloaded=useRef(new Map());
  if(!loader.current)loader.current=createThumbnailLoader({initialSources});
  const current=records.filter(row=>row.foto),next=nextRecords.filter(row=>row.foto).slice(0,6);
  const key=JSON.stringify([size,current.map(row=>[row.codigo,row.fotoVersion ?? row.foto_version])]);
  const nextKey=JSON.stringify([size,next.map(row=>[row.codigo,row.fotoVersion ?? row.foto_version])]);
  const [state,setState]=useState({key:null,urls:{},loading:true});
  const live=useRef(null);live.current={current,next,size,key,nextKey};
  useEffect(()=>{
    let active=true,timer;
    const snapshot=live.current;
    const urls=Object.fromEntries(snapshot.current.map(row=>[row.codigo,loader.current.cached(row,snapshot.size)]));
    setState({key:snapshot.key,urls,loading:true});
    loader.current.load(snapshot.current,snapshot.size).then(result=>{if(active)setState({key:snapshot.key,urls:result,loading:false});}).catch(()=>{if(active)setState({key:snapshot.key,urls,loading:false});}).finally(()=>{
      if(!active || !snapshot.next.length)return;
      timer=setTimeout(()=>{
        loader.current.load(snapshot.next,snapshot.size).then(result=>{
          if(!active)return;
          for(const url of Object.values(result)) {
            if(!url || preloaded.current.has(url))continue;
            const image=new Image();image.decoding='async';image.fetchPriority='low';
            image.onload=image.onerror=()=>preloaded.current.delete(url);
            preloaded.current.set(url,image);image.src=url;
          }
        }).catch(()=>{});
      },400);
    });
    return()=>{active=false;clearTimeout(timer);};
  },[key,nextKey]);
  return {
    urls:state.key===key?state.urls:Object.fromEntries(current.map(row=>[row.codigo,loader.current.cached(row,size)])),
    loading:state.key===key?state.loading:true,
  };
}

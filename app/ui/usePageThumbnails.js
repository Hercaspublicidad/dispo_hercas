'use client';
import {useEffect,useRef,useState} from 'react';
import {createThumbnailLoader} from '../../lib/thumbnail-batch-client.mjs';
import {createThumbnailPreloader} from '../../lib/thumbnail-preloader.mjs';

export default function usePageThumbnails(records,nextRecords=[],size='card',initialSources=[]) {
  const loader=useRef(null),preloader=useRef(null);
  if(!loader.current)loader.current=createThumbnailLoader({initialSources});
  if(!preloader.current)preloader.current=createThumbnailPreloader();
  const current=records.filter(row=>row.foto),next=nextRecords.filter(row=>row.foto);
  const key=JSON.stringify([size,current.map(row=>[row.codigo,row.fotoVersion ?? row.foto_version])]);
  const nextKey=JSON.stringify([size,next.map(row=>[row.codigo,row.fotoVersion ?? row.foto_version])]);
  const [state,setState]=useState({key:null,urls:{},loading:true});
  const live=useRef(null);live.current={current,next,size,key,nextKey};
  useEffect(()=>{
    let active=true;
    const snapshot=live.current;
    const urls=Object.fromEntries(snapshot.current.map(row=>[row.codigo,loader.current.cached(row,snapshot.size)]));
    setState({key:snapshot.key,urls,loading:true});
    loader.current.load(snapshot.current,snapshot.size).then(result=>{if(active)setState({key:snapshot.key,urls:result,loading:false});}).catch(()=>{if(active)setState({key:snapshot.key,urls,loading:false});}).finally(()=>{
      if(!active || !snapshot.next.length)return;
      loader.current.load(snapshot.next,snapshot.size).then(result=>{
        if(active)preloader.current.preload(snapshot.next.map(row=>result[row.codigo]));
      }).catch(()=>{});
    });
    return()=>{active=false;preloader.current.clearQueue();};
  },[key,nextKey]);
  return {
    urls:state.key===key?state.urls:Object.fromEntries(current.map(row=>[row.codigo,loader.current.cached(row,size)])),
    loading:state.key===key?state.loading:true,
  };
}

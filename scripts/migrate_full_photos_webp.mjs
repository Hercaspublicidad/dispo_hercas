import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {convertFullPhotoWebP,fullPhotoWebPRecord,isFullPhotoWebP,replaceFullPhotoReference} from '../lib/full-photo-webp.mjs';
import {writePhotoThumbnails} from '../lib/valla-thumbnails.mjs';
import {CODE_PATTERN} from '../lib/valla-admin.mjs';

// Dry run by default. Add --apply to upload WebP and change photo references.
// PNG/JPG Storage objects are deliberately retained as a reversible backup.
const args=process.argv.slice(2),apply=args.includes('--apply');
const option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
const code=option('--code',null),concurrency=Number(option('--concurrency',4));
if(code && !CODE_PATTERN.test(code))throw new Error('Código inválido.');
if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('Concurrencia inválida (1 a 4).');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Falta la configuración de servidor de Supabase.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000)})}});
async function photos() {
  const rows=[];
  for(let start=0;;start+=500) {
    let query=client.from('aliados_valla_archivos').select('*').eq('tipo','foto').eq('bucket','aliados-vallas').order('ruta').range(start,start+499);
    if(code)query=query.eq('codigo',code);
    const result=await query;if(result.error)throw new Error(result.error.message);rows.push(...result.data);if(result.data.length<500)return rows;
  }
}
const current=await photos(),pending=current.filter(photo=>!isFullPhotoWebP(photo));
console.log(JSON.stringify({apply,total:current.length,alreadyWebP:current.length-pending.length,pending:pending.length,sourceBytes:pending.reduce((sum,photo)=>sum+Number(photo.tamano_bytes),0)}));
if(!apply)process.exit(0);
const folder=new URL('../_trabajo_fondos/limpieza_fichas/webp-fotos/',import.meta.url);
await mkdir(folder,{recursive:true});
const manifestFile=new URL('manifest.json',folder);let state={version:1,items:{}};
try{state=JSON.parse(await readFile(manifestFile,'utf8'));if(state.version!==1||!state.items)throw new Error('Manifiesto de respaldo inválido.');}catch(error){if(error.code!=='ENOENT')throw error;}
let writing=Promise.resolve();
const persist=()=>{writing=writing.then(async()=>{const temp=new URL('manifest.tmp',folder);await writeFile(temp,JSON.stringify(state,null,2));await rename(temp,manifestFile);});return writing;};
const groups=new Map();
for(const photo of pending){const group=groups.get(photo.codigo)||[];group.push(photo);groups.set(photo.codigo,group);}
const jobs=[...groups.values()].map(group=>group.sort((a,b)=>Date.parse(a.subido_en)-Date.parse(b.subido_en)));
let next=0,ready=0,failed=0,deduplicated=0,sourceBytes=0,webpBytes=0;const started=Date.now();
await persist();
await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},async()=>{
  while(next<jobs.length) {
    for(const before of jobs[next++]) {
      const id=`${before.codigo}:${before.sha256}`,item=state.items[id]||{};
      item.before=before;item.completed=false;delete item.error;state.items[id]=item;await persist();
      try {
        const storage=client.storage.from('aliados-vallas');
        const source=await storage.download(before.ruta);if(source.error)throw source.error;
        const original=Buffer.from(await source.data.arrayBuffer());
        if(createHash('sha256').update(original).digest('hex')!==before.sha256)throw new Error('El SHA-256 del original no coincide; no se cambió su referencia.');
        const converted=await convertFullPhotoWebP(original),after=fullPhotoWebPRecord(before,converted);
        item.after=after;await persist();
        const localFolder=new URL(`${before.codigo}/`,folder);await mkdir(localFolder,{recursive:true});
        await writeFile(new URL(`${converted.sha256}.webp`,localFolder),converted.bytes);
        const upload=await storage.upload(after.ruta,converted.bytes,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
        if(upload.error && Number(upload.error.statusCode)!==409)throw upload.error;
        const check=await storage.download(after.ruta);if(check.error)throw check.error;
        const remote=Buffer.from(await check.data.arrayBuffer());
        if(remote.length!==converted.bytes.length || createHash('sha256').update(remote).digest('hex')!==converted.sha256)throw new Error('No se pudo verificar el WebP almacenado; se conservó la referencia anterior.');
        await writePhotoThumbnails(storage,after,converted.bytes);
        const result=await replaceFullPhotoReference(client,before,after);
        item.after=result.record;item.completed=true;item.completedAt=new Date().toISOString();await persist();
        ready++;if(result.deduplicated)deduplicated++;sourceBytes+=original.length;webpBytes+=converted.bytes.length;
        if(ready%20===0 || pending.length<=3 || ready+failed===pending.length)console.log(JSON.stringify({ready,failed,total:pending.length,codigo:before.codigo,sourceBytes,webpBytes}));
      } catch(error){failed++;item.error=error.message;await persist();console.error(JSON.stringify({codigo:before.codigo,error:error.message}));}
    }
  }
}));
const final=await photos(),remaining=final.filter(photo=>!isFullPhotoWebP(photo));
console.log(JSON.stringify({ready,failed,deduplicated,remaining:remaining.length,totalPhotos:final.length,sourceBytes,webpBytes,activePhotoBytes:final.reduce((sum,photo)=>sum+Number(photo.tamano_bytes),0),originalObjectsRetained:true,elapsedMs:Date.now()-started}));
if(failed||remaining.length)process.exitCode=1;

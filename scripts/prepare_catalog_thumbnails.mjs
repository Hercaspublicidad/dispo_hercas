import {createClient} from '@supabase/supabase-js';
import {getPhotoThumbnail} from '../lib/valla-thumbnails.mjs';
import {CODE_PATTERN} from '../lib/valla-admin.mjs';

// Optional warm-up: node --env-file=.env.local scripts/prepare_catalog_thumbnails.mjs
// --limit 20, --code TEST-CAL-001, --concurrency 2. Existing thumbnails are reused.
const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
const code=option('--code',null),limit=Number(option('--limit',Number.MAX_SAFE_INTEGER)),concurrency=Number(option('--concurrency',2));
if(code && !CODE_PATTERN.test(code))throw new Error('Código inválido.');
if(!Number.isSafeInteger(limit)||limit<1||!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('Límite inválido o concurrencia fuera de 1 a 4.');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Falta la configuración de servidor de Supabase.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)})}});
const files=[];
for(let start=0;;start+=500) {
  let query=client.from('aliados_valla_archivos').select('codigo,ruta,sha256,subido_en,tamano_bytes').eq('tipo','foto').order('ruta').range(start,start+499);
  if(code)query=query.eq('codigo',code);
  const result=await query;if(result.error)throw new Error(result.error.message);
  files.push(...result.data);if(result.data.length<500)break;
}
const latest=new Map();
for(const photo of files)if(!latest.has(photo.codigo)||String(photo.subido_en)>String(latest.get(photo.codigo).subido_en))latest.set(photo.codigo,photo);
const photos=[...latest.values()].sort((a,b)=>a.codigo.localeCompare(b.codigo)).slice(0,limit);
let next=0,ready=0,failed=0,originalBytes=0,thumbnailBytes=0;
const started=Date.now();
await Promise.all(Array.from({length:Math.min(concurrency,photos.length)},async()=>{
  while(next<photos.length) {
    const photo=photos[next++];
    try {
      const storage=client.storage.from('aliados-vallas');
      const card=await getPhotoThumbnail(storage,photo,'card');
      const admin=await getPhotoThumbnail(storage,photo,'admin');
      ready++;originalBytes+=Number(photo.tamano_bytes);thumbnailBytes+=card.length+admin.length;
      console.log(JSON.stringify({codigo:photo.codigo,ready,total:photos.length,originalBytes:Number(photo.tamano_bytes),cardBytes:card.length,adminBytes:admin.length}));
    } catch(error){failed++;console.error(JSON.stringify({codigo:photo.codigo,error:error.message}));}
  }
}));
console.log(JSON.stringify({ready,failed,originalBytes,thumbnailBytes,elapsedMs:Date.now()-started}));
if(failed)process.exitCode=1;

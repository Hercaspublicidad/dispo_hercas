import {createClient} from '@supabase/supabase-js';
import {mkdir,writeFile} from 'node:fs/promises';
import {CODE_PATTERN} from '../lib/valla-admin.mjs';

// Reviewed composition only. Dry-run by default; originals are never changed.
const args=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index<0?null:args[index+1];};
const code=option('--code'),side=option('--side'),expectedPhoto=option('--photo-sha'),apply=args.includes('--apply');
if(!CODE_PATTERN.test(code||'')||!['izquierda','derecha'].includes(side))throw new Error('Indica --code válido y --side izquierda o derecha.');
if(apply&&!/^[a-f0-9]{64}$/.test(expectedPhoto||''))throw new Error('Para aplicar se requiere --photo-sha de la foto revisada.');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const row=await client.from('aliados_vallas').select('*').eq('codigo',code).single();if(row.error)throw row.error;
if(row.data.datos_fuente?.archivado_en)throw new Error('La valla está archivada.');
const files=await client.from('aliados_valla_archivos').select('codigo,ruta,sha256,subido_en').eq('codigo',code).eq('tipo','foto').order('subido_en',{ascending:false}).limit(1);if(files.error)throw files.error;
const photo=files.data[0];if(!photo)throw new Error('Falta la foto.');
if(expectedPhoto&&photo.sha256!==expectedPhoto)throw new Error('La foto cambió; revisa la nueva composición.');
console.log(JSON.stringify({apply,codigo:code,before:row.data.datos_fuente?.foto_presentacion_lado||'izquierda',after:side,photoSha:photo.sha256}));
if(!apply)process.exit(0);
const folder=new URL('../_trabajo_fondos/limpieza_fichas/lado-presentacion/',import.meta.url);await mkdir(folder,{recursive:true});
await writeFile(new URL(`${code}-${Date.now()}.json`,folder),JSON.stringify({record:row.data,photo,requestedSide:side},null,2));
const result=await client.from('aliados_vallas').update({datos_fuente:{...row.data.datos_fuente,foto_presentacion_lado:side},actualizado_en:new Date().toISOString()}).eq('codigo',code).eq('actualizado_en',row.data.actualizado_en).select('codigo,datos_fuente,actualizado_en').maybeSingle();
if(result.error)throw result.error;if(!result.data)throw new Error('La valla cambió; no se sobrescribieron datos.');
console.log(JSON.stringify({saved:result.data.codigo,side:result.data.datos_fuente.foto_presentacion_lado}));

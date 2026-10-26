import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const preparedPath='D:\\Aliados exteriores\\Fichas_HERCAS_2026\\_migracion_supabase\\preparado.json';
const env=await readFile(path.join(process.cwd(),'.env.upload.local'),'utf8');
const key=env.match(/^SUPABASE_SECRET_KEY=(.+)$/m)?.[1]?.trim();
if (!key) throw new Error('Falta SUPABASE_SECRET_KEY');
const client=createClient('https://mmstapaovlvflbiiqgxv.supabase.co',key,{auth:{persistSession:false}});
const prepared=JSON.parse(await readFile(preparedPath,'utf8'));
async function all(table) {
  const result=[];
  for(let start=0;;start+=500){const {data,error}=await client.from(table).select('*').range(start,start+499);if(error)throw error;result.push(...data);if(data.length<500)return result;}
}
const [rows,assets,events]=await Promise.all([all('aliados_vallas'),all('aliados_valla_archivos'),all('aliados_disponibilidad_eventos')]);
const rowCodes=new Set(rows.map(row=>row.codigo));
const remoteAssets=new Map(assets.map(asset=>[`${asset.codigo}/${asset.tipo}/${asset.sha256}`,asset]));
const missingRows=prepared.rows.filter(row=>!rowCodes.has(row.codigo)).map(row=>row.codigo);
const missingAssets=prepared.assets.filter(asset=>!remoteAssets.has(`${asset.codigo}/${asset.tipo}/${asset.sha256}`)).map(asset=>`${asset.codigo}/${asset.tipo}`);
const wrongSize=prepared.assets.filter(asset=>remoteAssets.has(`${asset.codigo}/${asset.tipo}/${asset.sha256}`)&&Number(remoteAssets.get(`${asset.codigo}/${asset.tipo}/${asset.sha256}`).tamano_bytes)!==asset.tamano_bytes).map(asset=>`${asset.codigo}/${asset.tipo}`);
const byType=Object.fromEntries(['foto','vista','ficha'].map(tipo=>[tipo,assets.filter(asset=>asset.tipo===tipo).length]));
const summary={rows:rows.length,assets:assets.length,byType,events:events.length,missingRows:missingRows.slice(0,20),missingAssets:missingAssets.slice(0,20),missingAssetCount:missingAssets.length,wrongSize:wrongSize.slice(0,20),wrongSizeCount:wrongSize.length};
process.stdout.write(JSON.stringify(summary)+'\n');
if(missingRows.length||missingAssets.length||wrongSize.length||rows.length!==549||assets.length!==1404)process.exitCode=1;

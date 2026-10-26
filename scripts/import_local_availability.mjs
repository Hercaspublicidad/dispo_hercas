import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';

const root='D:\\Aliados exteriores\\Fichas_HERCAS_2026';
const envText=await readFile(path.join(process.cwd(),'.env.upload.local'),'utf8');
const secret=envText.match(/^SUPABASE_SECRET_KEY=(.+)$/m)?.[1]?.trim();
if (!secret) throw new Error('Falta SUPABASE_SECRET_KEY en .env.upload.local');
const client=createClient('https://mmstapaovlvflbiiqgxv.supabase.co',secret,{auth:{persistSession:false}});
const local=JSON.parse(await readFile(path.join(root,'catalogo_disponibilidad.json'),'utf8'));
const {count,error:countError}=await client.from('aliados_disponibilidad_eventos').select('*',{count:'exact',head:true});
if (countError) throw countError;
if (count) throw new Error(`Ya existen ${count} eventos. No se repite la carga histórica.`);
const entries=Object.entries(local).map(([codigo,row])=>({codigo,disponibilidad:row.disponibilidad||'Por confirmar',fecha_fuente:row.fecha||null,observado_en:row.actualizado||new Date().toISOString(),fuente:path.win32.basename(row.fuente||'')||'Archivo local de disponibilidad',notas:row.referencia||'Migración inicial'}));
const {error}=await client.from('aliados_disponibilidad_eventos').insert(entries);
if (error) throw error;
process.stdout.write(`Migrados ${entries.length} eventos de disponibilidad\n`);

import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {inspectLegacyFiches} from '../lib/legacy-fiches.mjs';

// Run with: node --env-file=.env.local scripts/inspect_legacy_fiches.mjs
// This script only reads Supabase. Cleanup runs inside the updated admin panel,
// ensuring the same deployed application can generate replacement fiches.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Falta configurar Supabase en el entorno.');
const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const plan = await inspectLegacyFiches(client);
const folder = new URL('../_trabajo_fondos/limpieza_fichas/',import.meta.url);
await mkdir(folder,{recursive:true});
await writeFile(new URL('inventario.json',folder),JSON.stringify(plan,null,2));
console.log(JSON.stringify({count:plan.count,bytes:plan.bytes,skipped:plan.skipped},null,2));

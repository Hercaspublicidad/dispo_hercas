import { catalogFromSupabase } from '../lib/catalog-supabase.mjs';
import { supabaseServer } from '../lib/supabase-server';
import { hasCatalogManagePermission, hasCatalogAdminRole } from '../lib/catalog-permission.mjs';
import CatalogClient from './ui/CatalogClient';
import {displayRecords} from '../lib/catalog-display.mjs';
import {signKnownThumbnails} from '../lib/thumbnail-batch.mjs';
import {DEFAULT_CATALOG_PAGE_SIZE} from '../lib/catalog-pagination.mjs';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const client = await supabaseServer();
  const {data:{user}} = await client.auth.getUser();
  const [data,canManage,isAdmin] = await Promise.all([catalogFromSupabase(client),user ? hasCatalogManagePermission(client,user.id) : Promise.resolve(false),user ? hasCatalogAdminRole(client,user.id) : Promise.resolve(false)]);
  let initialThumbnailSources=[];
  try {
    const photos=displayRecords(data.records,'ready').slice(0,DEFAULT_CATALOG_PAGE_SIZE).filter(row=>/^[a-f0-9]{64}$/.test(row.fotoVersion || '')).map(row=>({codigo:row.codigo,sha256:row.fotoVersion}));
    initialThumbnailSources=(await signKnownThumbnails(client,photos)).images;
  } catch(error){console.warn('Miniaturas iniciales:',error.message);}
  return <CatalogClient initial={data} canManage={canManage} isAdmin={isAdmin} initialThumbnailSources={initialThumbnailSources}/>;
}

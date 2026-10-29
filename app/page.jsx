import { catalogFromSupabase } from '../lib/catalog-supabase.mjs';
import { supabaseServer } from '../lib/supabase-server';
import { hasCatalogManagePermission, hasCatalogAdminRole } from '../lib/catalog-permission.mjs';
import CatalogClient from './ui/CatalogClient';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const client = await supabaseServer();
  const {data:{user}} = await client.auth.getUser();
  const [data,canManage,isAdmin] = await Promise.all([catalogFromSupabase(client),user ? hasCatalogManagePermission(client,user.id) : Promise.resolve(false),user ? hasCatalogAdminRole(client,user.id) : Promise.resolve(false)]);
  return <CatalogClient initial={data} canManage={canManage} isAdmin={isAdmin} />;
}

import {redirect} from 'next/navigation';
import {supabaseServer} from '../../lib/supabase-server';
import {hasCatalogAdminRole} from '../../lib/catalog-permission.mjs';
import AdminVallas from './AdminVallas';
import './admin.css';

export const dynamic = 'force-dynamic';
export const metadata = {title:'Administrar vallas | HERCAS'};
export default async function AdminPage() {
  const client = await supabaseServer();
  const {data:{user},error} = await client.auth.getUser();
  if (error || !user) redirect('/login?next=/admin');
  if (!await hasCatalogAdminRole(client,user.id)) redirect('/');
  return <AdminVallas />;
}

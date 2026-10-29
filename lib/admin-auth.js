import {supabaseServer} from './supabase-server';
import {hasCatalogAdminRole} from './catalog-permission.mjs';

export async function requireVallaAdmin(request) {
  // Mutations must come from this application, including cookie-authenticated requests.
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return {response: Response.json({error:'Origen de solicitud inválido.'}, {status:403})};
  }
  const client = await supabaseServer();
  const {data:{user}, error} = await client.auth.getUser();
  if (error || !user) return {response: Response.json({error:'Inicia sesión.'}, {status:401})};
  if (!await hasCatalogAdminRole(client, user.id)) return {response: Response.json({error:'Solo el administrador de plataforma puede gestionar vallas.'}, {status:403})};
  return {client, user};
}

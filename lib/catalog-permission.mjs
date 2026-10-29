export async function hasCatalogPermission(supabase, userId) {
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles').select('role').eq('user_id', userId).is('revoked_at', null);
  if (rolesError) throw rolesError;
  const codes = [...new Set((roles ?? []).map(item => item.role).filter(Boolean))];
  if (!codes.length) return false;
  if (codes.includes('systems_admin')) return true;
  const { data: grants, error: grantsError } = await supabase
    .from('role_permissions').select('permission').in('role', codes);
  if (grantsError) throw grantsError;
  return (grants ?? []).some(item =>
    item.permission === 'cotizador.availability.read' || item.permission === 'cotizador.availability.manage');
}

export async function hasCatalogAdminRole(supabase, userId) {
  const {data, error} = await supabase.from('user_roles').select('role').eq('user_id', userId).is('revoked_at', null);
  if (error) throw error;
  return (data || []).some(row => row.role === 'systems_admin');
}

export async function hasCatalogManagePermission(supabase, userId) {
  const { data: roles, error: rolesError } = await supabase.from('user_roles').select('role').eq('user_id', userId).is('revoked_at', null);
  if (rolesError) throw rolesError;
  const codes = [...new Set((roles ?? []).map(item => item.role).filter(Boolean))];
  if (!codes.length) return false;
  const { data: grants, error: grantsError } = await supabase.from('role_permissions').select('permission').in('role', codes);
  if (grantsError) throw grantsError;
  return (grants ?? []).some(item => item.permission === 'cotizador.availability.manage');
}

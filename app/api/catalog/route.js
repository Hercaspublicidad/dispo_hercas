import { catalogFromSupabase } from '../../../lib/catalog-supabase.mjs';
import { supabaseServer } from '../../../lib/supabase-server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const data = await catalogFromSupabase(await supabaseServer());
  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

import { catalog } from '../../../lib/catalog';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json(catalog(), { headers: { 'Cache-Control': 'no-store' } }); }
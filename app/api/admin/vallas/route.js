import {listAdminVallas, saveAdminValla} from '../../../../lib/valla-admin-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const GET = listAdminVallas;
export const POST = request => saveAdminValla(request);

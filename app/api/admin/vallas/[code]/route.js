import {saveAdminValla, archiveAdminValla} from '../../../../../lib/valla-admin-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function PATCH(request, {params}) {return saveAdminValla(request, (await params).code);}
export async function DELETE(request, {params}) {return archiveAdminValla(request, (await params).code);}

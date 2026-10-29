import {createHash} from 'node:crypto';

async function allFiles(client) {
  const files = [];
  for (let start = 0; ; start += 500) {
    const {data,error} = await client.from('aliados_valla_archivos').select('*').order('ruta').range(start,start+499);
    if (error) throw error;
    files.push(...data);
    if (data.length < 500) return files;
  }
}

export function planLegacyFiches(files) {
  const photos = new Set(files.filter(file=>file.tipo === 'foto' && file.bucket === 'aliados-vallas').map(file=>file.codigo));
  const eligible = [], skipped = [];
  for (const file of files) {
    if (file.tipo !== 'ficha') continue;
    if (file.bucket !== 'aliados-vallas' || !file.ruta?.startsWith(`${file.codigo}/ficha/`) || !/\.pptx$/i.test(file.ruta)) {
      skipped.push({codigo:file.codigo, motivo:'Ruta o formato distinto de una ficha PowerPoint.'});
    } else if (!photos.has(file.codigo)) {
      skipped.push({codigo:file.codigo, motivo:'Sin fotografía registrada para generar una ficha nueva.'});
    } else eligible.push(file);
  }
  eligible.sort((a,b)=>a.ruta.localeCompare(b.ruta));
  const bytes = eligible.reduce((sum,file)=>sum+Number(file.tamano_bytes || 0),0);
  const token = createHash('sha256').update(JSON.stringify(eligible)).digest('hex');
  return {files:eligible, count:eligible.length, bytes, skipped, token};
}

export async function inspectLegacyFiches(client) {
  return planLegacyFiches(await allFiles(client));
}

export async function removeLegacyFiches(client, expectedToken, onProgress = ()=>{}) {
  const plan = await inspectLegacyFiches(client);
  if (plan.token !== expectedToken) throw new Error('El inventario cambió. Vuelve a revisar los archivos antes de eliminarlos.');
  let removed = 0, bytes = 0;
  // The caller must run the dynamic-fiche application before using this operation.
  // Delete from Storage API first; a failed request must never erase DB references.
  for (let start = 0; start < plan.files.length; start += 50) {
    const batch = plan.files.slice(start,start+50);
    const {data,error} = await client.storage.from('aliados-vallas').remove(batch.map(file=>file.ruta));
    if (error) throw new Error(`Se retiraron ${removed} fichas antes del error de Storage: ${error.message}`);
    const confirmed = new Set((data || []).map(item=>item.name));
    const deleted = batch.filter(file=>confirmed.has(file.ruta));
    if (deleted.length) {
      const result = await client.from('aliados_valla_archivos').delete().eq('tipo','ficha').eq('bucket','aliados-vallas').in('ruta',deleted.map(file=>file.ruta));
      if (result.error) throw new Error(`Storage eliminó el lote, pero no se pudieron limpiar sus referencias: ${result.error.message}. Conserva el manifiesto para reintentar.`);
      removed += deleted.length;
      bytes += deleted.reduce((sum,file)=>sum+Number(file.tamano_bytes || 0),0);
      await onProgress({removed,bytes});
    }
    if (deleted.length !== batch.length) throw new Error(`Storage confirmó ${deleted.length} de ${batch.length} archivos del lote. Revisa el manifiesto antes de continuar.`);
  }
  return {removed,bytes,skipped:plan.skipped};
}

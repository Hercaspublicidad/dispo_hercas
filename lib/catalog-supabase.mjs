async function fetchAll(client, table, pageSize) {
  const result = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await client.from(table).select('*').range(start, start + pageSize - 1);
    if (error) throw error;
    result.push(...(data || []));
    if (!data || data.length < pageSize) return result;
  }
}

export function mapRemoteCatalog(vallas, archivos, eventos, pendientes, catalogos = []) {
  const assets = new Map();
  for (const file of archivos) {
    const current = assets.get(file.codigo) || {};
    if (!current[file.tipo] || String(file.subido_en || '') > String(current[file.tipo].subido_en || '')) current[file.tipo] = file;
    assets.set(file.codigo, current);
  }
  const latest = new Map();
  for (const event of eventos) {
    const old = latest.get(event.codigo);
    if (!old || String(event.observado_en || '') > String(old.observado_en || '')) latest.set(event.codigo, event);
  }
  const records = vallas.map(v => {
    const source = v.datos_fuente || {};
    const available = latest.get(v.codigo);
    const files = assets.get(v.codigo) || {};
    return {
      codigo: v.codigo,
      codigoProveedor: source.codigo_proveedor || '',
      proveedor: v.proveedor,
      ciudad: v.ciudad,
      ubicacion: v.ubicacion || '',
      categoria: v.categoria || '',
      entorno: source.entorno || '',
      tipoSoporte: source.tipo_soporte || '',
      formato: v.formato || v.categoria || 'Valla exterior',
      medidas: v.medidas || '',
      estadoFicha: v.estado,
      disponibilidad: available?.disponibilidad || source.disponibilidad_fuente || 'No indicada',
      fechaDisponibilidad: available?.fecha_fuente || source.fecha_fuente || null,
      tarifa: v.tarifa_mensual_cop == null ? null : Number(v.tarifa_mensual_cop),
      foto: !!files.foto,
      ficha: !!files.ficha,
      lat: v.latitud == null ? null : Number(v.latitud),
      lon: v.longitud == null ? null : Number(v.longitud),
      revision: source.observacion_calidad || source.revision || '',
      pagina: source.pagina_diapositiva || null,
      archivoFuente: source.archivo_fuente_nombre || '',
    };
  });
  const pendingNew = pendientes.filter(row => row.resultado === 'nuevo' || row.resultado === 'ambiguo').map(row => ({
    id: row.id, ref: row.numero_fila, codigo: row.codigo_propuesto, ...row.datos_fuente, estado: row.resultado,
  }));
  const importHistory = catalogos.filter(row=>row.estado==='aplicado'||row.estado==='revisar').sort((a,b)=>String(b.recibido_en).localeCompare(String(a.recibido_en))).slice(0,20).map(row=>({id:row.id,proveedor:row.proveedor,archivo:row.nombre_original,estado:row.estado,fecha:row.recibido_en}));
  return { records, pendingNew, importHistory };
}

export async function catalogFromSupabase(client, { pageSize = 500 } = {}) {
  const [vallas, archivos, eventos, pendientes, catalogos] = await Promise.all([
    fetchAll(client, 'aliados_vallas', pageSize),
    fetchAll(client, 'aliados_valla_archivos', pageSize),
    fetchAll(client, 'aliados_disponibilidad_eventos', pageSize),
    fetchAll(client, 'aliados_importacion_filas', pageSize),
    fetchAll(client, 'aliados_catalogos', pageSize),
  ]);
  return mapRemoteCatalog(vallas, archivos, eventos, pendientes, catalogos);
}

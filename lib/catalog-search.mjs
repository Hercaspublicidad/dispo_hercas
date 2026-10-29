const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function matchesCatalogSearch(record, query) {
  return normalize([
    record.codigo, record.codigoProveedor, record.datos_fuente?.codigo_proveedor,
    record.proveedor, record.ciudad, record.ubicacion, record.formato,
  ].filter(Boolean).join(' ')).includes(normalize(query));
}

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function mediaKind(record) {
  const place = normalize([record.entorno, record.categoria].join(' '));
  const format = normalize([record.tipoSoporte, record.formato, record.categoria].join(' '));
  const entorno = /aeropuerto|terminal aerea|el dorado/.test(place) ? 'aeropuerto'
    : /centro comercial|\bcc\b|mall/.test(place) ? 'centro_comercial' : 'exterior';
  const soporte = /\bled\b|digital|pantalla/.test(format) ? 'led' : 'estatica';
  return { entorno, soporte };
}

export function markerKind(record) {
  const { entorno, soporte } = mediaKind(record);
  return entorno === 'aeropuerto' ? 'airport' : entorno === 'centro_comercial' ? 'mall' : soporte === 'led' ? 'led' : 'static';
}

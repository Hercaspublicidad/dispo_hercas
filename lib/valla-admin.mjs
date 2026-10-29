export const CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
export const PHOTO_LIMIT = 4 * 1024 * 1024;

export function validateValla(input, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Datos de valla inválidos.');
  const text = (key, max = 250, required = false) => {
    if (input[key] != null && typeof input[key] !== 'string') throw new Error(`Campo inválido: ${key}.`);
    const value = (input[key] || '').trim();
    if ((required && !value) || value.length > max) throw new Error(`Revisa el campo ${key} (máximo ${max} caracteres).`);
    return value;
  };
  const number = (key, min, max) => {
    const value = input[key];
    if (value === '' || value == null) return null;
    if (!['number', 'string'].includes(typeof value)) throw new Error(`Número inválido: ${key}.`);
    const result = Number(value);
    if (!Number.isFinite(result) || result < min || result > max) throw new Error(`Número fuera de rango: ${key}.`);
    return result;
  };
  const codigo = text('codigo', 80, true);
  if (!CODE_PATTERN.test(codigo)) throw new Error('Usa un código como MV-BAQ-001, con mayúsculas, números y guiones.');
  const estado = text('estado', 30, true);
  if (!['completo', 'revision_fuente', 'duplicado_confirmado'].includes(estado)) throw new Error('Estado inválido.');
  const latitud = number('latitud', -90, 90), longitud = number('longitud', -180, 180);
  if ((latitud === null) !== (longitud === null)) throw new Error('Completa ambas coordenadas o deja ambas vacías.');
  const entorno = text('entorno', 40), tipoSoporte = text('tipo_soporte', 40);
  if (entorno && !['exterior', 'aeropuerto', 'centro_comercial'].includes(entorno)) throw new Error('Entorno inválido.');
  if (tipoSoporte && !['estatica', 'led'].includes(tipoSoporte)) throw new Error('Tipo de soporte inválido.');
  return {
    codigo, proveedor: text('proveedor', 150, true), ciudad: text('ciudad', 150, true),
    ubicacion: text('ubicacion', 600, true), formato: text('formato', 150), categoria: text('categoria', 150),
    medidas: text('medidas', 150), tarifa_mensual_cop: number('tarifa_mensual_cop', 0, 1e12),
    latitud, longitud, estado,
    datos_fuente: {...(previous.datos_fuente || {}), gestion_admin: true, entorno,
      tipo_soporte: tipoSoporte, codigo_proveedor: text('codigo_proveedor', 150),
      observacion_calidad: text('observacion_calidad', 1500),
      condiciones_comerciales: text('condiciones_comerciales', 300)},
  };
}

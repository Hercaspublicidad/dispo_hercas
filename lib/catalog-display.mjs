export function displayRecords(records, mode = 'ready') {
  const unique = records.filter(record => record.estadoFicha !== 'duplicado_confirmado');
  if (mode === 'all') return unique;
  if (mode === 'review') return unique.filter(record => !record.foto || !record.ficha);
  return unique.filter(record => record.foto && record.ficha);
}

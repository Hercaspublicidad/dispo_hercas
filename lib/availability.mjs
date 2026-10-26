export function availabilityState(record, now = new Date()) {
  // Array.filter passes its index as the second argument to callbacks.
  if (!(now instanceof Date)) now = new Date();
  if (record.estadoFicha === 'revision_fuente') return 'Revisar fuente';
  if (record.estadoFicha === 'duplicado_confirmado') return 'Duplicado';
  const stamp = /^\d{4}-\d{2}-\d{2}$/.test(String(record.fechaDisponibilidad || ''))
    ? Date.parse(record.fechaDisponibilidad + 'T00:00:00Z') : NaN;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = (today - stamp) / 86400000;
  if (!Number.isFinite(days) || days < 0 || days > 8) return 'Por confirmar';
  if (/no disponible|ocupad|reservad|vendid/i.test(record.disponibilidad || '')) return 'No disponible';
  if (/disponible|libre|vacante/i.test(record.disponibilidad || '')) return 'Disponible';
  return 'Por confirmar';
}

export function canOffer(record, now = new Date()) {
  return record.estadoFicha === 'completo' && !!record.ficha && !!record.foto && availabilityState(record, now) === 'Disponible';
}

export function canSelectForProposal(record) {
  return record.estadoFicha !== 'duplicado_confirmado' && !!record.ficha && !!record.foto;
}

import {canSelectForProposal} from './availability.mjs';

export const PROPOSAL_SELECTION_LIMIT=550;

export function addPageToSelection(current,records) {
  const next=new Set(current);
  for(const record of records)if(canSelectForProposal(record))next.add(record.codigo);
  if(next.size>PROPOSAL_SELECTION_LIMIT)throw new Error(`La presentación admite hasta ${PROPOSAL_SELECTION_LIMIT} vallas. Puedes añadir ${Math.max(0,PROPOSAL_SELECTION_LIMIT-current.length)} más; selecciónalas individualmente o quita otras antes de agregar esta página.`);
  return [...next];
}

export function removePageFromSelection(current,records) {
  const visible=new Set(records.map(record=>record.codigo));
  return current.filter(code=>!visible.has(code));
}

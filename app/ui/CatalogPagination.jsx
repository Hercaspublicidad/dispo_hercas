import {CATALOG_PAGE_SIZES} from '../../lib/catalog-pagination.mjs';

export default function CatalogPagination({pagination,onPage,onSize,position='top'}) {
  const {page,pageCount,pageSize,total,first,last}=pagination;
  if(!total)return null;
  return <nav className="catalog-pagination" aria-label={`Paginación del catálogo (${position==='top'?'superior':'inferior'})`}>
    <p aria-live={position==='top'?'polite':undefined}>Mostrando <strong>{first}–{last}</strong> de <strong>{total}</strong> fichas</p>
    <div className="catalog-page-controls">
      {position==='top'&&<label>Fichas por página<select value={pageSize} onChange={event=>onSize(Number(event.target.value))}>{CATALOG_PAGE_SIZES.map(size=><option key={size} value={size}>{size}</option>)}</select></label>}
      <button type="button" disabled={page===1} onClick={()=>onPage(page-1)}>Anterior</button>
      <label>Página<select value={page} onChange={event=>onPage(Number(event.target.value))}>{Array.from({length:pageCount},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select><span>de {pageCount}</span></label>
      <button type="button" disabled={page===pageCount} onClick={()=>onPage(page+1)}>Siguiente</button>
    </div>
  </nav>;
}

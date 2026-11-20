export const CATALOG_PAGE_SIZES=[30,50];

export function paginateCatalog(records,requestedPage=1,requestedSize=50) {
  const pageSize=CATALOG_PAGE_SIZES.includes(Number(requestedSize))?Number(requestedSize):50;
  const total=records.length,pageCount=Math.max(1,Math.ceil(total/pageSize));
  const numericPage=Number(requestedPage);
  const page=Math.min(pageCount,Math.max(1,Number.isFinite(numericPage)?Math.trunc(numericPage):1));
  const start=(page-1)*pageSize;
  return {items:records.slice(start,start+pageSize),page,pageSize,pageCount,total,first:total?start+1:0,last:Math.min(start+pageSize,total)};
}

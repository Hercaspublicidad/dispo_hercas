import {highlightItems} from '../../lib/valla-highlights.mjs';

export function PropertyHighlights({record}) {
  const highlights=highlightItems(record.destacados);
  return <div className="property-highlights"><h4>Destacados</h4>{highlights.length?<ul>{highlights.map(item=><li key={item.toLocaleLowerCase('es-CO')}>{item}</li>)}</ul>:<span className="property-empty">Sin destacados registrados</span>}</div>;
}

export default function PropertyFeatures({record}) {
  const attributes=[['Tamaño',record.medidas],['Iluminación',record.iluminacion],['Estrato',record.estrato],['Sentido',record.sentido],['Estructura',record.estructura]];
  return <div className="property-features"><h4>Características</h4><dl className="property-attributes">{attributes.map(([label,value])=><div key={label}><dt>{label}</dt><dd title={String(value ?? '')}>{value==null||value===''?'Por confirmar':value}</dd></div>)}</dl><PropertyHighlights record={record}/></div>;
}

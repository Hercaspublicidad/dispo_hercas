import {highlightItems} from '../../lib/valla-highlights.mjs';

export function PropertyHighlights({record}) {
  const highlights=highlightItems(record.destacados);
  return <div className="property-highlights"><h4>Destacados</h4>{highlights.length?<ul className="property-tags">{highlights.map(item=><li key={item.toLocaleLowerCase('es-CO')}>{item}</li>)}</ul>:<span className="property-empty">Sin destacados registrados</span>}</div>;
}

export default function PropertyFeatures({record}) {
  const attributes=[['Tamaño',record.medidas],['Iluminación',record.iluminacion],['Estrato',record.estrato],['Sentido',record.sentido],['Estructura',record.estructura]];
  return <div className="property-features"><h4>Características</h4><ul className="property-tags property-attributes">{attributes.map(([label,value])=><li key={label}><span>{label}: </span><strong>{value==null||value===''?'Por confirmar':value}</strong></li>)}</ul><PropertyHighlights record={record}/></div>;
}

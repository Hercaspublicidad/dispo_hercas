'use client';
import {useState} from 'react';

export default function AdminLegacyFiches() {
  const [plan,setPlan] = useState(null), [busy,setBusy] = useState(false), [message,setMessage] = useState('');
  async function run(remove = false) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/fichas-antiguas',remove
        ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:plan.token})}
        : {cache:'no-store'});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
      if (remove) {
        setPlan(null);
        setMessage(`Se eliminaron ${body.removed} PowerPoint antiguos (${(body.bytes/1e9).toFixed(2)} GB). Las fichas se generan al descargar.`);
      } else setPlan(body);
    } catch(error) {setMessage(error.message);setPlan(null);}
    finally {setBusy(false);}
  }
  const downloadManifest = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}));
    const link = document.createElement('a');link.href=url;link.download='listado-fichas-antiguas.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="admin-help" aria-label="Almacenamiento de fichas">
    <h2>PowerPoint antiguos</h2>
    <p>Las fichas individuales se generan con la foto y los datos actuales. Puedes retirar los PowerPoint guardados por valla para liberar espacio.</p>
    <button className="secondary" disabled={busy} onClick={()=>run()}>{busy?'Procesando…':'Revisar PowerPoint antiguos'}</button>
    {plan&&<div>
      <p><strong>{plan.count} archivos · {(plan.bytes/1e9).toFixed(2)} GB</strong> para retirar. Se conservan las fotos, las vistas previas y las propuestas.</p>
      {plan.skipped.length>0&&<p>{plan.skipped.length} fichas se conservarán porque requieren revisión: {plan.skipped.map(row=>`${row.codigo}: ${row.motivo}`).join(' · ')}</p>}
      <button className="secondary" onClick={downloadManifest}>Descargar listado</button>{' '}
      <button className="admin-delete" disabled={busy||!plan.count} onClick={()=>{
        if(window.confirm(`¿Eliminar definitivamente ${plan.count} PowerPoint antiguos de Supabase? Las fichas nuevas se generarán al descargar.`))run(true);
      }}>Eliminar PowerPoint antiguos</button>
    </div>}
    {message&&<p role="status">{message}</p>}
  </section>;
}

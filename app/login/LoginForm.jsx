'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '../../lib/supabase';
import { hasCatalogPermission } from '../../lib/catalog-permission.mjs';

function safeNext() {
  const value = new URLSearchParams(window.location.search).get('next');
  return value?.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : '/';
}

export default function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('denied'))
      setMessage('Tu cuenta no tiene permiso para consultar disponibilidad.');
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(form.get('email') || '').trim(),
        password: String(form.get('password') || ''),
      });
      if (error) throw new Error('Correo o contraseña incorrectos, o acceso temporalmente limitado.');
      let permitted;
      try {
        permitted = await hasCatalogPermission(supabase, data.user.id);
      } catch {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error('No se pudo validar tu acceso. Inténtalo de nuevo.');
      }
      if (!permitted) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error('Tu cuenta no tiene permiso para consultar disponibilidad.');
      }
      router.replace(safeNext());
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible conectar. Inténtalo de nuevo.');
      setBusy(false);
    }
  }

  return <section className="auth-shell">
    <div className="auth-story">
      <span className="auth-eyebrow">HERCAS · CENTRO COMERCIAL DIGITAL</span>
      <h1>Tu equipo. Un solo lugar.</h1>
      <p>Conecta tus oportunidades, tu equipo y los espacios que hacen visible cada marca.</p>
      <div className="auth-story-foot">Personas conectadas.<br /><strong>Ideas que se ven.</strong></div>
    </div>
    <div className="auth-card">
      <span className="auth-eyebrow">ACCESO SEGURO</span>
      <h2>Bienvenido a Hercas</h2>
      <p>Ingresa con tu cuenta autorizada para continuar.</p>
      <form onSubmit={submit}>
        <label>Correo electrónico
          <input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="tu@empresa.com" />
        </label>
        <label>Contraseña
          <input name="password" type="password" autoComplete="current-password" minLength={1} maxLength={128} required />
        </label>
        <button className="auth-button" disabled={busy}>{busy ? 'Procesando…' : 'Iniciar sesión →'}</button>
      </form>
      {message && <p className="auth-notice" role="status" aria-live="polite">{message}</p>}
      <nav className="auth-links" aria-label="Opciones de acceso">
        <a href="https://hercaspublicidad.com/recuperar">Olvidé mi contraseña</a>
        <a href="https://hercaspublicidad.com/registrarse">Activar una invitación</a>
      </nav>
      <p className="auth-caption">Tus permisos dependen del rol asignado por Hercas.</p>
    </div>
  </section>;
}

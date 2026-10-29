import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { hasCatalogPermission, hasCatalogAdminRole } from './lib/catalog-permission.mjs';

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    && !value.startsWith('/login') && !/[\r\n]/.test(value) ? value : '/';
}

export async function middleware(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new Response('Falta configurar Supabase.', { status: 503 });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: entries => {
        entries.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        entries.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  const signedIn = !error && !!data?.claims;
  const pathname = request.nextUrl.pathname;
  let permitted = false;
  if (signedIn) {
    try {
      permitted = await hasCatalogPermission(supabase, data.claims.sub);
    } catch {
      return new Response('No se pudieron validar los permisos.', { status: 503 });
    }
  }

  if (pathname === '/login') {
    if (!signedIn || !permitted) return response;
    const destination = new URL(safeNext(request.nextUrl.searchParams.get('next')), request.url);
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }
  if (signedIn && permitted) {
    if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
      try {
        if (!await hasCatalogAdminRole(supabase,data.claims.sub)) return pathname.startsWith('/api/')
          ? NextResponse.json({error:'Solo el administrador de plataforma puede gestionar vallas.'},{status:403})
          : NextResponse.redirect(new URL('/',request.url));
      } catch {return new Response('No se pudo validar el acceso de administrador.',{status:503});}
    }
    return response;
  }
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: signedIn ? 'Tu cuenta no tiene permiso para consultar disponibilidad.' : 'Inicia sesión para continuar.' }, { status: signedIn ? 403 : 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const destination = new URL('/login', request.url);
  if (signedIn) destination.searchParams.set('denied', '1');
  else destination.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf)$).*)'],
};

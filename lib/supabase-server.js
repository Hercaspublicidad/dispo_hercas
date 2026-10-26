import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: entries => {
          try { entries.forEach(({ name, value, options }) => jar.set(name, value, options)); }
          catch { /* Server Components cannot set cookies; middleware refreshes the session. */ }
        },
      },
    },
  );
}

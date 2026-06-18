import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sign out. The cleared session cookies must be written onto the SAME response
 * we return (the redirect), otherwise the session cookie survives and the
 * middleware bounces the user straight back to the dashboard. We use the
 * request/response cookie pattern (as in middleware) rather than next/headers
 * cookies(), which does not attach to a custom NextResponse.redirect.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url), 303);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  await supabase.auth.signOut();
  return response;
}

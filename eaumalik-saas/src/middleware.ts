import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const response = await updateSupabaseSession(request);
  // Expose le pathname courant aux Server Components (RootLayout) pour
  // permettre le rendu conditionnel du Footer public.
  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files et API publique spécifique
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

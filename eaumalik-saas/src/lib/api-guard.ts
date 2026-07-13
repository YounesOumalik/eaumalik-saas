/**
 * Helpers de garde et de sérialisation d'erreur pour les route handlers / server actions.
 * - Empêche les fuites de messages d'erreur serveur au client (CWE-209).
 * - Centralise la journalisation côté serveur pour les échecs et 403.
 */
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';

export type RouteHandler<T = unknown> = (
  req: NextRequest,
  context: { params: T },
) => Promise<Response> | Response;

/** Réponse d'erreur générique ; l'erreur réelle est loggée côté serveur. */
export function safeErrorResponse(err: unknown, fallback = 'Erreur interne du serveur') {
  const internalId = crypto.randomUUID();
  // eslint-disable-next-line no-console
  console.error(`[api-guard] ${internalId}`, err);
  return NextResponse.json(
    { error: fallback, incident_id: internalId },
    { status: 500 },
  );
}

/** Réponse normalisée pour les erreurs d'authentification / autorisation. */
export function unauthorized(message = 'Authentification requise') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Accès refusé') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

/** Sanitize un fragment de recherche PostgREST (échappe les caractères spéciaux). */
export function sanitizePostgREST(input: string): string {
  // Caractères interprétés par PostgREST /or /and /.filter syntax :
  // on supprime tout ce qui n'est pas alphanumérique / espace / tiret / apostrophe basic.
  return input.replace(/[%_(),."'\\]/g, '').slice(0, 100);
}

/**
 * Indique si l'application tourne en mode "mocks" (dev local sans Supabase).
 * Utilisé pour court-circuiter l'authentification Supabase dans les route handlers
 * lors des tests / démos en local.
 */
export function isMockMode(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') return true;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

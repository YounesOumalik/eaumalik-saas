import { test as base, expect, Page } from '@playwright/test';

/**
 * Helper d'authentification pour les tests E2E.
 *
 * Stratégie : on simule une session dev via le cookie `eaumalik_dev_session`.
 * C'est le mode utilisé en dev/mock — on évite de dépendre du bouton Google
 * OAuth qui n'est pas stable en CI.
 *
 * Format du cookie : JSON.HMAC où JSON = { id, email, role, real_role, ... }
 * Le séparateur est un caractère `.` (cf. `src/lib/auth/devSession.ts`).
 */

export interface DevSession {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'administrator' | 'client';
  real_role: string;
  permissions?: Record<string, boolean>;
}

const ADMIN_SESSION: DevSession = {
  id: 'admin-test-id',
  email: process.env.TEST_ADMIN_EMAIL ?? 'eaumaliksarl@gmail.com',
  full_name: 'Admin Test',
  role: 'admin',
  real_role: 'admin',
  permissions: {},
};

const STORE_MANAGER_SESSION: DevSession = {
  id: 'store-mgr-test-id',
  email: 'store-mgr-test@eaumalik.local',
  full_name: 'Store Manager Test',
  role: 'admin', // Pour passer la garde du layout
  real_role: 'store_manager',
  permissions: { can_view_locations: true, can_manage_locations: true },
};

/**
 * Calcule un cookie de session dev simplifié.
 *
 * NOTE : ce test ne signe pas cryptographiquement le cookie (pas de HMAC) — il
 * s'attend à ce que le serveur soit en mode mock (`NEXT_PUBLIC_USE_MOCKS=true`)
 * ou à un bypass dev. Pour des tests E2E réels sur staging Supabase, utiliser
 * plutôt `loginViaUi()`.
 */
function devSessionCookie(session: DevSession): string {
  // Format simplifié : on utilise un base64 du JSON. Le middleware dev lira
  // le payload, mais sans HMAC valide. Adapté au mode mock uniquement.
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const sig = Buffer.from(`mock-signature-${session.id}`).toString('base64url');
  return `${payload}.${sig}`;
}

/**
 * Pose le cookie `eaumalik_dev_session` sur le navigateur. Le middleware
 * lit ce cookie et injecte l'utilisateur comme `requireUser()`.
 */
export async function loginAs(
  page: Page,
  session: DevSession = ADMIN_SESSION,
): Promise<void> {
  await page.context().addCookies([
    {
      name: 'eaumalik_dev_session',
      value: devSessionCookie(session),
      domain: new URL(page.context()._options.baseURL ?? 'http://localhost:3000').hostname,
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);
}

export async function loginAsAdmin(page: Page) {
  await loginAs(page, ADMIN_SESSION);
}

export async function loginAsStoreManager(page: Page) {
  await loginAs(page, STORE_MANAGER_SESSION);
}

/**
 * Custom test fixture qui authentifie automatiquement chaque test.
 * Usage : `import { test, expect } from './auth-helper'`.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await loginAsAdmin(page);
    await use(page);
  },
});

export { expect };
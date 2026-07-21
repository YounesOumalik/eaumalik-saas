import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/navigation.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
const { browserSafeOrigin, safeCallbackPath } = await import(moduleUrl);

test('safeCallbackPath preserves a valid same-origin path', () => {
  assert.equal(
    safeCallbackPath('/panier?step=payment#summary', '/client'),
    '/panier?step=payment#summary'
  );
});

test('safeCallbackPath rejects external and ambiguous destinations', () => {
  const unsafeValues = [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '\\evil.example',
    '/\nevil.example',
  ];

  for (const value of unsafeValues) {
    assert.equal(safeCallbackPath(value, '/client'), '/client', value);
  }
});

test('safeCallbackPath uses the requested fallback for an absent value', () => {
  assert.equal(safeCallbackPath(null, '/'), '/');
});

// Régression critique (2026-07-21) : safeCallbackPath NE DOIT PAS filtrer
// /login, /admin, /crm, /api. Ces chemins sont des destinations de redirect
// légitimes pour le middleware (protection routes privées → /login) et le
// callback OAuth. Les filtrait via isHostileLandingPath créait une boucle :
// middleware redirect /login → rejeté → fallback / → l'utilisateur n'atteignait
// jamais /login. Le filtrage des destinations post-login se fait via
// safePostLoginLanding(), pas safeCallbackPath().
test('safeCallbackPath allows auth routes as redirect destinations (no loop)', () => {
  assert.equal(safeCallbackPath('/login', '/'), '/login');
  assert.equal(safeCallbackPath('/login/google-complete', '/'), '/login/google-complete');
  assert.equal(safeCallbackPath('/login?callbackUrl=%2Fclient', '/'), '/login?callbackUrl=%2Fclient');
  assert.equal(safeCallbackPath('/admin', '/'), '/admin');
  assert.equal(safeCallbackPath('/crm/dashboard', '/'), '/crm/dashboard');
  assert.equal(safeCallbackPath('/api/auth/callback?code=x', '/'), '/api/auth/callback?code=x');
});

test('safePostLoginLanding filters hostile post-login destinations', async () => {
  // Re-import pour récupérer safePostLoginLanding (pas dans le import initial).
  const { safePostLoginLanding } = await import(moduleUrl);
  assert.equal(safePostLoginLanding('/client'), '/client');
  assert.equal(safePostLoginLanding('/panier'), '/panier');
  // Routes hostiles → /client (fallback)
  assert.equal(safePostLoginLanding('/login'), '/client');
  assert.equal(safePostLoginLanding('/api/auth/logout'), '/client');
  assert.equal(safePostLoginLanding('/admin/users'), '/client');
  assert.equal(safePostLoginLanding('/crm/dashboard'), '/client');
  // Valeurs invalides → /client
  assert.equal(safePostLoginLanding(null), '/client');
  assert.equal(safePostLoginLanding('https://evil.example'), '/client');
});

test('browserSafeOrigin replaces IPv4 and IPv6 bind addresses with localhost', () => {
  assert.equal(browserSafeOrigin('http://0.0.0.0:3100'), 'http://localhost:3100');
  assert.equal(browserSafeOrigin('http://[::]:3100'), 'http://localhost:3100');
});

test('browserSafeOrigin preserves a valid public browser origin', () => {
  assert.equal(browserSafeOrigin('https://eaumalik.com'), 'https://eaumalik.com');
  assert.throws(() => browserSafeOrigin('ftp://eaumalik.com'), /Origine HTTP invalide/);
});

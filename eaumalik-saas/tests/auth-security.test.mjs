import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScript(path, replacements = []) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8');
  for (const [from, to] of replacements) source = source.replace(from, to);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

test('dev session signatures survive dots in JSON values', async () => {
  process.env.CAPTCHA_SECRET = 'test-only-secret';
  const { signPayload, verifyPayload } = await importTypeScript(
    '../src/lib/auth/devSession.ts',
    [["import 'server-only';", '']]
  );
  const payload = {
    id: 'u-test',
    email: 'user@gmail.com',
    full_name: 'Test User',
    created_at: '2026-07-11T15:52:54.421Z',
  };
  const token = signPayload(payload);
  assert.deepEqual(verifyPayload(token), payload);
  assert.equal(verifyPayload(`${token}x`), null);
});

test('mock passwords are stored as scrypt hashes', async () => {
  const { hashPassword, isHashedPassword, verifyPassword } = await importTypeScript(
    '../src/lib/auth/password.ts',
    [["import 'server-only';", '']]
  );
  const password = 'MockPassword!2026';
  const stored = hashPassword(password);
  assert.notEqual(stored, password);
  assert.equal(isHashedPassword(stored), true);
  assert.equal(verifyPassword(password, stored), true);
  assert.equal(verifyPassword('wrong-password', stored), false);
});

test('protected redirects stay relative to the public browser origin', async () => {
  const { relativeRedirectLocation } = await importTypeScript(
    '../src/lib/relative-redirect.ts',
    [[
      "import { safeCallbackPath } from './navigation';",
      "const safeCallbackPath = (value, fallback = '/') => value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;",
    ]]
  );
  assert.equal(
    relativeRedirectLocation('/login', { callbackUrl: '/client?tab=orders' }),
    '/login?callbackUrl=%2Fclient%3Ftab%3Dorders'
  );
  assert.ok(!relativeRedirectLocation('/login', { callbackUrl: '/client' }).includes('0.0.0.0'));
  assert.ok(!relativeRedirectLocation('/login', { callbackUrl: '/client' }).startsWith('http'));
});

test('clients do not receive staff navigation entries', async () => {
  const source = await readFile(new URL('../src/lib/adminNav.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const { ADMIN_NAV_ITEMS, filterAdminNavItems } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  );
  const clientLinks = filterAdminNavItems(ADMIN_NAV_ITEMS, 'client', null);
  const loadingLinks = filterAdminNavItems(ADMIN_NAV_ITEMS, null, null);
  const staffLinks = filterAdminNavItems(ADMIN_NAV_ITEMS, 'sales', { can_follow_prospects: true });
  assert.deepEqual(clientLinks, []);
  assert.deepEqual(loadingLinks, []);
  assert.equal(staffLinks.some(item => item.href === '/commandes'), true);
});

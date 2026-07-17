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

test('browserSafeOrigin replaces IPv4 and IPv6 bind addresses with localhost', () => {
  assert.equal(browserSafeOrigin('http://0.0.0.0:3100'), 'http://localhost:3100');
  assert.equal(browserSafeOrigin('http://[::]:3100'), 'http://localhost:3100');
});

test('browserSafeOrigin preserves a valid public browser origin', () => {
  assert.equal(browserSafeOrigin('https://eaumalik.com'), 'https://eaumalik.com');
  assert.throws(() => browserSafeOrigin('ftp://eaumalik.com'), /Origine HTTP invalide/);
});

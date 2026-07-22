import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const actionsUrl = new URL('../src/app/actions/cataloguePdfActions.ts', import.meta.url);

test('le module use server du catalogue exporte uniquement des fonctions async', async () => {
  const source = await readFile(actionsUrl, 'utf8');
  const invalidExports = source.match(/^export\s+(?:const|let|var|class|function|\{)/gm) ?? [];

  assert.deepEqual(invalidExports, []);
  assert.match(source, /export async function getCataloguePdfAction\(/);
});

test('la route PDF autorise uniquement son integration same-origin', async () => {
  const { default: nextConfig } = await import('../next.config.mjs');
  const rules = await nextConfig.headers();
  const pdfRule = rules.find((rule) => rule.source === '/api/catalogue/pdf');

  assert.ok(pdfRule, 'La route PDF doit avoir des en-tetes dedies.');
  assert.equal(
    pdfRule.headers.find((header) => header.key === 'X-Frame-Options')?.value,
    'SAMEORIGIN',
  );
  assert.match(
    pdfRule.headers.find((header) => header.key === 'Content-Security-Policy')?.value ?? '',
    /frame-ancestors 'self'/,
  );
});

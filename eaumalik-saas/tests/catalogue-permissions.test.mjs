import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('la suppression définitive d’un produit est réservée au superadmin', async () => {
  const actions = await readFile(new URL('../src/app/actions/productActions.ts', import.meta.url), 'utf8');
  const component = await readFile(new URL('../src/components/admin/CatalogueManager.tsx', import.meta.url), 'utf8');

  assert.match(actions, /ensureSuperAdminOrMock/);
  assert.match(actions, /Suppression définitive réservée au superadministrateur/);
  assert.match(actions, /export async function purgeProductAction[\s\S]*ensureSuperAdminOrMock\(\)/);
  assert.match(component, /isSuperAdmin &&/);
  assert.match(component, /Supprimer définitivement \(superadmin\)/);
});

test('le message d’erreur API du changement de statut est affiché', async () => {
  const component = await readFile(new URL('../src/components/admin/MaintenanceTable.tsx', import.meta.url), 'utf8');

  assert.match(component, /res\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(component, /Impossible de modifier le statut de la maintenance/);
});

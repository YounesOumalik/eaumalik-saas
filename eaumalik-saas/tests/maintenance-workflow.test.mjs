import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('le bouton de gestion ouvre directement la saisie d’intervention', async () => {
  const source = await readFile(new URL('../src/components/admin/MaintenanceTable.tsx', import.meta.url), 'utf8');

  assert.match(source, /setOpenIntervention\(true\)/);
  assert.match(source, /initialShowAdd=\{openIntervention\}/);
  assert.doesNotMatch(source, /router\.push\(`\/admin\/maintenance\?record=/);
});

test('le workflow de maintenance propose arrêt, motif et réactivation', async () => {
  const component = await readFile(new URL('../src/components/admin/MaintenanceTable.tsx', import.meta.url), 'utf8');
  const route = await readFile(new URL('../src/app/api/maintenance/[id]/route.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../supabase/migrations/0020_expose_maintenance_status_reason.sql', import.meta.url), 'utf8');

  assert.match(component, /Suspendre la maintenance/);
  assert.match(component, /Résilier la maintenance/);
  assert.match(component, /Réactiver la maintenance/);
  assert.match(component, /status_reason/);
  assert.match(route, /status_reason: z\.string\(\)/);
  assert.match(migration, /CREATE OR REPLACE VIEW public\.maintenance_records/);
  assert.match(migration, /status_reason/);
});

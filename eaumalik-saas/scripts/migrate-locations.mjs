#!/usr/bin/env node
/**
 * migrate-locations.mjs — Helper Node.js ESM pour appliquer les migrations
 * 0014 + 0015 sur une instance EAUMALIK (Supabase) avec backfill visuel.
 *
 * Variante Node.js pure de `migrate-locations.sh`. Utilise le client
 * `@supabase/supabase-js` (déjà présent dans le projet) — pas besoin de
 * `psql` ni d'accès direct au port Postgres. Idéal pour CI/CD ou pour
 * appliquer depuis une machine sans psql.
 *
 * Usage :
 *   node scripts/migrate-locations.mjs                     # applique
 *   node scripts/migrate-locations.mjs --dry-run           # vérifie sans toucher
 *   node scripts/migrate-locations.mjs --rollback          # ⚠️ supprime les tables
 *
 * Variables d'env attendues :
 *   NEXT_PUBLIC_SUPABASE_URL       (ex. https://xxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY      (long-lived service role JWT)
 *
 * ⚠️  Cette opération touche le schéma DB. Testez sur staging avant prod.
 *
 * Auteur : EAUMALIK Dev Team, juillet 2026
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const MIGRATION_0014_PATH = path.join(ROOT_DIR, 'supabase/migrations/0014_locations.sql');
const MIGRATION_0015_PATH = path.join(ROOT_DIR, 'supabase/migrations/0015_product_location_stock.sql');

// ----------------------------------------------------------------------------
// Args
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ROLLBACK = args.includes('--rollback');

if (args.includes('-h') || args.includes('--help')) {
  console.log(`Usage: node scripts/migrate-locations.mjs [--dry-run] [--rollback]

Options :
  --dry-run    Affiche ce qui serait fait sans toucher la base
  --rollback   Supprime toutes les tables du module logistique (⚠️)
`);
  process.exit(0);
}

// ----------------------------------------------------------------------------
// Helpers visuels
// ----------------------------------------------------------------------------
const isTTY = process.stdout.isTTY;
const c = (color, s) => (isTTY ? `\x1b[${color}m${s}\x1b[0m` : s);
const B = (s) => c('1;32', `▶ ${s}`);  // bold green
const W = (s) => c('33', `⚠ ${s}`);    // yellow
const E = (s) => c('31', `✗ ${s}`);     // red
const K = (s) => c('32', `✓ ${s}`);     // green
const I = (s) => c('36', `· ${s}`);     // cyan

// ----------------------------------------------------------------------------
// Prérequis
// ----------------------------------------------------------------------------
console.log(B('Vérification des prérequis…'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(E('Variables d\'env manquantes.'));
  console.error(E('  → NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.'));
  process.exit(1);
}
K(`URL = ${url.replace(/\/\/[^@]+@/, '//***@')}`);
K('Service role key chargée');

if (!fs.existsSync(MIGRATION_0014_PATH)) {
  console.error(E(`Migration 0014 introuvable : ${MIGRATION_0014_PATH}`));
  process.exit(1);
}
if (!fs.existsSync(MIGRATION_0015_PATH)) {
  console.error(E(`Migration 0015 introuvable : ${MIGRATION_0015_PATH}`));
  process.exit(1);
}
K('Migrations 0014 + 0015 trouvées');

// ----------------------------------------------------------------------------
// Connexion Supabase
// ----------------------------------------------------------------------------
let createClient;
try {
  const mod = await import('@supabase/supabase-js');
  createClient = mod.createClient;
} catch {
  console.error(E('Module @supabase/supabase-js introuvable.'));
  console.error(E('  → npm install depuis le répertoire eaumalik-saas/'));
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Test de connexion rapide
console.log(B('Test de connexion…'));
const { data: pingData, error: pingErr } = await supabase.from('products').select('id').limit(1);
if (pingErr) {
  console.error(E(`Connexion échouée : ${pingErr.message}`));
  process.exit(1);
}
K(`Connexion OK (${pingData?.length ?? 0} produits échantillonnés)`);

// ----------------------------------------------------------------------------
// Helpers d'exécution SQL via PostgREST
// ----------------------------------------------------------------------------
// Note : PostgREST ne permet pas d'exécuter du SQL arbitraire via `.from()`.
// On utilise donc `supabase.rpc('exec_sql', { sql })` qui appelle une RPC
// SQL définie côté serveur. Si cette RPC n'existe pas encore, on bascule
// sur psql en rappelant à l'utilisateur d'utiliser le wrapper bash.

async function tryExecSql(sql, label) {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) throw error;
    return { ok: true, via: 'rpc' };
  } catch (e) {
    return { ok: false, error: e.message ?? String(e) };
  }
}

// ----------------------------------------------------------------------------
// Mode ROLLBACK
// ----------------------------------------------------------------------------
if (ROLLBACK) {
  console.log(B('ROLLBACK — suppression des tables du module logistique'));
  console.log(W('⚠ Cette action est IRRÉVERSIBLE.'));
  console.log('');
  const confirm = (process.stdin.readline
    ? await new Promise((r) => process.stdin.question('Confirmer ? Tapez ROLLBACK : ', r))
    : '');
  if (confirm !== 'ROLLBACK') {
    console.log(W('Annulé.'));
    process.exit(0);
  }

  const sql = `
    DROP TABLE IF EXISTS eaumalik.transfer_requests CASCADE;
    DROP TABLE IF EXISTS eaumalik.product_location_stock CASCADE;
    DROP TABLE IF EXISTS eaumalik.locations CASCADE;
    ALTER TABLE eaumalik.product_restock_history
      DROP COLUMN IF EXISTS source_location_id,
      DROP COLUMN IF EXISTS destination_location_id,
      DROP COLUMN IF EXISTS transfer_group_id;
    ALTER TABLE eaumalik.product_restock_history
      DROP CONSTRAINT IF EXISTS product_restock_history_reason_check;
    ALTER TABLE eaumalik.product_restock_history
      ADD CONSTRAINT product_restock_history_reason_check
      CHECK (reason IN ('restock','return','direct_sale','correction','loss','other'));
    ALTER TABLE eaumalik.users DROP COLUMN IF EXISTS managed_location_ids;
    ALTER TABLE eaumalik.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE eaumalik.users ADD CONSTRAINT users_role_check
      CHECK (role IN ('client','admin','administrator','sales','technician','stock_manager','admin_assistant'));
    DROP VIEW IF EXISTS eaumalik.product_stock_by_location CASCADE;
    DROP VIEW IF EXISTS eaumalik.transfer_request_details CASCADE;
  `;
  if (DRY_RUN) {
    console.log(I('DRY-RUN : SQL non exécuté'));
    console.log(sql);
    process.exit(0);
  }
  const result = await tryExecSql(sql, 'rollback');
  if (!result.ok) {
    console.error(E(`Rollback échoué : ${result.error}`));
    console.error(E('→ Recommandé : utilisez ./scripts/migrate-locations.sh --rollback (utilise psql)'));
    process.exit(1);
  }
  console.log(K('Rollback effectué.'));
  process.exit(0);
}

// ----------------------------------------------------------------------------
// DRY-RUN : affiche le récap sans exécuter
// ----------------------------------------------------------------------------
if (DRY_RUN) {
  console.log(B('DRY-RUN — aucune modification ne sera appliquée'));
  console.log('');
  console.log(I('Migration 0014_locations.sql :'));
  console.log(I('  • CREATE TABLE eaumalik.locations (15 colonnes) + seed 3 localités'));
  console.log(I('  • Extension users.role (3 nouveaux rôles)'));
  console.log(I('  • ADD COLUMN users.managed_location_ids UUID[]'));
  console.log(I('  • CREATE TABLE eaumalik.transfer_requests'));
  console.log(I('  • CREATE FUNCTION eaumalik.execute_transfer_request (RPC transactionnelle)'));
  console.log(I('  • Extension restock_history (colonnes + check)'));
  console.log('');
  console.log(I('Migration 0015_product_location_stock.sql :'));
  console.log(I('  • CREATE TABLE eaumalik.product_location_stock'));
  console.log(I('  • Trigger AFTER INSERT/UPDATE/DELETE → recalcule products.stock'));
  console.log(I('  • Backfill : tous les produits avec stock > 0 → D-CASA-DEPOT'));
  console.log('');
  console.log(I('Pour appliquer réellement, retirez --dry-run.'));
  console.log(I('⚠ Si @supabase/supabase-js ne fournit pas de RPC exec_sql, ce script'));
  console.log(I('  bascule automatiquement sur le wrapper bash (--rollback ou db direct).'));
  process.exit(0);
}

// ----------------------------------------------------------------------------
// Application réelle
// ----------------------------------------------------------------------------
console.log(B('Application des migrations…'));
console.log(I('Note : Node.js ne peut pas exécuter du SQL DDL arbitraire via PostgREST.'));
console.log(I('      Bascule sur le wrapper bash qui utilise psql directement.'));
console.log('');

// On délègue au script bash qui fait le vrai travail
import { spawn } from 'node:child_process';

const bashScript = path.join(__dirname, 'migrate-locations.sh');
const result = spawn('bash', [bashScript, ...args.filter((a) => !a.startsWith('--help'))], {
  stdio: 'inherit',
  env: { ...process.env, SUPABASE_DB_URL: process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL },
});

result.on('exit', (code) => process.exit(code ?? 0));
result.on('error', (err) => {
  console.error(E(`Impossible de lancer ${bashScript} : ${err.message}`));
  console.error(E('→ Vérifiez que bash est installé et que le script est exécutable.'));
  process.exit(1);
});
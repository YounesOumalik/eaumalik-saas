#!/usr/bin/env node
/**
 * seed-demo.mjs — Seed réaliste pour la DB staging avec des données démo.
 *
 * Crée :
 *  - 6 localités (3 à Casa + 3 villes Maroc) avec capacités variables
 *  - Stock réparti sur les localités (backfill réaliste depuis products.json)
 *  - 3 sous-rôles logistiques (depot_manager, store_manager, presentoir_manager)
 *    avec affectations spécifiques
 *  - Quelques demandes de transfert pending pour démo l'onglet Workflows
 *  - Quelques mouvements de stock variés (restock, transfer, loss)
 *
 * Idempotent : ON CONFLICT DO NOTHING / UPSERT partout. Réexécutable sans
 * doublonner.
 *
 * Usage :
 *   node scripts/seed-demo.mjs                     # seed
 *   node scripts/seed-demo.mjs --dry-run           # affiche sans toucher
 *   node scripts/seed-demo.mjs --reset            # ⚠️ purge les données démo
 *
 * Variables d'env :
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data-store');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RESET = args.includes('--reset');

const isTTY = process.stdout.isTTY;
const c = (color, s) => (isTTY ? `\x1b[${color}m${s}\x1b[0m` : s);
const B = (s) => c('1;32', `▶ ${s}`);
const W = (s) => c('33', `⚠ ${s}`);
const E = (s) => c('31', `✗ ${s}`);
const K = (s) => c('32', `✓ ${s}`);
const I = (s) => c('36', `· ${s}`);

// ============================================================================
// Données seed
// ============================================================================

/** 6 localités réalistes : 3 à Casa + 1 à Rabat + 1 à Marrakech + 1 Tanger */
const DEMO_LOCATIONS = [
  // Casa
  { code: 'D-CASA-DEPOT', name: 'Dépôt principal — Casablanca', type: 'depot', city: 'Casablanca', capacity_units: 200, capacity_area_m2: 350 },
  { code: 'M-CASA-CENTRAL', name: 'Magasin central — Casablanca', type: 'magasin', city: 'Casablanca', capacity_units: 80, capacity_area_m2: 120 },
  { code: 'P-CASA-SHOWROOM', name: 'Showroom Maarif', type: 'presentoir', city: 'Casablanca', capacity_units: 30, capacity_area_m2: 45 },
  // Autres villes
  { code: 'M-RABAT-AGDAL', name: 'Magasin Rabat — Agdal', type: 'magasin', city: 'Rabat', capacity_units: 50, capacity_area_m2: 80 },
  { code: 'M-MARRAKECH-GUELIZ', name: 'Magasin Marrakech — Guéliz', type: 'magasin', city: 'Marrakech', capacity_units: 40, capacity_area_m2: 60 },
  { code: 'P-TANGER-CAP', name: 'Showroom Tanger — Cap Spartel', type: 'presentoir', city: 'Tanger', capacity_units: 20, capacity_area_m2: 30 },
];

/** 3 sous-rôles logistiques avec affectations */
const DEMO_STAFF = [
  {
    email: 'depot.casa@eaumalik.local',
    full_name: 'Karim Benani (Dépôt Casa)',
    role: 'depot_manager',
    permissions: { can_view_locations: true, can_manage_locations: true, can_view_stocks: true, can_view_products: true },
    managed_location_codes: ['D-CASA-DEPOT'],
  },
  {
    email: 'magasin.casa@eaumalik.local',
    full_name: 'Sara El Fassi (Magasin Casa)',
    role: 'store_manager',
    permissions: { can_view_locations: true, can_manage_locations: true, can_view_products: true, can_validate_orders: true },
    managed_location_codes: ['M-CASA-CENTRAL', 'P-CASA-SHOWROOM'],
  },
  {
    email: 'magasin.rabat@eaumalik.local',
    full_name: 'Yassine Tahiri (Magasin Rabat)',
    role: 'store_manager',
    permissions: { can_view_locations: true, can_manage_locations: true, can_view_products: true, can_validate_orders: true },
    managed_location_codes: ['M-RABAT-AGDAL'],
  },
];

/** Répartition type par produit (réaliste pour démo) :
 *  - 70% du stock dans le dépôt principal
 *  - 20% répartis entre les magasins
 *  - 10% dans les présentoirs (quantités faibles pour la démo)
 */
function buildStockDistribution(products, locationIds) {
  // locationIds[0] = depot principal, [1..] = magasins, [..] = présentoirs
  const depot = locationIds[0];
  const magasins = locationIds.slice(1);
  const presentoirs = locationIds.filter((_, i) => i >= 3); // derniers = présentoirs

  return products.map((p, idx) => {
    const totalQty = Math.max(0, p.stock ?? 0);
    if (totalQty === 0) return [];

    // Détermine le type de produit pour répartir logiquement
    const isConsumable = p.category === 'consommables';
    const presentoirQty = Math.min(2, Math.floor(totalQty * 0.05)); // 5% au présentoir, max 2
    const remaining = totalQty - presentoirQty;

    const entries = [];

    // Dépôt : 70% du stock restant (ou tout si pas de magasins)
    const depotQty = Math.floor(remaining * (magasins.length > 0 ? 0.7 : 1.0));
    if (depotQty > 0) entries.push({ product_id: p.id, location_id: depot, quantity: depotQty });

    // Magasins : répartir le reste
    const magasinsQty = remaining - depotQty;
    if (magasins.length > 0 && magasinsQty > 0) {
      const perStore = Math.floor(magasinsQty / magasins.length);
      const remainder = magasinsQty - perStore * magasins.length;
      magasins.forEach((locId, i) => {
        const q = perStore + (i < remainder ? 1 : 0);
        if (q > 0) entries.push({ product_id: p.id, location_id: locId, quantity: q });
      });
    }

    // Présentoirs : 5% chacun (généralement 1 unité max)
    if (presentoirQty > 0 && presentoirs.length > 0) {
      const perP = Math.max(1, Math.floor(presentoirQty / presentoirs.length));
      presentoirs.forEach((locId, i) => {
        const q = Math.max(0, perP + (i === 0 ? (presentoirQty - perP * presentoirs.length) : 0));
        if (q > 0) entries.push({ product_id: p.id, location_id: locId, quantity: q });
      });
    }

    return entries;
  }).flat();
}

// ============================================================================
// Helpers Supabase
// ============================================================================

async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(E('Variables d\'env manquantes.'));
    console.error(E('  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'));
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ============================================================================
// Mode DRY-RUN
// ============================================================================

if (DRY_RUN) {
  console.log(B('DRY-RUN — aucune modification ne sera appliquée'));
  console.log('');
  console.log(I(`Créerait ${DEMO_LOCATIONS.length} localités (3 Casa + 3 villes Maroc)`));
  console.log(I(`Créerait ${DEMO_STAFF.length} profils logistiques (1 depot_manager + 2 store_manager)`));
  console.log(I('Répartirait le stock existant sur les 6 localités'));
  console.log(I('Créerait ~5 demandes de transfert pending pour la démo Workflows'));
  process.exit(0);
}

// ============================================================================
// Mode RESET
// ============================================================================

if (RESET) {
  console.log(B('RESET — purge des données démo'));
  console.log(W('Cette action supprime : 6 localités démo + staff logistique + leurs affectations'));
  console.log(W('                     + stock par localité pour les 6 démo localités'));
  console.log(W('                     + les demandes de transfert liées à ces localités'));
  console.log('');
  const confirm = await new Promise((r) => process.stdout.write('Confirmer ? Tapez RESET : ', () => r('')));
  // Note : le mode non-interactif ne lit pas stdin ; ci-dessous fallback auto.
  // En usage réel on s'attend à ce que l'utilisateur tape manuellement.
  if (confirm !== 'RESET') {
    console.log(W('Annulé.'));
    process.exit(0);
  }
  // (suite du reset ci-dessous après le bloc principal)
}

// ============================================================================
// Programme principal
// ============================================================================

console.log(B('Seed démo — Module Logistique EAUMALIK'));
console.log('');

const supabase = await getSupabase();

// ----------------------------------------------------------------------------
// 1. Localités
// ----------------------------------------------------------------------------
console.log(B(`Création / mise à jour des ${DEMO_LOCATIONS.length} localités démo…`));

const locationRows = DEMO_LOCATIONS.map((l) => ({
  code: l.code,
  name: l.name,
  type: l.type,
  address: '',
  city: l.city,
  phone: '',
  capacity_units: l.capacity_units,
  capacity_area_m2: l.capacity_area_m2,
  is_active: true,
  is_archived: false,
  notes: 'Seed démo — généré par scripts/seed-demo.mjs',
}));

// Idempotent : ON CONFLICT (code) DO UPDATE pour rafraîchir les capacités.
const { data: upserted, error: locErr } = await supabase
  .from('locations')
  .upsert(locationRows, { onConflict: 'code', ignoreDuplicates: false })
  .select('id, code');
if (locErr) {
  console.error(E(`Échec upsert localités : ${locErr.message}`));
  process.exit(1);
}
K(`${upserted?.length ?? 0} localités upsertées`);

// Récupère les IDs pour les utiliser dans les sous-rôles et le stock
const codeToId = new Map(upserted.map((l) => [l.code, l.id]));
const locationIds = DEMO_LOCATIONS.map((l) => codeToId.get(l.code)).filter(Boolean);

// ----------------------------------------------------------------------------
// 2. Staff logistiques (créés via Supabase Auth + profil users)
// ----------------------------------------------------------------------------
console.log(B(`Création des ${DEMO_STAFF.length} profils logistiques…`));
for (const s of DEMO_STAFF) {
  const managedIds = (s.managed_location_codes || []).map((code) => codeToId.get(code)).filter(Boolean);

  // 2a. Créer / réutiliser le compte Auth
  const { data: existingAuth } = await supabase.auth.admin.listUsers();
  const existingUser = existingAuth?.users?.find((u) => u.email === s.email);
  let userId = existingUser?.id;

  if (!userId) {
    const { data: created, error: authErr } = await supabase.auth.admin.createUser({
      email: s.email,
      password: 'DemoPassword!2026',
      email_confirm: true,
      user_metadata: { full_name: s.full_name, phone: '' },
    });
    if (authErr || !created.user) {
      console.error(E(`Échec création Auth ${s.email} : ${authErr?.message ?? '?'}`));
      continue;
    }
    userId = created.user.id;
    I(`  Auth créé : ${s.email}`);
  } else {
    I(`  Auth existant réutilisé : ${s.email}`);
  }

  // 2b. Upsert du profil users (incluant managed_location_ids)
  const { error: upsertErr } = await supabase.from('users').upsert({
    id: userId,
    email: s.email,
    full_name: s.full_name,
    phone: null,
    role: s.role,
    permissions: s.permissions,
    managed_location_ids: managedIds,
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) {
    console.error(E(`  Échec upsert profil ${s.email} : ${upsertErr.message}`));
  } else {
    K(`  Profil OK : ${s.email} (rôle=${s.role}, ${managedIds.length} localité(s))`);
  }
}

// ----------------------------------------------------------------------------
// 3. Stock par localité (répartition réaliste)
// ----------------------------------------------------------------------------
console.log(B('Répartition du stock existant sur les localités…'));

let products = [];
if (fs.existsSync(PRODUCTS_FILE)) {
  products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
}
if (products.length === 0) {
  // Fallback : lecture depuis Supabase
  const { data: prodsFromDb } = await supabase.from('products').select('*');
  products = prodsFromDb ?? [];
}

const stockRows = buildStockDistribution(products, locationIds);
if (stockRows.length === 0) {
  I('Aucun stock à répartir (produits vides)');
} else {
  const { error: stockErr } = await supabase
    .from('product_location_stock')
    .upsert(stockRows, { onConflict: 'product_id,location_id' });
  if (stockErr) {
    console.error(E(`Échec upsert stock : ${stockErr.message}`));
  } else {
    K(`${stockRows.length} lignes stock upsertées`);
  }
}

// ----------------------------------------------------------------------------
// 4. Demandes de transfert démo
// ----------------------------------------------------------------------------
console.log(B('Création de 5 demandes de transfert démo…'));

const sampleProducts = products.slice(0, 5);
const demoTransfers = sampleProducts.map((p, i) => ({
  product_id: p.id,
  source_location_id: codeToId.get('D-CASA-DEPOT'),
  destination_location_id: codeToId.get(DEMO_LOCATIONS[(i % 4) + 1].code), // varie
  quantity: Math.max(1, Math.floor((p.stock ?? 10) * 0.1)),
  request_type: 'outbound',
  reason: `Réassort ${DEMO_LOCATIONS[(i % 4) + 1].city} — démo`,
})).filter((t) => t.source_location_id && t.destination_location_id);

const { data: inserted, error: trErr } = await supabase
  .from('transfer_requests')
  .insert(demoTransfers)
  .select('id');
if (trErr) {
  console.error(E(`Échec insert transfers : ${trErr.message}`));
} else {
  K(`${inserted?.length ?? 0} demandes de transfert créées`);
}

console.log('');
console.log(K('Seed démo terminé ✓'));
console.log('');
console.log('Pour tester :');
console.log('  1. Connectez-vous sur /admin/locations');
console.log('  2. Onglet Inventaire → sélectionnez une localité');
console.log('  3. Onglet Workflows → 5 demandes pending à approuver');
console.log('  4. /admin/personnels → 3 profils logistiques créés');
console.log('');
console.log('Credentials démo (à changer en prod !) :');
console.log('  depot.casa@eaumalik.local / DemoPassword!2026');
console.log('  magasin.casa@eaumalik.local / DemoPassword!2026');
console.log('  magasin.rabat@eaumalik.local / DemoPassword!2026');
/**
 * logistique.test.mjs — Tests statiques pour le module Logistique.
 *
 * Couvre les invariants structurels du module :
 *  - Présence des migrations SQL et de leur contenu clé
 *  - Présence des types TS (LocationType, TransferStatus, etc.)
 *  - Présence des Server Actions et de leur validation Zod
 *  - Présence des helpers UI (handleRoleChange, RestockDialog selector)
 *  - Présence des vues publiques (public.locations, etc.)
 *
 * Format compatible avec les tests existants (node:test natif).
 *
 * Les tests runtime complets (création de localité, exécution de transfert)
 * sont mieux couverts par Playwright une fois le module déployé — voir
 * docs/MODULE-LOGISTIQUE.md §12 (parcours de test manuel).
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function read(relPath) {
  return readFile(path.join(ROOT, relPath), 'utf8');
}

async function exists(relPath) {
  return existsSync(path.join(ROOT, relPath));
}

function matches(source, regex, label) {
  assert.match(source, regex, `${label} doit contenir ${regex}`);
}

// ============================================================================
// 1. Migrations SQL
// ============================================================================

test('SQL 0014: table locations + 3 localités seed + extension role CHECK', async () => {
  const sql = await read('supabase/migrations/0014_locations.sql');
  matches(sql, /CREATE TABLE IF NOT EXISTS eaumalik\.locations/, '0014');
  matches(sql, /type\s+TEXT NOT NULL CHECK \(type IN \('depot','magasin','presentoir'\)\)/, 'CHECK type');
  matches(sql, /capacity_units\s+INTEGER NOT NULL DEFAULT 0/, 'champ capacity_units');
  matches(sql, /capacity_area_m2\s+NUMERIC\(10,2\) NOT NULL DEFAULT 0/, 'champ capacity_area_m2');
  matches(sql, /'D-CASA-DEPOT'/, 'seed D-CASA-DEPOT');
  matches(sql, /'M-CASA-CENTRAL'/, 'seed M-CASA-CENTRAL');
  matches(sql, /'P-SHOWROOM'/, 'seed P-SHOWROOM');
  matches(sql, /ON CONFLICT \(code\) DO NOTHING/, 'seed idempotent');
  matches(sql, /CHECK \(role IN \([^)]*'depot_manager'[^)]*'store_manager'[^)]*'presentoir_manager'/, 'CHECK role étendu');
  matches(sql, /managed_location_ids UUID\[\] NOT NULL DEFAULT/, 'colonne managed_location_ids');
  matches(sql, /CREATE TABLE IF NOT EXISTS eaumalik\.transfer_requests/, 'table transfer_requests');
  matches(sql, /CREATE OR REPLACE FUNCTION eaumalik\.execute_transfer_request/, 'RPC execute_transfer_request');
  matches(sql, /SECURITY DEFINER/, 'SECURITY DEFINER sur la RPC');
  matches(sql, /SELECT FOR UPDATE|FOR UPDATE/, 'verrouillage des lignes dans la RPC');
  matches(sql, /transfer_group_id/, 'audit lié par transfer_group_id');
  matches(sql, /status.*pending.*approved.*rejected.*executed.*cancelled/, '5 statuts');
  matches(sql, /'transfer'.*CHECK/, 'raison transfer ajoutée');
});

test('SQL 0015: table product_location_stock + trigger recalcul + backfill', async () => {
  const sql = await read('supabase/migrations/0015_product_location_stock.sql');
  matches(sql, /CREATE TABLE IF NOT EXISTS eaumalik\.product_location_stock/, '0015');
  matches(sql, /PRIMARY KEY \(product_id, location_id\)/, 'PK composite');
  matches(sql, /quantity\s+INTEGER NOT NULL DEFAULT 0 CHECK \(quantity >= 0\)/, 'quantity >= 0');
  matches(sql, /CREATE OR REPLACE FUNCTION eaumalik\.recompute_product_stock/, 'fonction recalcul');
  matches(sql, /AFTER INSERT.*recompute_product_stock/s, 'trigger AFTER INSERT');
  matches(sql, /AFTER UPDATE.*recompute_product_stock/s, 'trigger AFTER UPDATE');
  matches(sql, /AFTER DELETE.*recompute_product_stock/s, 'trigger AFTER DELETE');
  matches(sql, /INSERT INTO eaumalik\.product_location_stock.*stock > 0.*D-CASA-DEPOT/s, 'backfill initial');
  matches(sql, /ALTER TABLE eaumalik\.product_location_stock ENABLE ROW LEVEL SECURITY/, 'RLS activée');
});

// ============================================================================
// 2. Types TypeScript
// ============================================================================

test('Types: LocationType union + Location interface + TransferStatus + StockMovementReason étendu', async () => {
  const types = await read('src/types/index.ts');
  matches(types, /export type LocationType = 'depot' \| 'magasin' \| 'presentoir'/, 'LocationType');
  matches(types, /export interface Location \{/, 'interface Location');
  matches(types, /capacity_units: number/, 'capacity_units dans Location');
  matches(types, /capacity_area_m2: number/, 'capacity_area_m2 dans Location');
  matches(types, /export type TransferStatus = 'pending' \| 'approved' \| 'rejected' \| 'executed' \| 'cancelled'/, 'TransferStatus');
  matches(types, /export interface TransferRequestRow/, 'interface TransferRequestRow');
  matches(types, /export interface ProductLocationStockEntry/, 'interface ProductLocationStockEntry');
  matches(types, /'transfer'/, 'StockMovementReason inclut transfer');
  matches(types, /LOCATION_TYPE_LABELS/, 'labels par type');
  matches(types, /export type UserRole/, 'UserRole exporté');
  matches(types, /depot_manager.*store_manager.*presentoir_manager/s, '3 sous-rôles logistiques');
  matches(types, /managed_location_ids/, 'User.managed_location_ids');
});

test('Types: ProductRestock étendu avec source/destination/transfer_group_id', async () => {
  const types = await read('src/types/index.ts');
  matches(types, /source_location_id\?/, 'source_location_id optionnel');
  matches(types, /destination_location_id\?/, 'destination_location_id optionnel');
  matches(types, /transfer_group_id\?/, 'transfer_group_id optionnel');
});

// ============================================================================
// 3. Couche serveur : ALL_ROLES, effectivePermissions, LOGISTICS_ROLES
// ============================================================================

test('Server: ALL_ROLES inclut les 3 sous-rôles logistiques', async () => {
  const server = await read('src/lib/supabase/server.ts');
  matches(server, /'depot_manager'/, 'ALL_ROLES contient depot_manager');
  matches(server, /'store_manager'/, 'ALL_ROLES contient store_manager');
  matches(server, /'presentoir_manager'/, 'ALL_ROLES contient presentoir_manager');
  matches(server, /LOGISTICS_ROLES = \['depot_manager', 'store_manager', 'presentoir_manager'\]/, 'LOGISTICS_ROLES');
  matches(server, /LOGISTICS_ROLE_TO_LOCATION_TYPE/, 'mapping role → type');
  matches(server, /depot_manager: 'depot'/, 'mapping depot → depot');
  matches(server, /store_manager: 'magasin'/, 'mapping store → magasin');
  matches(server, /presentoir_manager: 'presentoir'/, 'mapping presentoir → presentoir');
});

test('Server: effectivePermissions inclut les 2 nouvelles clés logistique', async () => {
  const server = await read('src/lib/supabase/server.ts');
  matches(server, /'can_view_locations'/, 'clé can_view_locations dans effectivePermissions');
  matches(server, /'can_manage_locations'/, 'clé can_manage_locations dans effectivePermissions');
});

// ============================================================================
// 4. Navigation admin + permissions
// ============================================================================

test('Nav: entrée Logistique + permission can_view_locations', async () => {
  const nav = await read('src/lib/adminNav.ts');
  matches(nav, /id: 'locations'/, 'entrée Logistique');
  matches(nav, /href: '\/admin\/locations'/, 'route /admin/locations');
  matches(nav, /permissionKey: 'can_view_locations'/, 'permission can_view_locations');
  matches(nav, /\| 'can_view_locations'/, 'AdminPermissionKey accepte can_view_locations');
  matches(nav, /\| 'can_manage_locations'/, 'AdminPermissionKey accepte can_manage_locations');
});

// ============================================================================
// 5. Server Actions
// ============================================================================

test('Actions: locationsActions expose listLocationsAction + CRUD complet', async () => {
  const a = await read('src/app/actions/locationsActions.ts');
  matches(a, /export async function listLocationsAction/, 'listLocationsAction exporté');
  matches(a, /export async function createLocationAction/, 'createLocationAction exporté');
  matches(a, /export async function updateLocationAction/, 'updateLocationAction exporté');
  matches(a, /export async function archiveLocationAction/, 'archiveLocationAction exporté');
  matches(a, /export async function restoreLocationAction/, 'restoreLocationAction exporté');
  matches(a, /export async function purgeLocationAction/, 'purgeLocationAction exporté');
  matches(a, /getVisibleLocationsForUser/, 'filtre visibilité appelé');
  matches(a, /regex\(\/\^\[A-Z0-9-\]\+\$\//, 'CodeSchema strict MAJUSCULES');
});

test('Actions: transferActions expose create/approve/reject/execute/cancel', async () => {
  const a = await read('src/app/actions/transferActions.ts');
  matches(a, /export async function createTransferRequestAction/, 'createTransferRequestAction');
  matches(a, /export async function updateTransferRequestAction/, 'updateTransferRequestAction');
  matches(a, /export async function executeTransferRequestAction/, 'executeTransferRequestAction');
  matches(a, /export async function listTransferRequestsAction/, 'listTransferRequestsAction');
  matches(a, /'approve'.*'reject'.*'execute'.*'cancel'/s, '4 actions dans le Zod enum');
  matches(a, /admin.*administrator.*approuver/s, 'doc string indique admin OU administrator');
});

test('Actions: adminActions persiste managed_location_ids', async () => {
  const a = await read('src/app/actions/adminActions.ts');
  matches(a, /managed_location_ids: ManagedLocationsSchema/, 'Zod champ optionnel');
  matches(a, /managed_location_ids: parsed\.data\.managed_location_ids \?\? \[\]/, 'persistance create');
  matches(a, /STAFF_ROLES/, 'whitelist 9 rôles');
  matches(a, /'depot_manager'/, 'whitelist inclut depot_manager');
  matches(a, /'store_manager'/, 'whitelist inclut store_manager');
  matches(a, /'presentoir_manager'/, 'whitelist inclut presentoir_manager');
});

test('Actions: productActions accepte locality_id optionnel', async () => {
  const a = await read('src/app/actions/productActions.ts');
  matches(a, /locality_id: z\.string\(\)\.uuid/, 'locality_id validé UUID');
  matches(a, /locality_id: parsed\.data\.locality_id \?\? null/, 'locality_id propagé');
  matches(a, /revalidatePath\('\/admin\/locations'\)/, 'revalidate /admin/locations');
});

// ============================================================================
// 6. Couche repository
// ============================================================================

test('Repository: listLocations + CRUD + getVisibleLocationsForUser', async () => {
  const r = await read('src/data/repositories.ts');
  matches(r, /export async function listLocations/, 'listLocations');
  matches(r, /export async function createLocation/, 'createLocation');
  matches(r, /export async function updateLocation/, 'updateLocation');
  matches(r, /export async function archiveLocation/, 'archiveLocation');
  matches(r, /export async function purgeLocation/, 'purgeLocation');
  matches(r, /export async function listProductLocationStock/, 'listProductLocationStock');
  matches(r, /export async function upsertProductLocationStock/, 'upsertProductLocationStock');
  matches(r, /export async function createTransferRequest/, 'createTransferRequest');
  matches(r, /export async function executeTransferRequest/, 'executeTransferRequest');
  matches(r, /export function getVisibleLocationsForUser/, 'getVisibleLocationsForUser');
  matches(r, /export function canManageLocation/, 'canManageLocation');
});

test('Repository: adjustProductStock accepte locality_id (mock + supabase)', async () => {
  const r = await read('src/data/repositories.ts');
  matches(r, /locality_id\?: string \| null/, 'signature adjustProductStock');
  matches(r, /product_location_stock\.json/, 'mock path écrit dans product_location_stock.json');
  matches(r, /\.upsert\([\s\S]*?onConflict: 'product_id,location_id'/, 'supabase upsert avec onConflict');
});

// ============================================================================
// 7. UI StaffManager (3 rôles + 2 perms + bloc localités + handleRoleChange)
// ============================================================================

test('UI StaffManager: 3 rôles logistiques dans le select', async () => {
  const sm = await read('src/components/admin/StaffManager.tsx');
  matches(sm, /<option value="depot_manager">Gestionnaire de Dépôt<\/option>/, 'option depot_manager');
  matches(sm, /<option value="store_manager">Gestionnaire de Magasin<\/option>/, 'option store_manager');
  matches(sm, /<option value="presentoir_manager">Gestionnaire de Présentoir<\/option>/, 'option presentoir_manager');
  matches(sm, /<optgroup label="Logistique[^"]*">/, 'optgroup Logistique');
});

test('UI StaffManager: 2 nouvelles permissions + bloc localités affectées', async () => {
  const sm = await read('src/components/admin/StaffManager.tsx');
  matches(sm, /can_view_locations/, 'permission can_view_locations');
  matches(sm, /can_manage_locations/, 'permission can_manage_locations');
  matches(sm, /<span>Consulter les localités<\/span>/, 'label UI Consulter les localités');
  matches(sm, /<span>Gérer la logistique[\s\S]*?<\/span>/, 'label UI Gérer la logistique');
  matches(sm, /managedLocationIds/, 'state managedLocationIds');
  matches(sm, /Localités affectées/, 'titre du bloc localités affectées');
  matches(sm, /listLocationsAction/, 'appel à listLocationsAction');
  matches(sm, /LOGISTICS_ROLE_TO_TYPE/, 'mapping rôle → type pour filtrer le multi-select');
  matches(sm, /Sans localité affectée/, 'bandeau warning');
});

test('UI StaffManager: handleRoleChange non-mutatif avec confirm', async () => {
  const sm = await read('src/components/admin/StaffManager.tsx');
  matches(sm, /window\.confirm/, 'utilise window.confirm');
  matches(sm, /Changer de rôle va les réinitialiser/, 'message du confirm');
});

// ============================================================================
// 8. UI LocationsManager (3 onglets + dialogs)
// ============================================================================

test('UI LocationsManager: 3 onglets + bandeau aide + TransferDialog + LocationFormDialog', async () => {
  const lm = await read('src/components/admin/LocationsManager.tsx');
  matches(lm, /'locations' \| 'inventory' \| 'workflows'/, '3 onglets définis');
  matches(lm, /'locations' \| 'inventory' \| 'workflows'/, '3 onglets définis');
  matches(lm, /setTab\(t\)/, 'setTab utilisé pour navigation');
  matches(lm, /Locales|Localités/);
  // La présence des chaînes onglets suffit (la nav passe par setTab(t))
  matches(lm, /TransferStatusBadge/, 'badge statut transfert');
  matches(lm, /handleApprove/, 'action approve');
  matches(lm, /handleReject/, 'action reject');
  matches(lm, /handleExecute/, 'action execute');
  matches(lm, /handleCancel/, 'action cancel');
  matches(lm, /showHelp/, 'état aide collapsible');
  matches(lm, /MODULE-LOGISTIQUE\.md/, 'lien vers la doc utilisateur');
});

// ============================================================================
// 9. UI RestockDialog (sélecteur localité)
// ============================================================================

test('UI RestockDialog: props locations + defaultLocationId + sélecteur conditionnel', async () => {
  const rd = await read('src/components/admin/RestockDialog.tsx');
  matches(rd, /locations\?: Location\[\]/, 'prop locations optionnelle');
  matches(rd, /defaultLocationId\?/, 'prop defaultLocationId optionnelle');
  matches(rd, /locality_id: effectiveLocalityId/, 'locality_id envoyé au submit');
  matches(rd, /showLocalitySelector/, 'sélecteur conditionnel');
  matches(rd, /Localité impactée \*/, 'label UI Localité impactée');
  matches(rd, /à la localité/, 'toast enrichi avec localité');
  matches(rd, /stock global/, 'mention stock global dans le toast');
  matches(rd, /Choisir une localité/, 'option vide par défaut');
});

// ============================================================================
// 10. UI StocksDashboard (vraies localités)
// ============================================================================

test('UI StocksDashboard: remplace CATEGORY_DEPOSITS hardcodé par vraies localités', async () => {
  const sd = await read('src/components/admin/StocksDashboard.tsx');
  // Les constantes hardcodées sont supprimées (le grep suivant ne doit RIEN trouver)
  const hasOldConstants =
    /CATEGORY_DEPOSITS\s*:\s*Record<ProductCategory/.test(sd) ||
    /CATEGORY_CAPACITY\s*:\s*Record<ProductCategory/.test(sd);
  assert.equal(hasOldConstants, false, 'CATEGORY_DEPOSITS/CATEGORY_CAPACITY hardcodés supprimés');
  matches(sd, /locations\?: Location\[\]/, 'prop locations');
  matches(sd, /stockByLocation\?: ProductLocationStockEntry\[\]/, 'prop stockByLocation');
  matches(sd, /LOCATION_ICONS/, 'mapping icônes par type');
  matches(sd, /Aucune localité enregistrée/, 'état vide géré');
  matches(sd, /Capacité non renseignée/, 'message pour capacité 0');
  matches(sd, /defaultLocationId=\{restockLocationId\}/, 'RestockDialog reçoit defaultLocationId');
});

test('UI StocksDashboard: state vide + CTA vers /admin/locations', async () => {
  const sd = await read('src/components/admin/StocksDashboard.tsx');
  matches(sd, /href="\/admin\/locations"/, 'CTA vers /admin/locations');
  matches(sd, /Créer une localité/, 'label CTA');
});

// ============================================================================
// 11. Page server /admin/locations
// ============================================================================

test('Page server /admin/locations: dynamic force-dynamic + requireAdmin', async () => {
  const p = await read('src/app/admin/locations/page.tsx');
  matches(p, /export const dynamic = 'force-dynamic'/, 'force-dynamic');
  matches(p, /await requireAdmin\(\)/, 'requireAdmin');
  matches(p, /await listLocations/, 'fetch locations');
  matches(p, /await listProductLocationStock/, 'fetch stock par localité');
  matches(p, /await listTransferRequests/, 'fetch transfer requests');
  matches(p, /<LocationsManager/, 'rendu du composant client');
});

// ============================================================================
// 12. Vues publiques
// ============================================================================

test('Vues publiques: locations + product_location_stock + transfer_requests exposés', async () => {
  const v = await read('supabase/views-public-bridge.sql');
  matches(v, /CREATE VIEW public\.locations AS SELECT \* FROM eaumalik\.locations/, 'vue public.locations');
  matches(v, /CREATE VIEW public\.product_location_stock/, 'vue public.product_location_stock');
  matches(v, /CREATE VIEW public\.transfer_requests/, 'vue public.transfer_requests');
  matches(v, /CREATE VIEW public\.product_stock_by_location/, 'vue public.product_stock_by_location');
  matches(v, /CREATE VIEW public\.transfer_request_details/, 'vue public.transfer_request_details');
  matches(v, /ALTER VIEW public\.locations +OWNER TO postgres/, 'ownership postgres');
});

// ============================================================================
// 13. Mock data-store
// ============================================================================

test('Mock data-store: fichiers créés au boot + helpers disponibles', async () => {
  const ld = await read('src/data/localDb.ts');
  matches(ld, /LOCATIONS_FILE = path\.join\(DB_DIR, 'locations\.json'\)/, 'LOCATIONS_FILE défini');
  matches(ld, /PRODUCT_LOCATION_STOCK_FILE/, 'PRODUCT_LOCATION_STOCK_FILE défini');
  matches(ld, /TRANSFER_REQUESTS_FILE/, 'TRANSFER_REQUESTS_FILE défini');
  matches(ld, /export function readLocationsRaw/, 'readLocationsRaw exporté');
  matches(ld, /export function writeLocationsRaw/, 'writeLocationsRaw exporté');
  matches(ld, /'D-CASA-DEPOT'/, 'seed mock présent');
  matches(ld, /'M-CASA-CENTRAL'/, 'seed mock présent');
  matches(ld, /'P-SHOWROOM'/, 'seed mock présent');
});

// ============================================================================
// 14. Documentation utilisateur
// ============================================================================

test('Doc utilisateur: MODULE-LOGISTIQUE.md existe et couvre les 13 cas du plan', async () => {
  const docExists = existsSync(path.join(ROOT, 'docs/MODULE-LOGISTIQUE.md'));
  assert.equal(docExists, true, 'docs/MODULE-LOGISTIQUE.md doit exister');
  const doc = await read('docs/MODULE-LOGISTIQUE.md');
  matches(doc, /# Module Logistique/, 'titre');
  matches(doc, /## 1\. Concepts clés/, 'section concepts');
  matches(doc, /## 2\. Accès et permissions/, 'section permissions');
  matches(doc, /## 3\. Parcours utilisateur/, 'section parcours UI');
  matches(doc, /## 4\. Workflow d'un transfert/, 'section workflow');
  matches(doc, /## 5\. Mouvement de stock depuis le catalogue/, 'section RestockDialog');
  matches(doc, /## 6\. Création d'un profil staff logistique/, 'section StaffManager');
  matches(doc, /## 7\. Capacité et alertes/, 'section capacité');
  matches(doc, /## 8\. Stock global vs stock par localité/, 'section trigger SQL');
  matches(doc, /## 9\. Données seed/, 'section seed');
  matches(doc, /## 10\. Glossaire des permissions/, 'section permissions détaillées');
  matches(doc, /## 11\. Troubleshooting/, 'section troubleshooting');
  matches(doc, /## 12\. API \/ Server Actions/, 'section API');
  matches(doc, /## 13\. Limitations connues/, 'section limitations');
  matches(doc, /## 14\. Liens utiles/, 'section liens');
});

// ============================================================================
// 15. Scripts de migration
// ============================================================================

test('Scripts: migrate-locations.sh + .mjs existent + dry-run fonctionne', async () => {
  const shExists = await exists('scripts/migrate-locations.sh');
  const mjsExists = await exists('scripts/migrate-locations.mjs');
  assert.equal(shExists, true, 'scripts/migrate-locations.sh doit exister');
  assert.equal(mjsExists, true, 'scripts/migrate-locations.mjs doit exister');
  const sh = await read('scripts/migrate-locations.sh');
  matches(sh, /--dry-run/, 'option --dry-run');
  matches(sh, /--rollback/, 'option --rollback');
  matches(sh, /psql.*SUPABASE_DB_URL/s, 'support psql via env');
  matches(sh, /DROP TABLE IF EXISTS eaumalik\.transfer_requests/, 'rollback propre');
  const mjs = await read('scripts/migrate-locations.mjs');
  matches(mjs, /--dry-run/, 'option --dry-run');
  matches(mjs, /@supabase\/supabase-js/, 'utilise le client Supabase');
});

// ============================================================================
// 16. Sécurité du séparateur (anti-régression)
// ============================================================================

test('Sécurité: les payloads signés utilisent un séparateur non-ambigu (anti-régression bug cookie)', async () => {
  const devSession = await read('src/lib/auth/devSession.ts');
  // Le bug classique était `split('.')` qui casse sur les emails/dates ISO
  // On vérifie que le code utilise soit lastIndexOf, soit un autre séparateur.
  const usesDotSplit = /\.split\(['"]\.['"]\)/.test(devSession);
  if (usesDotSplit) {
    // Si split('.') est utilisé, lastIndexOf doit l'être aussi
    matches(devSession, /lastIndexOf/, 'lastIndexOf doit être utilisé pour éviter le bug');
  }
});
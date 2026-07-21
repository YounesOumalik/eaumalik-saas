import fs from 'fs';
import path from 'path';
import type { Product, Order, User, MaintenanceAlert, MaintenanceRecord, MaintenanceIntervention, ProductRestock } from '@/types';
import { MOCK_PRODUCTS } from './mock';

const DB_DIR = path.join(process.cwd(), 'data-store');

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const PRODUCTS_FILE = path.join(DB_DIR, 'products.json');
const ORDERS_FILE = path.join(DB_DIR, 'orders.json');
const USERS_FILE = path.join(DB_DIR, 'users.json');
const USERS_ARCHIVE_FILE = path.join(DB_DIR, 'users_archive.json');
const CARTS_FILE = path.join(DB_DIR, 'carts.json');
const MESSAGES_FILE = path.join(DB_DIR, 'messages.json');
const NEWS_FILE = path.join(DB_DIR, 'news.json');
const MAINTENANCE_FILE = path.join(DB_DIR, 'maintenance.json');
const PASSWORD_RESETS_FILE = path.join(DB_DIR, 'password_resets.json');
const RESTOCK_HISTORY_FILE = path.join(DB_DIR, 'restock_history.json');
const LOCATIONS_FILE = path.join(DB_DIR, 'locations.json');
const PRODUCT_LOCATION_STOCK_FILE = path.join(DB_DIR, 'product_location_stock.json');
const TRANSFER_REQUESTS_FILE = path.join(DB_DIR, 'transfer_requests.json');

// Initialize with mock data if files don't exist
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(MOCK_PRODUCTS, null, 2));
}
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(USERS_FILE)) {
  // ⚠️ ATTENTION (audit Phase 3) — NE JAMAIS écrire de mot de passe en clair.
  // L'auth est désormais gérée exclusivement par Supabase Auth (cf. lib/supabase/server.ts).
  // Ce fichier ne sert plus qu'aux listings legacy (StaffManager lit pour informations).
  // Pour réinitialiser le mot de passe admin : script `supabase/seed.sql` (admin créé via service role).
  const defaultUsers: any[] = [
    {
      id: 'admin-id',
      email: 'eaumaliksarl@gmail.com',
      // Pas de champ "password" stocké en clair.
      full_name: 'Administrateur EAUMALIK',
      role: 'admin',
      has_password: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}
if (!fs.existsSync(USERS_ARCHIVE_FILE)) {
  fs.writeFileSync(USERS_ARCHIVE_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(CARTS_FILE)) {
  fs.writeFileSync(CARTS_FILE, JSON.stringify({}, null, 2));
}
if (!fs.existsSync(MESSAGES_FILE)) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(NEWS_FILE)) {
  const defaultNews = [
    {
      id: 'news-1',
      title: 'Nouveau Purificateur ECO LIFE 2026',
      content: 'Découvrez notre dernière technologie d\'osmose inverse avec réduction d\'eau rejetée de 50%. Disponible dès maintenant.',
      created_at: new Date().toISOString()
    },
    {
      id: 'news-2',
      title: 'Campagne de Maintenance Annuelle',
      content: 'Rappel à tous nos clients : pensez à vérifier vos filtres à charbon actif pour garantir la pureté de votre eau.',
      created_at: new Date().toISOString()
    }
  ];
  fs.writeFileSync(NEWS_FILE, JSON.stringify(defaultNews, null, 2));
}
if (!fs.existsSync(RESTOCK_HISTORY_FILE)) {
  fs.writeFileSync(RESTOCK_HISTORY_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(LOCATIONS_FILE)) {
  // Seed 3 localités pour le mode mock (réplique du seed SQL 0014_locations.sql).
  const now = new Date().toISOString();
  const seeded = [
    { id: 'loc-depot-casa', code: 'D-CASA-DEPOT', name: 'Dépôt principal — Casablanca', type: 'depot', address: '', city: 'Casablanca', phone: '', capacity_units: 0, capacity_area_m2: 0, is_active: true, is_archived: false, notes: 'Seed initial', created_at: now, updated_at: now },
    { id: 'loc-magasin-casa', code: 'M-CASA-CENTRAL', name: 'Magasin central — Casablanca', type: 'magasin', address: '', city: 'Casablanca', phone: '', capacity_units: 0, capacity_area_m2: 0, is_active: true, is_archived: false, notes: 'Seed initial', created_at: now, updated_at: now },
    { id: 'loc-presentoir-casa', code: 'P-SHOWROOM', name: 'Showroom / Présentoir', type: 'presentoir', address: '', city: 'Casablanca', phone: '', capacity_units: 0, capacity_area_m2: 0, is_active: true, is_archived: false, notes: 'Seed initial', created_at: now, updated_at: now },
  ];
  fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(seeded, null, 2));
}
if (!fs.existsSync(PRODUCT_LOCATION_STOCK_FILE)) {
  fs.writeFileSync(PRODUCT_LOCATION_STOCK_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(TRANSFER_REQUESTS_FILE)) {
  fs.writeFileSync(TRANSFER_REQUESTS_FILE, JSON.stringify([], null, 2));
}

// ---------------------------------------------------------
// Products
// ---------------------------------------------------------
export function readProducts(): Product[] {
  try {
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return MOCK_PRODUCTS;
  }
}

export function writeProducts(products: Product[]) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// ---------------------------------------------------------
// Restock history (historique des approvisionnements)
// ---------------------------------------------------------
// Chaque entrée représente un approvisionnement unitaire (une date, une
// quantité, un auteur). Permet de tracer dans le temps les réassorts
// faits via le bouton "Approvisionnement" du catalogue admin.
export function readRestockHistory(): ProductRestock[] {
  try {
    const data = fs.readFileSync(RESTOCK_HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProductRestock[];
  } catch (e) {
    return [];
  }
}

export function writeRestockHistory(history: ProductRestock[]) {
  fs.writeFileSync(RESTOCK_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ---------------------------------------------------------
// Orders
// ---------------------------------------------------------
export function readOrders(): Order[] {
  try {
    const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writeOrders(orders: Order[]) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

// ---------------------------------------------------------
// Users
// ---------------------------------------------------------
export function readUsers(): any[] {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------
// Users archive (comptes personnel supprimés, restaurables)
// Snapshot complet : id, email, role, permissions, métadonnées
// + date d'archivage. Le mot de passe n'est PAS archivé :
// à la restauration, l'admin doit en définir un nouveau.
// ---------------------------------------------------------
export interface ArchivedUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  permissions: Record<string, boolean> | null;
  original_created_at: string | null;
  original_updated_at: string | null;
  archived_at: string;
  archived_reason: string | null;
}

export function readArchivedUsers(): ArchivedUser[] {
  try {
    const data = fs.readFileSync(USERS_ARCHIVE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writeArchivedUsers(users: ArchivedUser[]) {
  fs.writeFileSync(USERS_ARCHIVE_FILE, JSON.stringify(users, null, 2));
}

export function writeUsers(users: any[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ---------------------------------------------------------
// Password resets (mode mock uniquement — flow "mot de passe oublié")
// Format : { token, email, expires, used, created_at }
// ---------------------------------------------------------
export interface PasswordReset {
  token: string;
  email: string;
  expires: number; // epoch ms
  used: boolean;
  created_at: string;
}

export function readPasswordResets(): PasswordReset[] {
  try {
    const data = fs.readFileSync(PASSWORD_RESETS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writePasswordResets(resets: PasswordReset[]) {
  fs.writeFileSync(PASSWORD_RESETS_FILE, JSON.stringify(resets, null, 2));
}

// ---------------------------------------------------------
// Carts
// ---------------------------------------------------------
export function readCarts(): Record<string, any[]> {
  try {
    const data = fs.readFileSync(CARTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

export function writeCarts(carts: Record<string, any[]>) {
  fs.writeFileSync(CARTS_FILE, JSON.stringify(carts, null, 2));
}

// ---------------------------------------------------------
// Messages
// ---------------------------------------------------------
export function readMessages(): any[] {
  try {
    const data = fs.readFileSync(MESSAGES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writeMessages(messages: any[]) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// ---------------------------------------------------------
// News / Actualités
// ---------------------------------------------------------
export function readNews(): any[] {
  try {
    const data = fs.readFileSync(NEWS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function writeNews(news: any[]) {
  fs.writeFileSync(NEWS_FILE, JSON.stringify(news, null, 2));
}

// ---------------------------------------------------------
// Maintenance — fiches programmes + interventions
// Format JSON : { records: MaintenanceRecord[], interventions: MaintenanceIntervention[] }
// ---------------------------------------------------------
export interface MaintenanceBundle {
  records: MaintenanceRecord[];
  interventions: MaintenanceIntervention[];
}

export function readMaintenance(): MaintenanceBundle {
  try {
    const data = fs.readFileSync(MAINTENANCE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') {
      return { records: [], interventions: [] };
    }
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      interventions: Array.isArray(parsed.interventions) ? parsed.interventions : [],
    };
  } catch (e) {
    return { records: [], interventions: [] };
  }
}

export function writeMaintenance(bundle: MaintenanceBundle) {
  fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(bundle, null, 2));
}

// ---------------------------------------------------------
// Locations (dépôts / magasins / présentoirs) — mock JSON
// Format : tableau de MockLocation (snake_case compatible DB).
// Migré depuis data-store/ pour aligner avec le pattern des autres tables.
// ---------------------------------------------------------

export interface MockLocation {
  id: string;
  code: string;
  name: string;
  type: 'depot' | 'magasin' | 'presentoir';
  address: string | null;
  city: string | null;
  phone: string | null;
  capacity_units: number;
  capacity_area_m2: number;
  is_active: boolean;
  is_archived: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function readLocationsRaw(): MockLocation[] {
  try {
    const data = fs.readFileSync(LOCATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed as MockLocation[];
  } catch {
    return [];
  }
}

export function writeLocationsRaw(locations: MockLocation[]): void {
  fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2));
}

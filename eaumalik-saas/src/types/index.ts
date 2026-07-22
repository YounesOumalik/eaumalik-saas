// ============================================================================
// Domain types - EAUMALIK SaaS
// Réplique EXACTE du schéma SQL (Supabase / PostgreSQL)
// ============================================================================

export type ProductCategory = 'purificateurs' | 'industriel' | 'consommables';

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  purificateurs: 'Osmoseurs & Filtration domestique',
  industriel: "Traitement de l'eau professionnel",
  consommables: 'Filtres de rechange & Pièces',
};

// ============================================================================
// Module Logistique : localités (dépôts / magasins / présentoirs)
// Cf. migration 0014_locations.sql.
// ============================================================================

export type LocationType = 'depot' | 'magasin' | 'presentoir';

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  depot: 'Dépôt (entrepôt / stockage)',
  magasin: 'Magasin (point de vente / retrait)',
  presentoir: 'Présentoir (showroom / exposition)',
};

/** Forme "métier" d'une localité telle que consommée par l'UI. Les colonnes
 *  snake_case de la DB sont mappées 1-pour-1 vers des clés camelCase pour
 *  rester cohérent avec le reste du domaine (Product, Order, etc.). */
export interface Location {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  address: string | null;
  city: string | null;
  phone: string | null;
  /** Plafond de capacité en nombre d'articles. 0 = non renseigné. */
  capacity_units: number;
  /** Plafond de capacité en m² (surface). 0 = non renseigné. */
  capacity_area_m2: number;
  is_active: boolean;
  is_archived: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Répartition du stock par localité (jointure UI). */
export interface ProductLocationStockEntry {
  product_id: string;
  location_id: string;
  quantity: number;
  updated_at: string;
  product?: { id: string; name: string; category: string; stock: number };
  location?: Location;
}

/** Ligne d'une demande de transfert (jointure UI complète). */
export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';

export interface TransferRequestRow {
  id: string;
  product_id: string;
  source_location_id: string;
  destination_location_id: string;
  quantity: number;
  request_type: 'outbound' | 'inbound';
  requester_id: string;
  reason: string | null;
  status: TransferStatus;
  validator_id: string | null;
  validated_at: string | null;
  validator_comment: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
  // Champs joints via la vue transfer_request_details
  product_name?: string;
  product_category?: string;
  source_code?: string;
  source_name?: string;
  source_type?: LocationType;
  destination_code?: string;
  destination_name?: string;
  destination_type?: LocationType;
  requester_name?: string;
  requester_role?: string;
  validator_name?: string;
  validator_role?: string;
}
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number; // MAD
  category: ProductCategory;
  image_url: string | null;
  specs: string[] | null;
  is_featured: boolean;
  stock: number;
  stock_alert_threshold: number;
  filter_lifespan_months: number | null;
  wholesale_price?: number; // MAD
  price_on_request?: boolean; // Prix sur devis
  sort_order?: number; // Ordre d'affichage (plus petit = plus haut)
  is_out_of_stock?: boolean;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Motif d'un mouvement de stock (approvisionnement, sortie, correction).
 *
 * - `restock`     : réassort fournisseur (entrée, delta > 0)
 * - `return`      : retour client / reprise (entrée, delta > 0)
 * - `direct_sale` : vente directe hors commande (sortie, delta < 0)
 * - `correction`  : correction d'inventaire (signe libre, note obligatoire)
 * - `loss`        : casse, vol, péremption (sortie, delta < 0)
 * - `other`       : autre motif (signe libre, note obligatoire)
 */
export type StockMovementReason =
  | 'restock'
  | 'return'
  | 'direct_sale'
  | 'correction'
  | 'loss'
  | 'other'
  | 'transfer';

export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  restock:     'Approvisionnement (réassort)',
  return:      'Retour client',
  direct_sale: 'Vente directe',
  correction:  'Correction d\'inventaire',
  loss:        'Perte / casse / vol',
  other:       'Autre',
  transfer:    'Transfert entre localités',
};

/**
 * Événement d'approvisionnement de stock pour un produit.
 * Enregistré à chaque mouvement via le bouton "Mouvement de stock" du catalogue
 * admin. Permet de tracer dans le temps les variations de stock (entrées,
 * sorties, corrections) avec leur motif.
 *
 * `quantity` = variation signée appliquée au stock :
 *  - > 0  pour une entrée (réassort, retour client)
 *  - < 0  pour une sortie (vente directe, perte)
 *  - != 0 pour une correction (note obligatoire)
 */
export interface ProductRestock {
  id: string;
  product_id: string;
  /** Variation de stock appliquée (signée : +N entrée, -N sortie). */
  quantity: number;
  /** Date effective du mouvement (saisie par l'admin). */
  restock_date: string; // YYYY-MM-DD
  /** Motif du mouvement (cf. StockMovementReason). */
  reason: StockMovementReason;
  /** Note libre (fournisseur, référence de lot, commentaire, etc.). */
  note: string | null;
  /** Auteur de l'opération (email ou nom libre). */
  created_by: string | null;
  created_at: string; // ISO timestamp
  /** Localité impactée par le mouvement (migration 0014). Null = mouvement
   *  global sans localité (legacy / back-compat). */
  source_location_id?: string | null;
  destination_location_id?: string | null;
  /** UUID partagé entre les 2 lignes d'un même transfert. */
  transfer_group_id?: string | null;
}

export type OrderStatus =
  | 'en_attente'
  | 'traitee'
  | 'en_livraison'
  | 'livree'
  | 'annulee';

export interface Order {
  id: string;
  order_number: string;
  tracking_number?: string | null;
  carrier?: string | null;
  user_id: string | null;
  client_name: string;
  client_phone: string;
  client_address: string;
  client_city: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes: string | null;
  payment_method: 'cash_on_delivery';
  invoice_generated: boolean;
  /** Date de passage en "Traitée" */
  processed_at?: string | null;
  /** Date de passage en "En livraison" */
  shipped_at?: string | null;
  /** Date de passage en "Livrée" */
  delivered_at?: string | null;
  /** Date prévue de livraison (optionnelle — peut être définie manuellement ou par défaut J+2) */
  estimated_delivery?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

/** Étape individuelle d'une timeline de suivi de commande (vue) */
export interface OrderTimelineStep {
  key: OrderStatus | 'commande';
  label: string;
  description: string;
  /** Date ISO réelle si l'étape est franchie, sinon `null` */
  at: string | null;
  /** Étape franchie / en cours / à venir */
  state: 'done' | 'current' | 'upcoming' | 'cancelled';
  /** Icône lucide-react (utilisée par le composant) */
  iconName: 'Package' | 'CheckCircle2' | 'Truck' | 'Home' | 'ShieldCheck' | 'X' | 'Clock' | 'ClipboardCheck';
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

/**
 * Rôles utilisateurs EAUMALIK.
 * - `client` : rôle par défaut (visiteur / acheteur).
 * - `admin` / `administrator` : admin-staff (cf. `requireAdmin()`).
 * - `sales` / `technician` / `stock_manager` / `admin_assistant` : personnel
 *   métier historique (CRM, maintenance, stock global).
 * - `depot_manager` / `store_manager` / `presentoir_manager` : sous-rôles
 *   logistiques avec visibilité restreinte à leurs localités affectées
 *   (cf. `getVisibleLocationsForUser`).
 */
export type UserRole =
  | 'client'
  | 'admin'
  | 'administrator'
  | 'sales'
  | 'technician'
  | 'stock_manager'
  | 'admin_assistant'
  | 'depot_manager'
  | 'store_manager'
  | 'presentoir_manager';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  google_id: string | null;
  role: UserRole;
  /**
   * Liste d'UUIDs de localités que cet utilisateur peut gérer
   * (lecture + écriture + transferts). Renseigné uniquement pour les
   * sous-rôles logistiques (`depot_manager`, `store_manager`,
   * `presentoir_manager`). Doit être filtré par type correspondant
   * au rôle côté serveur (cf. `LOGISTICS_ROLE_TO_LOCATION_TYPE`).
   * Champ introduit par la migration 0014_locations.sql.
   */
  managed_location_ids?: string[] | null;
  nps_score: number | null;
  /** Code de parrainage unique (8 caractères alphanumériques en majuscules). */
  referral_code?: string | null;
  /** ID du client parraineur (celui qui a invite ce client via son code). */
  referred_by?: string | null;
  /** Solde cashback gagne via les commandes des filleuls (en MAD). */
  cashback_balance?: number | null;
  created_at: string;
  updated_at: string;
}

export type MaintenanceStatus =
  | 'a_jour'
  | 'a_renouveler'
  | 'expire'
  | 'rappel_envoye'
  | 'commande_creee';

export interface MaintenanceAlert {
  id: string;
  user_id: string | null;
  order_id: string | null;
  product_id: string | null;
  product_name: string;
  install_date: string;
  next_filter_change: string;
  filter_types: string[];
  status: MaintenanceStatus;
  last_reminder_sent: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Module Maintenance : suivi long-terme + historique d'interventions
// ============================================================================

export type MaintenanceProgramStatus = 'actif' | 'a_renouveler' | 'suspendu' | 'resilie';

export interface MaintenanceRecord {
  id: string;
  client_name: string;
  client_phone: string | null;
  client_city: string | null;
  client_address: string | null;
  user_id: string | null;
  order_id: string | null;
  product_id: string | null;
  product_name: string;
  install_date: string;        // ISO date (YYYY-MM-DD)
  next_service_date: string | null;
  service_interval_months: number;
  status: MaintenanceProgramStatus;
  /** Motif de suspension ou de résiliation, s'il existe. */
  status_reason?: string | null;
  notes: string | null;
  filter_types: string[];
  last_service_date: string | null;
  last_reminder_sent: string | null;
  total_cost: number;
  intervention_count: number;
  created_at: string;
  updated_at: string;
  /** Eager-loaded interventions (optionnel, dépend du endpoint) */
  interventions?: MaintenanceIntervention[];
}

export type InterventionType =
  | 'filter_change'
  | 'inspection'
  | 'repair'
  | 'replacement'
  | 'cleaning'
  | 'diagnostic'
  | 'other';

export type InterventionOutcome = 'completed' | 'pending' | 'failed';

export interface MaintenanceIntervention {
  id: string;
  record_id: string;
  intervention_type: InterventionType;
  performed_at: string;
  technician_name: string | null;
  description: string;
  parts_used: string[];
  cost: number;
  next_service_date: string | null;
  outcome: InterventionOutcome;
  created_at: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  legal_name: string;
  capital: number;
  address: string;
  phone: string;
  email: string;
  fax: string | null;
  if_number: string | null;
  tax_id: string | null;
  rc_number: string | null;
  logo_url: string | null;
  created_at: string;
}

// Cart item côté client (localStorage guest → sync API à la connexion)
export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
}

export interface CheckoutFormData {
  client_name: string;
  client_phone: string;
  client_city: string;
  client_address: string;
  notes?: string;
}

// ============================================================================
// News / Actualités / Promotions
// Cible : table public.news / eaumalik.news (+ JSON mock data-store/news.json)
// ============================================================================
export interface News {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  /** Prix promotionnel (optionnel). Si défini + product_ids non vide OU prix < prix normal ⇒ affichage pub. */
  price: number | null;
  /** Prix avant promotion (= somme des unit_price des produits inclus si renseigné). */
  original_price: number | null;
  /** Produits du catalogue inclus dans la promotion. */
  product_ids: string[];
  /** true ⇒ envoi à TOUS les clients, false ⇒ envoi ciblé selon target_user_ids. */
  target_all: boolean;
  /** Liste des clients destinataires (si !target_all). Vide = broadcast admin seul. */
  target_user_ids: string[];
  /** Marqueur promotion : true si price OU product_ids non vide. Calculé à la lecture. */
  is_promotion: boolean;
  /** Fin de validité (optionnelle). Après cette date, la promotion disparaît des carrousels. */
  valid_until: string | null;
  /** Archivée par un administrateur. Cachée du carrousel landing/boutique + espace client,
   *  mais reste listée dans l'admin pour pouvoir être restaurée. */
  is_archived?: boolean;
  /** Date d'archivage (ISO). Null si is_archived = false. */
  archived_at?: string | null;
  /** Raison d'archivage (optionnelle, pour audit interne). */
  archived_reason?: string | null;
  created_at: string;
}

/** Élément exposé publiquement (landing, carrousel, espace client). */
export type PublicNews = News;

// ============================================================================
// Domain types - EAUMALIK SaaS
// Réplique EXACTE du schéma SQL (Supabase / PostgreSQL)
// ============================================================================

export type ProductCategory = 'purificateurs' | 'industriel' | 'consommables';
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
  is_out_of_stock?: boolean;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
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

export type UserRole = 'client' | 'admin';
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
  created_at: string;
}

/** Élément exposé publiquement (landing, carrousel, espace client). */
export type PublicNews = News;


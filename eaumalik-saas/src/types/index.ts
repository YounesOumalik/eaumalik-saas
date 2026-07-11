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
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
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

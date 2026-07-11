// Données mock — utilisées quand NEXT_PUBLIC_USE_MOCKS=true (dev sans Supabase).
// Reprenez exactement la même forme que les types `Product | Order | ...`
import type {
  Product, Order, OrderItem, User, MaintenanceAlert, CompanyProfile,
} from '@/types';

export const MOCK_COMPANY: CompanyProfile = {
  id: 'c0000000-0000-0000-0000-000000000001',
  name: 'EAUMALIK SARL',
  legal_name: 'EAUMALIK S.A.R.L.',
  capital: 100000,
  address: '23 Rue Boured Eig 3, N5 Roches Noires, Casablanca',
  phone: '+212 661 463 194',
  email: 'eaumaliksarl@gmail.com',
  fax: '0520927192',
  if_number: null,
  tax_id: null,
  rc_number: null,
  logo_url: '/logo.jpeg',
  created_at: '2025-01-01T00:00:00Z',
};

const NOW = new Date().toISOString();

export const MOCK_PRODUCTS: Product[] = Array.from({ length: 13 }).map((_, i) => ({
  id: `p${i + 1}`,
  name: `Purificateur d'Eau Pro Modèle ${i + 1}`,
  slug: `purificateur-eau-pro-modele-${i + 1}`,
  description: "Notre mission est simple : vous fournir une eau pure, saine et de qualité grâce à des technologies modernes, un service professionnel et un suivi durable. EAUMALIK SARL vous accompagne avec des équipements fiables, performants et adaptés à chaque besoin.",
  price: 2499,
  category: 'purificateurs',
  image_url: `/products/product-${(i + 1).toString().padStart(2, '0')}.jpeg`,
  specs: [
    'Qualité Supérieure', 
    'Technologies Avancées', 
    'Installation Professionnelle', 
    'Accompagnement Personnalisé', 
    'Service Après-Vente Réactif', 
    'Garantie 1 an'
  ],
  is_featured: i < 6, // Les 6 premiers sont en page d'accueil
  stock: 20,
  stock_alert_threshold: 5,
  filter_lifespan_months: 6,
  created_at: NOW,
  updated_at: NOW,
}));

export const MOCK_USERS: User[] = [];
export const MOCK_ORDERS: Order[] = [];
export const MOCK_ORDER_ITEMS: OrderItem[] = [];
export const MOCK_MAINTENANCE: MaintenanceAlert[] = [];

// Helpers d'accès aux mocks (utilisé par les repositories serveur).
export const REPOSITORY = {
  products: MOCK_PRODUCTS,
  users: MOCK_USERS,
  orders: MOCK_ORDERS,
  orderItems: MOCK_ORDER_ITEMS,
  maintenance: MOCK_MAINTENANCE,
  company: MOCK_COMPANY,
};

// Repository layer — abstraction Supabase ↔ Mocks.
// Bascule automatiquement en fonction de NEXT_PUBLIC_USE_MOCKS et de la présence des credentials.
import 'server-only';
import type {
  Product, Order, OrderItem, User, MaintenanceAlert, CompanyProfile,
} from '@/types';
import {
  MOCK_PRODUCTS, MOCK_USERS, MOCK_ORDERS, MOCK_ORDER_ITEMS,
  MOCK_MAINTENANCE, MOCK_COMPANY,
} from '@/data/mock';

const useMocks = (): boolean => {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') return true;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
};

// Lazy import de @supabase/server pour éviter d'instancier côté client.
async function getSupabase() {
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  return createSupabaseServerClient();
}

// ============================================================================
// PRODUCTS
// ============================================================================
export async function listProducts(filters?: {
  category?: string;
  search?: string;
  featured?: boolean;
}): Promise<Product[]> {
  if (useMocks()) {
    let list = [...MOCK_PRODUCTS];
    if (filters?.category && filters.category !== 'all') list = list.filter(p => p.category === filters.category);
    if (filters?.featured) list = list.filter(p => p.is_featured);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  const supabase = await getSupabase();
  let query = supabase.from('products').select('*').order('created_at', { ascending: false });
  if (filters?.category && filters.category !== 'all') query = query.eq('category', filters.category);
  if (filters?.featured) query = query.eq('is_featured', true);
  if (filters?.search) query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function updateProductStock(productId: string, delta: number): Promise<void> {
  if (useMocks()) {
    const p = MOCK_PRODUCTS.find(x => x.id === productId);
    if (p) p.stock = Math.max(0, p.stock + delta);
    return;
  }
  const supabase = await getSupabase();
  const { data } = await supabase.from('products').select('stock').eq('id', productId).single();
  if (!data) return;
  await supabase.from('products').update({ stock: Math.max(0, data.stock + delta) }).eq('id', productId);
}

// ============================================================================
// ORDERS
// ============================================================================
export async function listOrders(): Promise<Order[]> {
  if (useMocks()) return [...MOCK_ORDERS];
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  if (useMocks()) {
    const o = MOCK_ORDERS.find(x => x.id === orderId);
    if (o) o.status = status;
    return;
  }
  const supabase = await getSupabase();
  await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
}

export async function createOrder(input: {
  client_name: string;
  client_phone: string;
  client_address: string;
  client_city: string;
  notes?: string;
  items: { product_id: string; product_name: string; unit_price: number; quantity: number }[];
}): Promise<Order> {
  const subtotal = input.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const delivery = subtotal >= 2000 ? 0 : 50;
  const total = subtotal + delivery;
  const order_number = `CMD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  if (useMocks()) {
    const id = `o-${Date.now()}`;
    const order: Order = {
      id,
      order_number,
      user_id: null,
      client_name: input.client_name,
      client_phone: input.client_phone,
      client_address: input.client_address,
      client_city: input.client_city,
      status: 'en_attente',
      subtotal,
      delivery_fee: delivery,
      total,
      notes: input.notes ?? null,
      payment_method: 'cash_on_delivery',
      invoice_generated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: input.items.map((i, idx) => ({
        id: `${id}-item-${idx}`,
        order_id: id,
        product_id: i.product_id,
        product_name: i.product_name,
        unit_price: i.unit_price,
        quantity: i.quantity,
        line_total: i.unit_price * i.quantity,
      })),
    };
    MOCK_ORDERS.unshift(order);
    return order;
  }

  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('orders')
    .insert({
      order_number,
      user_id: userData?.user?.id ?? null,
      client_name: input.client_name,
      client_phone: input.client_phone,
      client_address: input.client_address,
      client_city: input.client_city,
      notes: input.notes ?? null,
      subtotal, delivery_fee: delivery, total,
      status: 'en_attente',
      payment_method: 'cash_on_delivery',
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Insert order failed');

  await supabase.from('order_items').insert(
    input.items.map(i => ({
      order_id: data.id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.unit_price * i.quantity,
    }))
  );

  return { ...(data as Order), items: input.items as unknown as OrderItem[] };
}

// ============================================================================
// USERS / CLIENTS
// ============================================================================
export async function listClients(): Promise<User[]> {
  if (useMocks()) return [...MOCK_USERS];
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('users').select('*').eq('role', 'client').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as User[];
}

// ============================================================================
// MAINTENANCE
// ============================================================================
export async function listMaintenance(): Promise<MaintenanceAlert[]> {
  if (useMocks()) return [...MOCK_MAINTENANCE];
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('maintenance_alerts').select('*').order('next_filter_change', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MaintenanceAlert[];
}

export async function updateMaintenanceStatus(id: string, status: MaintenanceAlert['status']): Promise<void> {
  if (useMocks()) {
    const m = MOCK_MAINTENANCE.find(x => x.id === id);
    if (m) { m.status = status; m.updated_at = new Date().toISOString(); }
    return;
  }
  const supabase = await getSupabase();
  await supabase.from('maintenance_alerts').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
}

// ============================================================================
// COMPANY
// ============================================================================
export async function getCompanyProfile(): Promise<CompanyProfile> {
  if (useMocks()) return MOCK_COMPANY;
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('company_profile').select('*').single();
  if (error || !data) return MOCK_COMPANY;
  return data as CompanyProfile;
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient, createSupabaseServerClient, AuthError } from '@/lib/supabase/server';
import { badRequest, forbidden, safeErrorResponse, unauthorized } from '@/lib/api-guard';
import {
  getProductsForOrder,
  readOrdersRaw,
  writeOrdersRaw,
  readUsersRaw,
  writeUsersRaw,
} from '@/data/repositories';
import { Order } from '@/types';
import { getDevUserFromCookie, setDevSessionCookie } from '@/lib/auth/devSession';
import { hashPassword } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

const OrderItemSchema = z.object({
  product_id: z.string().min(1).max(80),
  quantity: z.number().int().positive().max(1000),
});

const CreateOrderSchema = z.object({
  client_name: z.string().min(3).max(100),
  client_phone: z.string().regex(/^0[0-9]{9}$/, 'Numéro de téléphone invalide (0XXXXXXXXX)'),
  client_city: z.string().min(1).max(60),
  client_address: z.string().min(5).max(200),
  notes: z.string().max(500).optional(),
  items: z.array(OrderItemSchema).min(1).max(50),
});

type CanonicalOrderItem = {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
};

/** Génère un numéro de commande robuste basé sur crypto.randomUUID. */
function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const rnd = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `CMD-${year}-${rnd}`;
}

/** Helper local : renvoie l'utilisateur authentifié et son rôle, ou jette. */
async function getCaller(): Promise<{ id: string; role: 'admin' | 'client' }> {
  // En mode mock, la session est portée par le cookie signé local et Supabase
  // n'est volontairement pas configuré. Il faut tout de même conserver le
  // user_id pour que la commande soit visible dans l'espace client.
  const devUser = await getDevUserFromCookie();
  if (devUser) {
    return {
      id: devUser.id,
      role: devUser.role === 'admin' || devUser.role === 'administrator' ? 'admin' : 'client',
    };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthError('unauthenticated', 'Authentification requise.');
  const admin = createSupabaseServiceRoleClient();
  const { data: profile } = await admin.from('users').select('role').eq('id', data.user.id).single();
  return { id: data.user.id, role: (profile?.role as 'admin' | 'client') ?? 'client' };
}

export async function GET() {
  let caller: { id: string; role: 'admin' | 'client' };
  try {
    caller = await getCaller();
  } catch (e) {
    if (e instanceof AuthError) {
      return e.status === 401 ? unauthorized(e.message) : forbidden(e.message);
    }
    return safeErrorResponse(e);
  }
  if (caller.role !== 'admin') return forbidden('Droits administrateur requis.');

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return safeErrorResponse(e);
  }
}

/** POST : crée une commande pour l'utilisateur courant (peut être invité).
 *  En mode mock (ou sans Supabase), écrit dans data-store/*.json et peut
 *  créer un compte client à la volée (checkout invité) en posant le cookie
 *  de session dev. */
export async function POST(req: NextRequest) {
  let callerId: string | null = null;
  try {
    const caller = await getCaller();
    callerId = caller.id;
  } catch {
    callerId = null; // Invité autorisé à commander.
  }

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON invalide.'); }

  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Validation échouée.', parsed.error.flatten());
  }
  const input = parsed.data;
  if (new Set(input.items.map((item) => item.product_id)).size !== input.items.length) {
    return badRequest('Un même produit ne peut apparaître qu’une seule fois dans la commande.');
  }

  // Le navigateur ne fournit que les identifiants et les quantités. Le nom,
  // le prix et la disponibilité sont toujours relus depuis la source serveur.
  let canonicalItems: CanonicalOrderItem[];
  try {
    const products = await getProductsForOrder(input.items.map((item) => item.product_id));
    const productMap = new Map(products.map((product) => [product.id, product]));
    canonicalItems = input.items.map((item) => {
      const product = productMap.get(item.product_id);
      if (!product || product.is_archived) throw new Error('Produit indisponible.');
      if (product.price_on_request) throw new Error(`Le produit « ${product.name} » nécessite un devis.`);
      if (product.stock < item.quantity) throw new Error(`Stock insuffisant pour « ${product.name} ».`);
      return {
        product_id: product.id,
        product_name: product.name,
        unit_price: Number(product.price),
        quantity: item.quantity,
      };
    });
  } catch (error: any) {
    return badRequest(error?.message || 'Produits indisponibles.');
  }
  // Compte optionnel : checkout invité qui crée son compte en même temps.
  const account = (body as { account?: { email?: string; password?: string; full_name?: string } })?.account;

  // Validation du compte invité si fourni (email + mot de passe >= 8 caractères).
  if (!callerId && account) {
    const email = String(account.email ?? '').trim();
    const pwd = String(account.password ?? '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return badRequest('Email invalide pour la création du compte.');
    }
    if (pwd.length < 8) {
      return badRequest('Le mot de passe doit contenir au moins 8 caractères.');
    }
  }

  try {
    const subtotal = canonicalItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const delivery = subtotal >= 2000 ? 0 : 50;
    const total = subtotal + delivery;

    const useMocks =
      process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (useMocks) {
      return await createOrderMock({
        input,
        items: canonicalItems,
        subtotal,
        delivery,
        total,
        callerId,
        account,
      });
    }

    // Les écritures de commande passent toujours par le backend de confiance.
    // Après application de la migration 0017, ce RPC verrouille le stock et
    // crée la commande et ses lignes dans une seule transaction.
    const supabase = createSupabaseServiceRoleClient();
    const { data: transactionOrder, error: transactionError } = await supabase.rpc(
      'create_checkout_order',
      {
        p_user_id: callerId,
        p_client_name: input.client_name,
        p_client_phone: input.client_phone,
        p_client_city: input.client_city,
        p_client_address: input.client_address,
        p_notes: input.notes ?? null,
        p_items: canonicalItems.map(({ product_id, quantity }) => ({ product_id, quantity })),
      },
    );
    if (!transactionError && transactionOrder) {
      return NextResponse.json(transactionOrder, { status: 201 });
    }
    if (transactionError) throw transactionError;

    const order_number = generateOrderNumber();
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_number,
        user_id: callerId,
        client_name: input.client_name,
        client_phone: input.client_phone,
        client_address: input.client_address,
        client_city: input.client_city,
        status: 'en_attente',
        subtotal, delivery_fee: delivery, total,
        notes: input.notes ?? null,
        payment_method: 'cash_on_delivery',
      })
      .select()
      .single();
    if (error || !order) throw error ?? new Error('Création impossible.');

    const itemsPayload = canonicalItems.map(i => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.unit_price * i.quantity,
    }));
    const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
    if (itemsErr) {
      // Évite de laisser une commande vide si l'insertion des lignes échoue.
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsErr;
    }

    return NextResponse.json({ ...order, items: itemsPayload.map((p, idx) => ({ id: idx, ...p })) }, { status: 201 });
  } catch (e) {
    return safeErrorResponse(e);
  }
}

/**
 * Création de commande en mode mock (data-store JSON).
 * Si `account` est fourni (checkout invité), crée un compte client à la volée
 * dans users.json et pose le cookie de session dev pour connecter l'utilisateur.
 */
async function createOrderMock({
  input,
  items,
  subtotal,
  delivery,
  total,
  callerId,
  account,
}: {
  input: z.infer<typeof CreateOrderSchema>;
  items: CanonicalOrderItem[];
  subtotal: number;
  delivery: number;
  total: number;
  callerId: string | null;
  account?: { email?: string; password?: string; full_name?: string };
}): Promise<NextResponse> {
  const order_number = generateOrderNumber();
  let userId = callerId;
  let newUser: Record<string, any> | null = null;

  // Checkout invité → création de compte à la volée (cohérent avec /api/auth/dev-login).
  if (!callerId && account?.email && account?.password) {
    const email = String(account.email).trim().toLowerCase();
    const users = await readUsersRaw();
    const existing = users.find((u: any) => u.email?.toLowerCase() === email);
    if (existing) {
      // Compte déjà existant : on lie la commande et on connecte l'utilisateur.
      userId = existing.id;
      newUser = existing;
    } else {
      newUser = {
        id: `u-${Date.now()}`,
        email: account.email,
        password: hashPassword(account.password),
        full_name: account.full_name || input.client_name,
        phone: input.client_phone,
        city: input.client_city,
        address: input.client_address,
        role: 'client',
        permissions: {
          can_view_products: true,
          can_edit_products: false,
          can_validate_orders: false,
          can_follow_prospects: false,
          can_view_comptabilite: false,
          can_view_stocks: false,
        },
        referral_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        referred_by: null,
        cashback_balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      users.push(newUser);
      await writeUsersRaw(users);
      userId = newUser.id;
    }
  }

  const orderId = `o-${Date.now()}`;
  const itemsPayload = items.map((i, idx) => ({
    id: `${orderId}-item-${idx}`,
    order_id: orderId,
    product_id: i.product_id,
    product_name: i.product_name,
    unit_price: i.unit_price,
    quantity: i.quantity,
    line_total: i.unit_price * i.quantity,
  }));

  const order: Order = {
    id: orderId,
    order_number,
    user_id: userId,
    client_name: input.client_name,
    client_phone: input.client_phone,
    client_address: input.client_address,
    client_city: input.client_city,
    status: 'en_attente' as const,
    subtotal,
    delivery_fee: delivery,
    total,
    notes: input.notes ?? null,
    payment_method: 'cash_on_delivery',
    invoice_generated: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: itemsPayload,
  };

  const orders = await readOrdersRaw();
  orders.unshift(order);
  await writeOrdersRaw(orders);

  const res = NextResponse.json(
    { ...order, createdUser: newUser ? sanitizeUser(newUser) : undefined },
    { status: 201 }
  );
  // Connecte immédiatement l'invité en posant le cookie de session dev (lu par requireUser).
  if (newUser) {
    setDevSessionCookie(res, sanitizeUser(newUser));
  }
  return res;
}

/** Retire le mot de passe avant de sérialiser l'utilisateur dans un cookie. */
function sanitizeUser(u: Record<string, any>) {
  const { password: _pw, ...rest } = u;
  return rest;
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient, createSupabaseServerClient, AuthError } from '@/lib/supabase/server';
import { badRequest, forbidden, safeErrorResponse, unauthorized } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

const OrderItemSchema = z.object({
  product_id: z.string().min(1).max(80),
  product_name: z.string().min(1).max(200),
  unit_price: z.number().nonnegative().max(1_000_000),
  quantity: z.number().int().positive().max(1000),
});

const CreateOrderSchema = z.object({
  client_name: z.string().min(3).max(100),
  client_phone: z.string().regex(/^0[6-7][0-9]{8}$/, 'Numéro de téléphone invalide (06/07XXXXXXXX)'),
  client_city: z.string().min(1).max(60),
  client_address: z.string().min(5).max(200),
  notes: z.string().max(500).optional(),
  items: z.array(OrderItemSchema).min(1).max(50),
});

/** Génère un numéro de commande robuste basé sur crypto.randomUUID. */
function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const rnd = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `CMD-${year}-${rnd}`;
}

/** Helper local : renvoie l'utilisateur authentifié et son rôle, ou jette. */
async function getCaller(): Promise<{ id: string; role: 'admin' | 'client' }> {
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

/** POST : crée une commande pour l'utilisateur courant (peut être invité). */
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

  try {
    const subtotal = input.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const delivery = subtotal >= 2000 ? 0 : 50;
    const total = subtotal + delivery;

    const supabase = createSupabaseServiceRoleClient();
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

    const itemsPayload = input.items.map(i => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.unit_price * i.quantity,
    }));
    const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
    if (itemsErr) throw itemsErr;

    return NextResponse.json({ ...order, items: itemsPayload.map((p, idx) => ({ id: idx, ...p })) }, { status: 201 });
  } catch (e) {
    return safeErrorResponse(e);
  }
}

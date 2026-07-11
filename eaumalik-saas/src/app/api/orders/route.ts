import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrder, listOrders } from '@/data/repositories';

export const dynamic = 'force-dynamic';

const OrderItemSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string().min(1),
  unit_price: z.number().min(0),
  quantity: z.number().int().min(1),
});

const CreateOrderSchema = z.object({
  client_name: z.string().min(3).max(100),
  client_phone: z.string().regex(/^0[6-7][0-9]{8}$/, 'Format telephone invalide (06/07XXXXXXXX)'),
  client_city: z.string().min(1),
  client_address: z.string().min(5),
  notes: z.string().max(500).optional(),
  items: z.array(OrderItemSchema).min(1),
});

export async function GET() {
  try {
    const orders = await listOrders();
    return NextResponse.json(orders);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation echouee', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const order = await createOrder(parsed.data);
    return NextResponse.json(order, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

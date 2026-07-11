import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatus } from '@/data/repositories';

const VALID = ['en_attente', 'traitee', 'en_livraison', 'livree', 'annulee'] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const status = String(body.status ?? '');
    if (!VALID.includes(status as any)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }
    await updateOrderStatus(params.id, status as any);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

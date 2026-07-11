import { NextRequest, NextResponse } from 'next/server';
import { updateMaintenanceStatus } from '@/data/repositories';

const VALID = ['a_jour', 'a_renouveler', 'expire', 'rappel_envoye', 'commande_creee'] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const status = String(body.status ?? '');
    if (!VALID.includes(status as any)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }
    await updateMaintenanceStatus(params.id, status as any);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

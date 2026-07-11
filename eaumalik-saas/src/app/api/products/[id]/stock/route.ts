import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateProductStock } from '@/data/repositories';

const Schema = z.object({ delta: z.number().int() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'delta (entier) requis' }, { status: 400 });
    }
    await updateProductStock(params.id, parsed.data.delta);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

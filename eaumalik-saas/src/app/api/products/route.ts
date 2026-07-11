import { NextRequest, NextResponse } from 'next/server';
import { listProducts } from '@/data/repositories';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') ?? undefined;
  const featured = searchParams.get('featured') === 'true';
  const search = searchParams.get('search') ?? undefined;
  try {
    const products = await listProducts({ category, search, featured });
    return NextResponse.json(products);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

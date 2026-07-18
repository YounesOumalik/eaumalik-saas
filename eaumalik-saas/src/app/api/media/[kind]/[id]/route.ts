import { NextRequest, NextResponse } from 'next/server';
import { getPublicInlineImageSource } from '@/data/repositories';
import type { PublicMediaKind } from '@/lib/public-media';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const DATA_IMAGE_PATTERN =
  /^data:(image\/(?:avif|gif|jpe?g|png|webp));base64,([a-zA-Z0-9+/=\r\n]+)$/i;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function notFound() {
  return NextResponse.json(
    { error: 'Image introuvable.' },
    {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=60' },
    }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { kind: string; id: string } }
) {
  const kind = params.kind as PublicMediaKind;
  if (
    (kind !== 'product' && kind !== 'news') ||
    !ID_PATTERN.test(params.id)
  ) {
    return notFound();
  }

  const source = await getPublicInlineImageSource(kind, params.id);
  if (!source) return notFound();

  const match = DATA_IMAGE_PATTERN.exec(source);
  if (!match) return notFound();

  const contentType = match[1].toLowerCase() === 'image/jpg'
    ? 'image/jpeg'
    : match[1].toLowerCase();
  const body = Buffer.from(match[2], 'base64');
  if (body.length === 0 || body.length > MAX_IMAGE_BYTES) return notFound();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(body.length),
      'Cache-Control':
        'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export type PublicMediaKind = 'product' | 'news';

type MediaRecord = {
  id: string;
  image_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const INLINE_IMAGE_PATTERN =
  /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,/i;

/**
 * Remplace une image Base64 volumineuse par une URL locale stable. Le contenu
 * binaire est ensuite servi par /api/media et peut passer par next/image.
 */
export function withPublicMediaUrl<T extends MediaRecord>(
  kind: PublicMediaKind,
  record: T
): T {
  if (!record.image_url || !INLINE_IMAGE_PATTERN.test(record.image_url)) {
    return record;
  }

  const version = record.updated_at ?? record.created_at ?? '';
  const query = version ? `?v=${encodeURIComponent(version)}` : '';

  return {
    ...record,
    image_url: `/api/media/${kind}/${encodeURIComponent(record.id)}${query}`,
  };
}

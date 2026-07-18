import type { Product } from '@/types';

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

/**
 * DTO public explicite : empêche les colonnes historiques/non typées
 * (notamment image_url_local en Base64) et les prix de gros d'être sérialisés.
 */
export function toPublicProduct(record: Product): Product {
  const product: Product = {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    price: record.price,
    category: record.category,
    image_url: record.image_url,
    specs: record.specs,
    is_featured: record.is_featured,
    stock: record.stock,
    stock_alert_threshold: record.stock_alert_threshold,
    filter_lifespan_months: record.filter_lifespan_months,
    price_on_request: record.price_on_request,
    sort_order: record.sort_order,
    is_out_of_stock: record.is_out_of_stock,
    is_archived: record.is_archived,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };

  return withPublicMediaUrl('product', product);
}

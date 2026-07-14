'use server';

import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  requireAdmin,
  requireUser,
  getOptionalUser,
} from '@/lib/supabase/server';
import {
  readUsersRaw,
  readNewsRaw,
  writeNewsRaw,
  readProductsRaw,
} from '@/data/repositories';

// ============================================================================
// Helpers — bascule mock ↔ Supabase
// ============================================================================
function isMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

// ============================================================================
// Schémas Zod (validation stricte des payloads)
// ============================================================================
const ProfileUpdateSchema = z.object({
  full_name: z.string().min(3).max(100),
  phone: z.string().regex(/^0[6-7][0-9]{8}$/, 'Numéro marocain invalide.'),
  city: z.string().min(1),
  address: z.string().max(200).optional(),
  password: z
    .string()
    .min(8, 'Mot de passe trop court (min. 8 caractères).')
    .regex(/[A-Z]/, 'Doit contenir une majuscule.')
    .regex(/[0-9]/, 'Doit contenir un chiffre.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const NewsSchema = z.object({
  title: z.string().min(3, 'Titre trop court.').max(150),
  content: z.string().min(3, 'Contenu trop court.').max(4000),
  imageUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  // 1) Ciblage destinataires
  targetAll: z.boolean().default(true),
  targetUserIds: z.array(z.string()).default([]),
  // 2) Promotion (optionnelle)
  isPromotion: z.boolean().default(false),
  price: z
    .number({ invalid_type_error: 'Prix invalide.' })
    .positive('Le prix doit être strictement positif.')
    .max(1000000, 'Prix trop élevé.')
    .optional()
    .nullable(),
  originalPrice: z
    .number({ invalid_type_error: 'Prix original invalide.' })
    .positive()
    .max(1000000)
    .optional()
    .nullable(),
  productIds: z.array(z.string()).default([]),
  validUntil: z.string().optional().nullable(),
});

const MessageSchema = z.object({
  text: z.string().min(1).max(1000),
});

// ============================================================================
// Helpers
// ============================================================================
async function getCurrentUser() {
  const auth = await getOptionalUser();
  if (!auth) return null;

  // Mode mock : le profil complet vient de users.json (le cookie dev porte l'id).
  if (isMockMode()) {
    const allUsers = await readUsersRaw() as any[];
    const me = allUsers.find((u: any) => u.id === auth.id);
    return me ?? null;
  }

  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, phone, city, address, referral_code, cashback_balance, role')
    .eq('id', auth.id)
    .single();
  return profile as {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    city: string | null;
    address: string | null;
    referral_code: string | null;
    cashback_balance: number | null;
    role: 'admin' | 'client';
  } | null;
}

// ============================================================================
// Données du tableau de bord client
// ============================================================================
export async function getClientDashboardData() {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'Non authentifié.' };

  // Mock : lit users.json, orders (vide), news.json (avec filtrage par cible utilisateur).
  if (isMockMode()) {
    const allUsers = await readUsersRaw() as any[];
    const me = allUsers.find((u: any) => u.id === user.id);
    const referredUsers: any[] = [];
    if (me?.referred_by) {
      const ref = allUsers.find((u: any) => u.id === me.referred_by);
      if (ref) referredUsers.push({ id: ref.id, name: ref.full_name, email: ref.email });
    }
    const nowIso = new Date().toISOString();
    const newsRows = (await readNewsRaw() as any[]).filter((n: any) => {
      const valid = !n.valid_until || n.valid_until > nowIso;
      const target = n.target_all !== false;
      const targets = Array.isArray(n.target_user_ids) ? n.target_user_ids : [];
      return valid && (target || targets.includes(user.id));
    }).sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
    return {
      success: true as const,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone ?? '',
        city: user.city ?? '',
        address: user.address ?? '',
        referral_code: user.referral_code ?? '',
        cashback_balance: user.cashback_balance ?? 0,
      },
      referredUsers,
      userOrders: [], // Le mock ne gère pas les commandes client ↔ user ici.
      userMessages: [],
      news: newsRows,
    };
  }

  const supabase = createSupabaseServerClient();
  // Commandes : RLS applique auth.uid() = user_id côté DB.
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // News visibles par ce client (filtrage cible en PostgREST via OR).
  const { data: news } = await supabase
    .from('news')
    .select('*')
    .or(`target_all.eq.true,target_user_ids.cs.{${user.id}}`)
    .order('created_at', { ascending: false });

  return {
    success: true as const,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone ?? '',
      city: user.city ?? '',
      address: user.address ?? '',
      referral_code: user.referral_code ?? '',
      cashback_balance: user.cashback_balance ?? 0,
    },
    referredUsers: [], // Calculé en SQL si besoin (table fille).
    userOrders: orders ?? [],
    userMessages: [], // Voir table dédiée messages.
    news: news ?? [],
  };
}

// ============================================================================
// Messages client (chat support)
// ============================================================================
export async function sendClientMessageAction(raw: unknown) {
  const parsed = MessageSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: 'Message invalide.' };
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'Non authentifié.' };
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      sender_name: user.full_name,
      recipient_id: null, // null = broadcast admin
      text: parsed.data.text,
    })
    .select()
    .single();
  if (error || !data) return { success: false as const, error: 'Envoi échoué.' };
  revalidatePath('/client');
  return { success: true as const, message: data };
}

// ============================================================================
// Admin — liste / réponse messages
// ============================================================================
export async function getAdminMessagesList() {
  await requireAdmin();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) return { success: false as const, error: 'Lecture impossible.' };

  // Groupement par client.
  const clientsMap = new Map<string, any>();
  for (const m of data ?? []) {
    const clientId = m.sender_id ?? 'admin';
    if (!clientsMap.has(clientId)) {
      clientsMap.set(clientId, {
        clientId,
        clientName: m.sender_name ?? 'Client',
        lastMessage: m.text,
        timestamp: m.timestamp,
        messages: [],
      });
    }
    clientsMap.get(clientId)!.messages.push(m);
  }
  return { success: true as const, clients: Array.from(clientsMap.values()) };
}

export async function sendAdminReplyAction(clientId: string, raw: unknown) {
  const parsed = MessageSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: 'Message invalide.' };
  await requireAdmin();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: null, // null = admin
      sender_name: 'Administrateur EAUMALIK',
      recipient_id: clientId,
      text: parsed.data.text,
    })
    .select()
    .single();
  if (error || !data) return { success: false as const, error: 'Envoi échoué.' };
  revalidatePath('/client');
  return { success: true as const, message: data };
}

// ============================================================================
// News / Actualités / Promotions
// ============================================================================
type NewsInsertPayload = {
  title: string;
  content: string;
  image_url: string | null;
  price: number | null;
  original_price: number | null;
  product_ids: string[];
  target_all: boolean;
  target_user_ids: string[];
  is_promotion: boolean;
  valid_until: string | null;
};

function buildNewsPayload(input: z.infer<typeof NewsSchema>): NewsInsertPayload {
  const productIds = Array.isArray(input.productIds) ? input.productIds : [];
  const targetIds = Array.isArray(input.targetUserIds) ? input.targetUserIds : [];
  const priceVal = typeof input.price === 'number' && input.price > 0 ? input.price : null;
  const originalVal =
    typeof input.originalPrice === 'number' && input.originalPrice > 0 ? input.originalPrice : null;
  const hasPrice = priceVal !== null;
  const isPromotion = input.isPromotion === true || hasPrice || productIds.length > 0;
  return {
    title: input.title.trim(),
    content: input.content.trim(),
    image_url: input.imageUrl ?? null,
    price: priceVal,
    original_price: originalVal,
    product_ids: productIds,
    target_all: input.targetAll !== false,
    target_user_ids: input.targetAll ? [] : targetIds,
    is_promotion: isPromotion,
    valid_until: input.validUntil ?? null,
  };
}

export async function publishNewsAction(raw: unknown) {
  const parsed = NewsSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  // Garde admin (en mock la session dev est garantie par le middleware).
  if (!isMockMode()) await requireAdmin();
  const payload = buildNewsPayload(parsed.data);

  // ---------- MOCK : écrit dans data-store/news.json ----------
  if (isMockMode()) {
    const id = `news-${Date.now()}`;
    const now = new Date().toISOString();
    const row = { id, created_at: now, ...payload, is_archived: false, archived_at: null, archived_reason: null };
    const rows = await readNewsRaw();
    rows.unshift(row);
    await writeNewsRaw(rows);
    revalidatePath('/client');
    revalidatePath('/');
    revalidatePath('/crm/news');
    revalidatePath('/admin/publications');
    return { success: true as const, news: row };
  }

  // ---------- SUPABASE (service role, bypass RLS) ----------
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('news')
    .insert(payload)
    .select()
    .single();
  if (error || !data) return { success: false as const, error: 'Publication échouée.' };
  revalidatePath('/client');
  revalidatePath('/');
  return { success: true as const, news: data };
}

/**
 * Met à jour une actualité / promotion existante à partir du formulaire CRM
 * (mêmes champs camelCase que `publishNewsAction`).
 *
 * En mode mock, on patche directement dans data-store/news.json.
 * En mode Supabase, on patche uniquement les colonnes du payload (le reste est
 * préservé côté DB).
 */
export async function updateNewsFromCrmAction(id: string, raw: unknown) {
  if (!id || typeof id !== 'string') {
    return { success: false as const, error: 'Identifiant manquant.' };
  }
  const parsed = NewsSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  if (!isMockMode()) await requireAdmin();
  const payload = buildNewsPayload(parsed.data);

  // ---------- MOCK ----------
  if (isMockMode()) {
    const rows = await readNewsRaw();
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) return { success: false as const, error: 'Actualité introuvable.' };
    const existing = rows[idx];
    const updated = {
      ...existing,
      ...payload,
      id,
      // On ne touche pas au flag d'archive via l'update « normal »
      is_archived: existing.is_archived === true,
      archived_at: existing.archived_at ?? null,
      archived_reason: existing.archived_reason ?? null,
    };
    rows[idx] = updated;
    await writeNewsRaw(rows);
    revalidatePath('/client');
    revalidatePath('/');
    revalidatePath('/crm/news');
    revalidatePath('/admin/publications');
    return { success: true as const, news: updated };
  }

  // ---------- SUPABASE ----------
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('news')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error || !data) return { success: false as const, error: 'Mise à jour échouée.' };
  revalidatePath('/client');
  revalidatePath('/');
  revalidatePath('/admin/publications');
  return { success: true as const, news: data };
}

/**
 * Supprime définitivement une actualité / promotion. Bypass admin gate en mock
 * (la session dev est garantie par le middleware).
 */
export async function deleteNewsFromCrmAction(id: string) {
  if (!id || typeof id !== 'string') {
    return { success: false as const, error: 'Identifiant manquant.' };
  }
  if (!isMockMode()) await requireAdmin();

  if (isMockMode()) {
    const rows = await readNewsRaw();
    const filtered = rows.filter((r: any) => r.id !== id);
    if (filtered.length === rows.length) {
      return { success: false as const, error: 'Actualité introuvable.' };
    }
    await writeNewsRaw(filtered);
    revalidatePath('/admin/publications');
    revalidatePath('/');
    revalidatePath('/client');
    return { success: true as const };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from('news').delete().eq('id', id);
  if (error) return { success: false as const, error: 'Suppression échouée.' };
  revalidatePath('/admin/publications');
  revalidatePath('/');
  revalidatePath('/client');
  return { success: true as const };
}

/**
 * Archive (soft-delete) une actualité / promotion. La publication disparaît
 * du carrousel landing, de la boutique et de l'espace client, mais reste
 * listée dans l'admin pour restauration ultérieure.
 */
export async function archiveNewsAction(id: string, reason?: string | null) {
  if (!id || typeof id !== 'string') {
    return { success: false as const, error: 'Identifiant manquant.' };
  }
  if (!isMockMode()) await requireAdmin();
  const now = new Date().toISOString();

  if (isMockMode()) {
    const rows = await readNewsRaw();
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) return { success: false as const, error: 'Actualité introuvable.' };
    const updated = {
      ...rows[idx],
      is_archived: true,
      archived_at: now,
      archived_reason: reason ?? rows[idx].archived_reason ?? null,
    };
    rows[idx] = updated;
    await writeNewsRaw(rows);
    revalidatePath('/admin/publications');
    revalidatePath('/');
    revalidatePath('/client');
    return { success: true as const, news: updated };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('news')
    .update({ is_archived: true, archived_at: now, archived_reason: reason ?? null })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) return { success: false as const, error: 'Archivage échoué.' };
  revalidatePath('/admin/publications');
  revalidatePath('/');
  revalidatePath('/client');
  return { success: true as const, news: data };
}

/** Restaure (désarchive) une actualité / promotion. */
export async function unarchiveNewsAction(id: string) {
  if (!id || typeof id !== 'string') {
    return { success: false as const, error: 'Identifiant manquant.' };
  }
  if (!isMockMode()) await requireAdmin();

  if (isMockMode()) {
    const rows = await readNewsRaw();
    const idx = rows.findIndex((r: any) => r.id === id);
    if (idx === -1) return { success: false as const, error: 'Actualité introuvable.' };
    const updated = {
      ...rows[idx],
      is_archived: false,
      archived_at: null,
      archived_reason: null,
    };
    rows[idx] = updated;
    await writeNewsRaw(rows);
    revalidatePath('/admin/publications');
    revalidatePath('/');
    revalidatePath('/client');
    return { success: true as const, news: updated };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('news')
    .update({ is_archived: false, archived_at: null, archived_reason: null })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) return { success: false as const, error: 'Restauration échouée.' };
  revalidatePath('/admin/publications');
  revalidatePath('/');
  revalidatePath('/client');
  return { success: true as const, news: data };
}

/**
 * Liste TOUTES les actualités (actives + archivées) pour l'écran d'admin
 * `/admin/publications`. Triées du plus récent au plus ancien.
 */
export async function listAdminNewsAction() {
  if (!isMockMode()) await requireAdmin();
  const rows = await readNewsRaw();
  // Tri desc par created_at, archivées en queue pour visibilité rapide
  const sorted = [...rows].sort((a: any, b: any) => {
    const aArch = a.is_archived === true ? 1 : 0;
    const bArch = b.is_archived === true ? 1 : 0;
    if (aArch !== bArch) return aArch - bArch; // actives d'abord
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
  return { success: true as const, news: sorted };
}

/**
 * Liste les produits du catalogue disponibles pour le sélecteur de promotion.
 * Retourne uniquement les produits non archivés, triés par catégorie puis nom.
 */
export async function getAvailableProductsForNewsAction() {
  if (!isMockMode()) await requireAdmin();
  const now = new Date().toISOString();
  if (isMockMode()) {
    const products = (await readProductsRaw())
      .filter((p: any) => !p.is_archived)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        image_url: p.image_url ?? null,
        stock: p.stock ?? 0,
      }));
    return { success: true as const, products };
  }
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, category, image_url, stock')
    .or('is_archived.is.null,is_archived.eq.false')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) return { success: false as const, error: 'Lecture produits impossible.' };
  return { success: true as const, products: (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    category: p.category,
    image_url: p.image_url ?? null,
    stock: p.stock ?? 0,
  })) };
}

/**
 * Liste les clients destinataires potentiels pour le ciblage de la publication.
 * Identité minimale : id, full_name, email, city.
 */
export async function getAvailableClientsForNewsAction() {
  if (!isMockMode()) await requireAdmin();
  if (isMockMode()) {
    const clients = (await readUsersRaw() as any[])
      .filter((u: any) => u.role === 'client')
      .map((u: any) => ({
        id: u.id,
        full_name: u.full_name ?? u.email ?? 'Client',
        email: u.email,
        city: u.city ?? null,
      }));
    return { success: true as const, clients };
  }
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, city')
    .eq('role', 'client')
    .order('full_name', { ascending: true });
  if (error) return { success: false as const, error: 'Lecture clients impossible.' };
  return { success: true as const, clients: data ?? [] };
}

// ============================================================================
// Panier
// ============================================================================
export async function saveUserCartAction(items: unknown) {
  await requireUser();
  // Le panier reste local — on garde l'API pour future synchro.
  return { success: true as const };
}

export async function getUserCartAction() {
  await requireUser();
  return { success: true as const, items: [] as unknown[] };
}

// ============================================================================
// Profil client
// ============================================================================
export async function getUserProfileAction() {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'Non authentifié.' };
  return { success: true as const, profile: user };
}

export async function updateUserProfileAction(raw: unknown) {
  const parsed = ProfileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'Non authentifié.' };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('users')
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      city: parsed.data.city,
      address: parsed.data.address ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);
  if (error) return { success: false as const, error: 'Mise à jour échouée.' };

  // Mise à jour du mot de passe dans Supabase Auth (séparé du profil).
  if (parsed.data.password) {
    const { error: pwdErr } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (pwdErr) return { success: false as const, error: 'Mot de passe non mis à jour.' };
  }
  revalidatePath('/client');
  return { success: true as const };
}

'use server';

/**
 * Server actions pour la gestion des commandes côté personnel (admin / staff).
 *
 * Ce module héberge notamment `createManualOrderAction` qui permet à un
 * agent authentifié de saisir manuellement une commande au nom d'un client
 * (par téléphone, en boutique, etc.).
 *
 * Logique de parrainage (cf. consigne produit 2026-07-15) :
 *   - Le parrain de la nouvelle commande est AUTOMATIQUEMENT le compte
 *     utilisateur (personnel) actuellement connecté.
 *   - Si l'agent n'existe pas encore dans `users` (cas typique : superadmin),
 *     on crée à la volée un profil technique `role: client` avec un
 *     `referral_code` généré pour qu'il puisse servir de parrain.
 *
 * Le client final est aussi créé/mis à jour à la volée (création de compte
 * à la première commande, comme dans le checkout invité).
 */
import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createSupabaseServiceRoleClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';
import { isMockMode } from '@/lib/api-guard';
import {
  readOrdersRaw,
  writeOrdersRaw,
  readUsersRaw,
  writeUsersRaw,
  listProducts,
} from '@/data/repositories';
import { getDevUserFromCookie } from '@/lib/auth/devSession';
import type { Order, OrderItem } from '@/types';

// ============================================================================
// Schémas Zod
// ============================================================================
const ManualItemSchema = z.object({
  product_id: z.string().min(1).max(80),
  quantity: z.number().int().positive().max(1000),
});

const ManualOrderSchema = z.object({
  client_name: z.string().min(3, 'Nom trop court.').max(100),
  client_phone: z
    .string()
    .regex(/^0[6-7][0-9]{8}$/, 'Numéro marocain invalide (06/07XXXXXXXX).'),
  client_address: z.string().min(5, 'Adresse trop courte.').max(200),
  client_city: z.string().min(1).max(60),
  notes: z.string().max(500).optional(),
  items: z.array(ManualItemSchema).min(1, 'Ajoutez au moins un produit.').max(50),
});

// ============================================================================
// Helpers
// ============================================================================
function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  // crypto disponible en Node ≥ 19 et Edge runtime.
  const rnd = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `CMD-${year}-${rnd}`;
}

function generateReferralCode(): string {
  // 8 caractères alphanumériques en majuscules.
  return Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, 'X').slice(0, 8);
}

/** Récupère l'agent connecté (id + email + full_name + role) depuis la session
 *  Supabase ou le cookie de session dev en mode mock. */
async function getCurrentAgent(): Promise<{
  id: string;
  email: string;
  full_name: string;
  role: string;
}> {
  // Mode mock : lit depuis le cookie dev.
  const dev = await getDevUserFromCookie();
  if (dev) {
    return {
      id: dev.id,
      email: dev.email,
      full_name: dev.full_name ?? dev.email,
      role: dev.role,
    };
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Authentification requise.');
  const admin = createSupabaseServiceRoleClient();
  const { data: profile } = await admin
    .from('users')
    .select('id, email, full_name, role')
    .eq('id', data.user.id)
    .single();
  return {
    id: profile?.id ?? data.user.id,
    email: profile?.email ?? data.user.email ?? '',
    full_name: profile?.full_name ?? data.user.email ?? '',
    role: profile?.role ?? 'client',
  };
}

// ============================================================================
// createManualOrderAction
// ============================================================================
export type CreateManualOrderInput = z.infer<typeof ManualOrderSchema>;

export interface CreateManualOrderResult {
  success: boolean;
  order?: Order;
  /** Code parrain utilisé pour la commande (= parrain effectif). */
  referrer_code?: string;
  error?: string;
}

/**
 * Crée une commande manuelle au nom d'un client :
 *   - Le client est créé/mis à jour dans `users` (rôle `client`).
 *   - Le parrain = l'agent connecté (créé dans `users` en `role: client`
 *     s'il n'existait pas encore avec ce rôle — cas typique du superadmin).
 *
 * Revalide ensuite `/commandes` pour rafraîchir la vue personnel.
 */
export async function createManualOrderAction(
  input: CreateManualOrderInput
): Promise<CreateManualOrderResult> {
  const parsed = ManualOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides.',
    };
  }
  const data = parsed.data;

  // Garde : seul le personnel authentifié peut créer une commande manuelle.
  let agent;
  try {
    agent = await getCurrentAgent();
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Authentification requise.' };
  }

  // Le parrain DOIT être dans la table `users` avec un `referral_code`.
  // Si l'agent n'a pas de profil `users` (cas admin-only), on en crée un
  // minimal en `role: client` (sans permissions staff) pour qu'il puisse
  // être référencé comme parrain.
  let referrer: { id: string; referral_code: string };
  try {
    referrer = await ensureReferrer(agent);
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Impossible de définir le parrain.' };
  }

  // 1) Vérifie que tous les produits existent et récupère leurs noms/prix.
  const products = await listProducts();
  const productMap = new Map(products.map(p => [p.id, p]));
  const itemsPayload: Array<{
    product_id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
  }> = [];
  for (const it of data.items) {
    const p = productMap.get(it.product_id);
    if (!p) {
      return { success: false, error: `Produit introuvable : ${it.product_id}` };
    }
    itemsPayload.push({
      product_id: p.id,
      product_name: p.name,
      unit_price: p.price,
      quantity: it.quantity,
    });
  }

  // 2) Crée ou met à jour le compte client.
  let clientUserId: string;
  try {
    clientUserId = await upsertClient({
      name: data.client_name,
      phone: data.client_phone,
      city: data.client_city,
      address: data.client_address,
      referrerId: referrer.id,
    });
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Création du client impossible.' };
  }

  // 3) Crée la commande.
  const subtotal = itemsPayload.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const delivery = subtotal >= 2000 ? 0 : 50;
  const total = subtotal + delivery;
  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();

  if (isMockMode()) {
    const id = `o-${Date.now()}`;
    const order: Order = {
      id,
      order_number: orderNumber,
      user_id: clientUserId,
      client_name: data.client_name,
      client_phone: data.client_phone,
      client_address: data.client_address,
      client_city: data.client_city,
      status: 'en_attente',
      subtotal,
      delivery_fee: delivery,
      total,
      notes: buildNotes(data.notes, agent, referrer.referral_code, 'mock'),
      payment_method: 'cash_on_delivery',
      invoice_generated: false,
      created_at: now,
      updated_at: now,
      items: itemsPayload.map((i, idx) => ({
        id: `${id}-item-${idx}`,
        order_id: id,
        product_id: i.product_id,
        product_name: i.product_name,
        unit_price: i.unit_price,
        quantity: i.quantity,
        line_total: i.unit_price * i.quantity,
      })),
    };
    const list = await readOrdersRaw();
    list.unshift(order);
    await writeOrdersRaw(list);
    revalidatePath('/commandes');
    return { success: true, order, referrer_code: referrer.referral_code };
  }

  // --- Mode Supabase ---
  const supabase = createSupabaseServiceRoleClient();
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      user_id: clientUserId,
      client_name: data.client_name,
      client_phone: data.client_phone,
      client_address: data.client_address,
      client_city: data.client_city,
      status: 'en_attente',
      subtotal,
      delivery_fee: delivery,
      total,
      notes: buildNotes(data.notes, agent, referrer.referral_code, 'supabase'),
      payment_method: 'cash_on_delivery',
    })
    .select()
    .single();
  if (error || !order) {
    return { success: false, error: error?.message ?? 'Création commande échouée.' };
  }

  const itemsRows: Omit<OrderItem, 'id'>[] = itemsPayload.map(i => ({
    order_id: order.id,
    product_id: i.product_id,
    product_name: i.product_name,
    unit_price: i.unit_price,
    quantity: i.quantity,
    line_total: i.unit_price * i.quantity,
  }));
  const { error: itemsErr } = await supabase.from('order_items').insert(itemsRows);
  if (itemsErr) {
    return { success: false, error: itemsErr.message };
  }

  revalidatePath('/commandes');
  return {
    success: true,
    order: {
      ...(order as Order),
      items: itemsRows.map((r, idx) => ({ id: String(idx), ...r })),
    },
    referrer_code: referrer.referral_code,
  };
}

// ============================================================================
// Helpers internes
// ============================================================================

/** Construit le champ `notes` standardisé d'une commande manuelle :
 *  conserve la note libre de l'agent + trace l'agent et le parrain utilisé. */
function buildNotes(
  userNotes: string | undefined,
  agent: { id: string; email: string; full_name: string; role: string },
  referrerCode: string,
  mode: 'mock' | 'supabase'
): string | null {
  const lines: string[] = [];
  lines.push(`[Commande manuelle — ${new Date().toISOString().slice(0, 19).replace('T', ' ')}]`);
  lines.push(
    `Saisie par : ${agent.full_name} <${agent.email}> (${agent.role}) [${agent.id}]`
  );
  lines.push(`Parrain (compte utilisateur actif) : code ${referrerCode}`);
  if (userNotes && userNotes.trim()) {
    lines.push(`Note libre : ${userNotes.trim()}`);
  }
  lines.push(`Source : saisie manuelle agent (${mode})`);
  return lines.join('\n');
}

/**
 * Garantit qu'un profil parrain existe dans `users` pour l'agent connecté.
 * - En mode mock : cherche/écrit dans users.json.
 * - En mode Supabase : cherche/crée via le service role.
 *
 * Renvoie l'id du parrain et son `referral_code` (créé si manquant).
 */
async function ensureReferrer(agent: {
  id: string;
  email: string;
  full_name: string;
  role: string;
}): Promise<{ id: string; referral_code: string }> {
  if (isMockMode()) {
    const users = await readUsersRaw();
    // 1) Cherche par id exact (cas où l'agent a déjà un profil client).
    let referrer = users.find((u: any) => u.id === agent.id);
    if (referrer) {
      if (!referrer.referral_code) {
        referrer.referral_code = generateReferralCode();
        await writeUsersRaw(users);
      }
      return { id: referrer.id, referral_code: referrer.referral_code };
    }
    // 2) Cherche par email (au cas où l'agent a un profil admin distinct).
    referrer = users.find(
      (u: any) => (u.email ?? '').toLowerCase() === agent.email.toLowerCase()
    );
    if (referrer) {
      if (!referrer.referral_code) {
        referrer.referral_code = generateReferralCode();
        await writeUsersRaw(users);
      }
      return { id: referrer.id, referral_code: referrer.referral_code };
    }
    // 3) Crée un profil technique `role: client` (sans permissions staff) pour
    //    servir de parrain. Cas typique : superadmin qui n'a pas de ligne dans users.
    const newReferrer = {
      id: agent.id,
      email: agent.email,
      full_name: agent.full_name || agent.email,
      role: 'client',
      referral_code: generateReferralCode(),
      referred_by: null,
      cashback_balance: 0,
      permissions: {
        can_view_products: false,
        can_edit_products: false,
        can_validate_orders: false,
        can_follow_prospects: false,
        can_view_comptabilite: false,
        can_view_stocks: false,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    users.push(newReferrer);
    await writeUsersRaw(users);
    return { id: newReferrer.id, referral_code: newReferrer.referral_code };
  }

  // --- Mode Supabase ---
  const admin = createSupabaseServiceRoleClient();
  // 1) Cherche par id exact.
  let { data: referrer } = await admin
    .from('users')
    .select('id, referral_code')
    .eq('id', agent.id)
    .maybeSingle();
  if (referrer?.id) {
    if (!referrer.referral_code) {
      const code = generateReferralCode();
      await admin
        .from('users')
        .update({ referral_code: code, updated_at: new Date().toISOString() })
        .eq('id', referrer.id);
      return { id: referrer.id, referral_code: code };
    }
    return { id: referrer.id, referral_code: referrer.referral_code };
  }
  // 2) Cherche par email.
  const res = await admin
    .from('users')
    .select('id, referral_code')
    .eq('email', agent.email)
    .maybeSingle();
  referrer = res.data ?? null;
  if (referrer?.id) {
    if (!referrer.referral_code) {
      const code = generateReferralCode();
      await admin
        .from('users')
        .update({ referral_code: code, updated_at: new Date().toISOString() })
        .eq('id', referrer.id);
      return { id: referrer.id, referral_code: code };
    }
    return { id: referrer.id, referral_code: referrer.referral_code };
  }
  // 3) Crée un profil parrain technique.
  const code = generateReferralCode();
  const { data: created, error } = await admin
    .from('users')
    .insert({
      id: agent.id,
      email: agent.email,
      full_name: agent.full_name || agent.email,
      role: 'client',
      referral_code: code,
      referred_by: null,
      cashback_balance: 0,
    })
    .select('id, referral_code')
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? 'Création du profil parrain impossible.');
  }
  return { id: created.id, referral_code: created.referral_code };
}

/**
 * Crée ou met à jour le client final :
 *  - Si un client avec ce téléphone existe → met à jour son `referred_by`
 *    s'il n'en avait pas (= le parrain s'aligne sur l'agent actif si le
 *    client n'avait pas encore été parrainé). En cas de conflit, on
 *    n'écrase PAS le parrain existant (l'agent "vole" pas un filleul déjà
 *    attribué).
 *  - Sinon, crée un nouveau client `role: client` avec `referred_by = referrerId`.
 */
async function upsertClient(args: {
  name: string;
  phone: string;
  city: string;
  address: string;
  referrerId: string;
}): Promise<string> {
  if (isMockMode()) {
    const users = await readUsersRaw();
    let client = users.find(
      (u: any) => u.role === 'client' && (u.phone ?? '') === args.phone
    );
    if (client) {
      // Met à jour les infos, mais ne change pas `referred_by` s'il existe déjà.
      client.full_name = args.name;
      client.city = args.city;
      client.address = args.address;
      if (!client.referred_by) client.referred_by = args.referrerId;
      if (!client.referral_code) client.referral_code = generateReferralCode();
      client.updated_at = new Date().toISOString();
      await writeUsersRaw(users);
      return client.id;
    }
    const newClient = {
      id: `u-${Date.now()}`,
      email: `client-${args.phone}@eaumalik.local`,
      full_name: args.name,
      phone: args.phone,
      city: args.city,
      address: args.address,
      role: 'client',
      referral_code: generateReferralCode(),
      referred_by: args.referrerId,
      cashback_balance: 0,
      permissions: {
        can_view_products: false,
        can_edit_products: false,
        can_validate_orders: false,
        can_follow_prospects: false,
        can_view_comptabilite: false,
        can_view_stocks: false,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    users.push(newClient);
    await writeUsersRaw(users);
    return newClient.id;
  }

  // --- Mode Supabase ---
  const admin = createSupabaseServiceRoleClient();
  const { data: existing } = await admin
    .from('users')
    .select('id, referred_by, referral_code')
    .eq('phone', args.phone)
    .eq('role', 'client')
    .maybeSingle();
  if (existing?.id) {
    const update: Record<string, any> = {
      full_name: args.name,
      city: args.city,
      address: args.address,
      updated_at: new Date().toISOString(),
    };
    if (!existing.referred_by) update.referred_by = args.referrerId;
    if (!existing.referral_code) update.referral_code = generateReferralCode();
    await admin.from('users').update(update).eq('id', existing.id);
    return existing.id;
  }
  const { data: created, error } = await admin
    .from('users')
    .insert({
      email: `client-${args.phone}@eaumalik.local`,
      full_name: args.name,
      phone: args.phone,
      city: args.city,
      address: args.address,
      role: 'client',
      referral_code: generateReferralCode(),
      referred_by: args.referrerId,
      cashback_balance: 0,
    })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? 'Création du client impossible.');
  }
  return created.id;
}

// ============================================================================
// getReferrerProfileAction
// ============================================================================
export interface ReferrerProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  referral_code: string;
}

/**
 * Renvoie le profil parrain (= compte agent actuellement connecté) qui sera
 * automatiquement attribué aux nouvelles commandes manuelles. Utilisé par
 * l'UI pour afficher le bandeau "Parrain automatique" dans la modale.
 *
 * Le parrain est celui de `users` correspondant au compte connecté :
 *  - Si l'agent a déjà un profil dans `users` → on le renvoie tel quel.
 *  - Sinon (cas superadmin), on PRÉ-VISUALISE le profil technique qui sera
 *    créé (rôle `client`, code parrain généré à la volée — NON persisté tant
 *    qu'aucune commande n'est créée). Le code sera figé à la première
 *    commande manuelle réussie.
 */
export async function getReferrerProfileAction(): Promise<ReferrerProfile | null> {
  let agent;
  try {
    agent = await getCurrentAgent();
  } catch {
    return null;
  }

  if (isMockMode()) {
    const users = await readUsersRaw();
    const existing =
      users.find((u: any) => u.id === agent.id) ??
      users.find(
        (u: any) => (u.email ?? '').toLowerCase() === agent.email.toLowerCase()
      );
    if (existing) {
      return {
        id: existing.id,
        full_name: existing.full_name ?? agent.full_name,
        email: existing.email ?? agent.email,
        role: existing.role ?? 'client',
        referral_code: existing.referral_code ?? '(sera généré)',
      };
    }
    // Pas encore de profil : on indique qu'il sera créé à la 1re commande.
    return {
      id: agent.id,
      full_name: agent.full_name,
      email: agent.email,
      role: agent.role,
      referral_code: '(sera généré à la première commande)',
    };
  }

  // Mode Supabase
  const admin = createSupabaseServiceRoleClient();
  const { data: byId } = await admin
    .from('users')
    .select('id, full_name, email, role, referral_code')
    .eq('id', agent.id)
    .maybeSingle();
  if (byId) {
    return {
      id: byId.id,
      full_name: byId.full_name ?? agent.full_name,
      email: byId.email ?? agent.email,
      role: byId.role ?? agent.role,
      referral_code: byId.referral_code ?? '(sera généré)',
    };
  }
  const { data: byEmail } = await admin
    .from('users')
    .select('id, full_name, email, role, referral_code')
    .eq('email', agent.email)
    .maybeSingle();
  if (byEmail) {
    return {
      id: byEmail.id,
      full_name: byEmail.full_name ?? agent.full_name,
      email: byEmail.email ?? agent.email,
      role: byEmail.role ?? agent.role,
      referral_code: byEmail.referral_code ?? '(sera généré)',
    };
  }
  return {
    id: agent.id,
    full_name: agent.full_name,
    email: agent.email,
    role: agent.role,
    referral_code: '(sera généré à la première commande)',
  };
}
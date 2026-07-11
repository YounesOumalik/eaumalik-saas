'use server';

import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
  requireAdmin,
  requireUser,
} from '@/lib/supabase/server';

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
  title: z.string().min(3).max(150),
  content: z.string().min(3).max(2000),
  imageUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
});

const MessageSchema = z.object({
  text: z.string().min(1).max(1000),
});

// ============================================================================
// Helpers
// ============================================================================
async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, phone, city, address, referral_code, cashback_balance, role')
    .eq('id', data.user.id)
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
  const supabase = createSupabaseServerClient();
  // Commandes : RLS applique auth.uid() = user_id côté DB.
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
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
    news: [], // Voir table news.
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
// News / Actualités
// ============================================================================
export async function publishNewsAction(raw: unknown) {
  const parsed = NewsSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  await requireAdmin();
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('news')
    .insert({
      title: parsed.data.title,
      content: parsed.data.content,
      image_url: parsed.data.imageUrl ?? null,
    })
    .select()
    .single();
  if (error || !data) return { success: false as const, error: 'Publication échouée.' };
  revalidatePath('/client');
  revalidatePath('/');
  return { success: true as const, news: data };
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

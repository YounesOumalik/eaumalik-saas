'use server';

import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { readMessages, writeMessages } from '@/data/localDb';
import { isMockMode } from '@/lib/api-guard';

// ============================================================================
// Schéma — demande de contact / devis public (visiteur anonyme)
// ============================================================================
const PublicInquirySchema = z.object({
  name: z.string().min(2, 'Nom trop court.').max(100),
  phone: z.string().min(8, 'Téléphone invalide.').max(20),
  email: z.string().email('Email invalide.').optional().or(z.literal('')),
  subject: z.string().max(100).optional().or(z.literal('')),
  sector: z.string().max(100).optional().or(z.literal('')),
  company: z.string().max(100).optional().or(z.literal('')),
  volume: z.string().max(50).optional().or(z.literal('')),
  message: z.string().min(1, 'Message vide.').max(2000),
});

// ============================================================================
// Action publique — aucune authentification requise
// Persiste la demande dans la table `messages` (sender_id = NULL,
// réservé au service role) afin qu'elle soit visible par le CRM admin.
// ============================================================================
export async function submitPublicInquiryAction(raw: unknown) {
  const parsed = PublicInquirySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }

  const { name, phone, email, subject, sector, company, volume, message } = parsed.data;

  const details = [
    sector ? `Type: Devis industriel — ${sector}` : 'Type: Contact général',
    `Nom: ${name}`,
    `Téléphone: ${phone}`,
    email ? `Email: ${email}` : null,
    company ? `Société: ${company}` : null,
    volume ? `Volume estimé: ${volume}` : null,
    subject ? `Sujet: ${subject}` : null,
    `Message: ${message}`,
  ]
    .filter(Boolean)
    .join('\n');

  const row = {
    sender_id: null,
    sender_name: name,
    sender_kind: 'public',
    recipient_id: null,
    text: details,
  };

  // Mode mock : écriture directe dans le data-store local.
  if (isMockMode()) {
    const list = readMessages();
    list.push({
      id: `msg-${Date.now()}`,
      ...row,
      timestamp: new Date().toISOString(),
    });
    writeMessages(list);
    return { success: true as const };
  }

  // Mode Supabase : insertion via le client service-role (bypass RLS,
  // autorise sender_id = NULL pour les invités).
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from('messages').insert(row);
  if (error) return { success: false as const, error: 'Envoi échoué.' };

  revalidatePath('/');
  revalidatePath('/crm/clients');
  revalidatePath('/crm/messages');
  return { success: true as const };
}

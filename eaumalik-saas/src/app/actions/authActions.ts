'use server';

import 'server-only';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const RegisterSchema = z.object({
  email: z.string().email('Email invalide.'),
  password: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.'),
  full_name: z.string().min(3, 'Nom complet trop court (min. 3 caractères).').max(100),
  phone: z.string().regex(/^0[6-7][0-9]{8}$/, 'Numéro de téléphone marocain invalide (ex: 06XXXXXXXX).'),
  city: z.string().min(1, 'Ville obligatoire.'),
  address: z.string().max(200).optional(),
  referredBy: z.string().max(20).optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/** Inscription d'un client via Supabase Auth. */
export async function registerUserAction(input: RegisterInput) {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? 'Validation échouée.',
    };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        city: parsed.data.city,
        address: parsed.data.address ?? null,
        referred_by: parsed.data.referredBy ?? null,
      },
      emailRedirectTo:
        process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
          : undefined,
    },
  });

  if (error || !data.user) {
    return {
      success: false as const,
      error: 'Inscription impossible. Vérifiez votre email ou réessayez plus tard.',
    };
  }

  return {
    success: true as const,
    user: { id: data.user.id, email: data.user.email ?? '', full_name: parsed.data.full_name },
  };
}

/** Renvoie les permissions effectives de l'utilisateur courant. */
export async function getCurrentUserPermissionsAction() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return { success: false as const, error: 'Non authentifié.' };

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .single();

    const role = (profile?.role as 'admin' | 'client') ?? 'client';
    const isAdmin = role === 'admin';

    return {
      success: true as const,
      role,
      permissions: {
        can_view_products: isAdmin,
        can_edit_products: isAdmin,
        can_validate_orders: isAdmin,
        can_follow_prospects: isAdmin,
        can_view_comptabilite: isAdmin,
        can_view_stocks: isAdmin,
      },
    };
  } catch {
    return { success: false as const, error: 'Erreur lors de la lecture des permissions.' };
  }
}

import { z } from 'zod';

/** Politique commune aux nouveaux mots de passe et aux réinitialisations. */
export const PASSWORD_MIN_LENGTH = 12;

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`)
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.');

export function passwordPolicyMessage(password: string, confirmation?: string): string | null {
  const result = strongPasswordSchema.safeParse(password);
  if (!result.success) return result.error.issues[0]?.message ?? 'Mot de passe invalide.';
  if (confirmation !== undefined && password !== confirmation) {
    return 'Les deux mots de passe ne correspondent pas.';
  }
  return null;
}

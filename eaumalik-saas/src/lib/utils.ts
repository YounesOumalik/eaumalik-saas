import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatte un prix en MAD (fr-MA style) */
export function formatCurrency(price: number): string {
  return price.toLocaleString('fr-MA') + ' DH';
}

/** Formatte une date ISO en fr-FR */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

/** Jours restants avant une date (négatif = en retard) */
export function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Génère un numéro de commande unique */
export function generateOrderNumber(prefix = 'CMD-2025'): string {
  const r = Math.floor(Math.random() * 9000) + 1000;
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${ts}${r}`;
}

/** Slugify safe pour URLs */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Validation numéro téléphone marocain (06/07, 10 chiffres) */
export const PHONE_MA_REGEX = /^0[6-7][0-9]{8}$/;

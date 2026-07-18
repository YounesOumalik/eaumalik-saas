import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatte un prix en MAD (fr-MA style, arrondi à 2 décimales) */
export function formatCurrency(price: number): string {
  return price.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';
}

/**
 * Les images locales peuvent passer par l'optimiseur Next.js (WebP/AVIF +
 * tailles responsives). Les data/blob et URL externes arbitraires restent en
 * accès direct pour préserver les aperçus d'upload et les anciens contenus.
 */
export function shouldSkipImageOptimization(src: string): boolean {
  return !src.startsWith('/');
}

/** Formatte une date ISO en fr-FR */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

/** Formatte une date + heure ISO en fr-FR (ex: 13 juil. 2026, 14:32) */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

/** Validation numéro téléphone marocain (10 chiffres, commençant par 0) */
export const PHONE_MA_REGEX = /^0[0-9]{9}$/;

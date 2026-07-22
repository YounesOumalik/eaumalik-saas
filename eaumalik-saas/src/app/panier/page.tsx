'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, Plus, Minus, CheckCircle2, ShoppingCart, Lock, ArrowLeft, Truck, UserPlus } from 'lucide-react';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';
import { useRouter } from 'next/navigation';
import { getUserProfileAction } from '@/app/actions/clientActions';
import { formatCurrency, PHONE_MA_REGEX, shouldSkipImageOptimization } from '@/lib/utils';
import type { CheckoutFormData } from '@/types';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';

export default function CartPage() {
  const { items, count, subtotal, updateQty, remove, clear } = useCart();
  const toast = useToast();
  const { session, user } = useSupabaseAuth();
  const router = useRouter();
  const [checkout, setCheckout] = useState(false);
  const [success, setSuccess] = useState<{ orderNumber: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<{
    full_name?: string;
    phone?: string | null;
    city?: string | null;
    address?: string | null;
  } | null>(null);
  const [selectedCity, setSelectedCity] = useState('');

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const res = await getUserProfileAction();
      if (res.success && res.profile) {
        setProfile({
          full_name: res.profile.full_name ?? undefined,
          phone: res.profile.phone,
          city: res.profile.city,
          address: res.profile.address,
        });
        if (res.profile.city) {
          setSelectedCity(res.profile.city);
        }
      }
    };
    void fetchProfile();
  }, [user]);

  const delivery = subtotal >= 2000 ? 0 : 50;
  const total = subtotal + delivery;

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // === Invité non connecté : on exige la création de compte AVANT le checkout.
    // Politique produit : tout achat passe par un compte client (suivi de
    // commande, alertes de maintenance, cashback, parrainage). On redirige
    // donc vers /login en gardant /panier comme callbackUrl pour reprendre
    // exactement là où on en était après inscription.
    if (!session) {
      router.push(`/login?callbackUrl=${encodeURIComponent('/panier')}`);
      return;
    }

    const fd = new FormData(e.currentTarget);
    const data: CheckoutFormData = {
      client_name: String(fd.get('client_name') ?? ''),
      client_phone: String(fd.get('client_phone') ?? ''),
      client_city: String(fd.get('client_city') ?? ''),
      client_address: String(fd.get('client_address') ?? ''),
      notes: String(fd.get('notes') ?? '') || undefined,
    };

    // Utilisateur déjà connecté : pas de création de compte à la volée.
    let account: { email: string; password: string; full_name: string; phone: string; city: string } | undefined;
    if (!session) {
      // (Bloc conservé pour compat : ne devrait jamais être atteint grâce au
      // guard ci-dessus, mais on garde la validation si la fonction est
      // appelée depuis un autre contexte dans le futur.)
      const email = String(fd.get('account_email') ?? '').trim();
      const password = String(fd.get('account_password') ?? '');
      const confirm = String(fd.get('account_confirm') ?? '');
      const prospectPhone = String(fd.get('prospect_phone') ?? '').trim();
      const prospectCity = String(fd.get('prospect_city') ?? '').trim();

      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Email invalide pour la création du compte.', 'error');
      if (password.length < 8) return toast('Le mot de passe doit contenir au moins 8 caractères.', 'error');
      if (password !== confirm) return toast('Les mots de passe ne correspondent pas.', 'error');
      if (!PHONE_MA_REGEX.test(prospectPhone)) return toast('Numéro de téléphone invalide (format 0XXXXXXXXX).', 'error');
      if (!prospectCity) return toast('Veuillez choisir une ville.', 'error');

      account = {
        email,
        password,
        full_name: data.client_name || email.split('@')[0],
        phone: prospectPhone,
        city: prospectCity,
      };
      if (!data.client_phone) data.client_phone = prospectPhone;
      if (!data.client_city) data.client_city = prospectCity;
    }

    if (data.client_name.length < 3) return toast('Nom complet requis (min. 3 caractères)', 'error');
    if (!PHONE_MA_REGEX.test(data.client_phone)) return toast('Téléphone invalide (format 0XXXXXXXXX)', 'error');
    if (!data.client_city) return toast('Veuillez choisir une ville', 'error');
    if (data.client_address.trim().length < 5) return toast('Veuillez renseigner une adresse complète (min. 5 caractères)', 'error');

    try {
      setSubmitting(true);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          ...(account ? { account } : {}),
          items: items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Erreur inconnue');
      setSuccess({ orderNumber: result.order_number });
      // Connexion automatique de l'invité (mode mock : sessionStorage lu par le provider).
      if (result.createdUser) {
        try {
          // Le cookie de session est posé par l'API ; on notifie le provider
          // (même onglet) pour rafraîchir la navbar.
          window.dispatchEvent(new Event('eaumalik:dev-session-change'));
        } catch { /* noop */ }
      }
      clear();
      toast(`Commande ${result.order_number} créée avec succès !`, 'success');
    } catch (err: any) {
      toast(err.message ?? 'Erreur lors de la commande', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center py-20">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(16,185,129,0.15)' }}>
          <CheckCircle2 className="text-emerald-400" size={36} />
        </div>
        <h2 className="font-display font-extrabold text-2xl mb-2">Commande confirmée !</h2>
        <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
          Votre commande <span className="gradient-text font-bold">{success.orderNumber}</span> a été enregistrée.
        </p>
        <p className="mb-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          Paiement à la livraison. Vous serez contacté par téléphone pour confirmer.
        </p>
        <Link href="/boutique" className="btn-primary">Continuer mes achats</Link>
      </div>
    );
  }

  if (items.length === 0 && !checkout) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center py-20">
        <ShoppingCart className="mx-auto mb-4" size={56} style={{ color: 'var(--text-muted)' }} />
        <h2 className="font-display font-bold text-xl mb-2">Votre panier est vide</h2>
        <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
          Découvrez nos produits et trouvez la solution idéale pour votre eau.
        </p>
        <Link href="/boutique" className="btn-primary">
          <ArrowLeft size={14} aria-hidden="true" /> Retourner à la boutique
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-display font-extrabold mb-8">
        Votre <span className="gradient-text">Panier</span>
      </h1>

      {!checkout ? (
        <div className="lg:flex gap-8">
          <div className="flex-1 space-y-4">
            {items.map(item => (
              <div key={item.product_id} className="glass-card p-4 flex gap-4 items-center" style={{ transform: 'none' }}>
                {item.image_url && (
                  <Image src={item.image_url} alt={item.name} width={80} height={80}
                    sizes="80px"
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    unoptimized={shouldSkipImageOptimization(item.image_url)} />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-sm truncate">{item.name}</h3>
                  <div className="text-sm font-semibold mt-1 gradient-text">{formatCurrency(item.price)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.product_id, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} aria-label="Diminuer">
                    <Minus size={12} />
                  </button>
                  <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, 1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} aria-label="Augmenter">
                    <Plus size={12} />
                  </button>
                </div>
                <div className="text-right min-w-[80px]">
                  <div className="font-display font-bold text-sm">{formatCurrency(item.price * item.quantity)}</div>
                </div>
                <button onClick={() => remove(item.product_id)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors" style={{ color: 'var(--danger)' }} aria-label="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <aside className="lg:w-80 mt-6 lg:mt-0">
            <div className="glass-card p-6" style={{ transform: 'none' }}>
              <h3 className="font-display font-bold text-lg mb-4">Recapitulatif</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--text-secondary)' }}>Sous-total (TTC)</dt>
                  <dd>{formatCurrency(subtotal)}</dd>
                </div>
                {subtotal > 0 && (
                  <>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <dt>dont TVA (20%)</dt>
                      <dd>{formatCurrency((subtotal * 20) / 120)}</dd>
                    </div>
                    <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                      <dt>Montant HT</dt>
                      <dd>{formatCurrency(subtotal - (subtotal * 20) / 120)}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--text-secondary)' }}>Livraison</dt>
                  <dd>{delivery === 0 ? <span style={{ color: 'var(--success)' }}>Gratuite</span> : formatCurrency(delivery)}</dd>
                </div>
                {delivery > 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Livraison gratuite a partir de 2 000 DH</p>}
                <div className="flex justify-between pt-3 font-display font-extrabold text-lg" style={{ borderTop: '1px solid var(--border)' }}>
                  <dt>Total</dt>
                  <dd className="gradient-text">{formatCurrency(total)}</dd>
                </div>
              </dl>
              <button
                onClick={() => {
                  if (!session) {
                    router.push(`/login?callbackUrl=${encodeURIComponent('/panier')}`);
                    return;
                  }
                  setCheckout(true);
                }}
                className="btn-primary w-full justify-center mt-6"
              >
                <Lock size={14} aria-hidden="true" />
                {session ? 'Passer la commande' : 'Se connecter pour commander'}
              </button>
              <p className="text-center mt-3 text-xs flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <Truck size={12} /> Paiement à la livraison
              </p>
              {!session && (
                <p className="text-center mt-2 text-[11px] flex items-center justify-center gap-1.5 text-amber-700">
                  <UserPlus size={11} aria-hidden="true" />
                  Inscription requise pour finaliser la commande
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="lg:flex gap-8">
          <div className="flex-1">
            <button onClick={() => setCheckout(false)} className="btn-outline btn-sm mb-6">
              <ArrowLeft size={14} aria-hidden="true" /> Retour au panier
            </button>
            <form onSubmit={handleCheckout} className="glass-card p-6 space-y-4" style={{ transform: 'none' }} noValidate>
              <h3 className="font-display font-bold text-lg mb-2">Informations de livraison</h3>
              {!session && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
                  <UserPlus size={18} className="text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold mb-1">Compte client obligatoire pour commander</p>
                    <p className="text-xs leading-relaxed">
                      Pour finaliser votre commande, vous devez disposer d&apos;un compte client.
                      Vous permet de suivre vos commandes, recevoir les alertes de maintenance et profiter du parrainage/cashback.
                      <Link href={`/login?callbackUrl=${encodeURIComponent('/panier')}`} className="ml-1 underline font-semibold">
                        Se connecter ou créer un compte
                      </Link>
                    </p>
                  </div>
                </div>
              )}
              <div>
                <label className="form-label" htmlFor="client_name">Nom complet *</label>
                <input
                  id="client_name"
                  name="client_name"
                  type="text"
                  required
                  minLength={3}
                  className="form-input"
                  placeholder="Votre nom complet"
                  defaultValue={profile?.full_name || ''}
                  key={profile?.full_name || 'name-empty'}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="client_phone">Téléphone *</label>
                  <input
                    id="client_phone"
                    name="client_phone"
                    type="tel"
                    required
                    pattern="0[6-7][0-9]{8}"
                    className="form-input"
                    placeholder="06XXXXXXXX"
                    defaultValue={profile?.phone || ''}
                    key={profile?.phone || 'phone-empty'}
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="client_city">Ville *</label>
                  <SearchableCitySelect
                    id="client_city"
                    name="client_city"
                    value={selectedCity}
                    onChange={setSelectedCity}
                    placeholder="Choisir une ville"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label" htmlFor="client_address">Adresse complète *</label>
                <textarea
                  id="client_address"
                  name="client_address"
                  rows={2}
                  required
                  className="form-input"
                  placeholder="Numero, rue, quartier, code postal..."
                  defaultValue={profile?.address || ''}
                  key={profile?.address || 'address-empty'}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="notes">Notes (optionnel)</label>
                <input id="notes" name="notes" type="text" className="form-input" placeholder="Instructions spéciales..." />
              </div>

              <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <Truck style={{ color: 'var(--primary-light)' }} aria-hidden="true" />
                <div>
                  <div className="font-semibold text-sm">Paiement à la livraison</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Vous payez en cash à la réception de votre commande</div>
                </div>
              </div>

              <div className="flex items-center gap-2 py-1 select-none">
                <input
                  type="checkbox"
                  id="request_invoice"
                  name="request_invoice"
                  defaultChecked
                  className="rounded border-[color:var(--border)] text-[color:var(--primary)] focus:ring-[color:var(--primary)] bg-[color:var(--bg-card)]"
                />
                <label htmlFor="request_invoice" className="text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                  Demander une facture d&apos;achat officielle (PDF) sur mon compte à la confirmation
                </label>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3.5 text-base disabled:opacity-50">
                {submitting ? 'Envoi...' : (
                  <> <CheckCircle2 size={16} aria-hidden="true" /> Confirmer la commande — {formatCurrency(total)} </>
                )}
              </button>
            </form>
          </div>

          <aside className="lg:w-72 mt-6 lg:mt-0">
            <div className="glass-card p-5" style={{ transform: 'none' }}>
              <h4 className="font-display font-semibold text-sm mb-3">Votre commande</h4>
              <div className="space-y-2 text-sm pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                {items.map(i => (
                  <div key={i.product_id} className="flex justify-between items-start gap-4">
                    <span style={{ color: 'var(--text-secondary)' }} className="truncate">{i.name} x{i.quantity}</span>
                    <span className="whitespace-nowrap flex-shrink-0">{formatCurrency(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2 text-xs py-3" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <div className="flex justify-between"><span>Sous-total (TTC)</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span>dont TVA (20%)</span><span>{formatCurrency((subtotal * 20) / 120)}</span></div>
                <div className="flex justify-between"><span>Montant HT</span><span>{formatCurrency(subtotal - (subtotal * 20) / 120)}</span></div>
                <div className="flex justify-between"><span>Livraison</span><span>{delivery === 0 ? 'Gratuite' : formatCurrency(delivery)}</span></div>
              </div>
              <div className="mt-3 flex justify-between font-display font-bold">
                <span>Total</span><span className="gradient-text">{formatCurrency(total)}</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

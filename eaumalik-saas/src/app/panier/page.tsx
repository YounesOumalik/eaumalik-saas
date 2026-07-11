'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, Plus, Minus, CheckCircle2, ShoppingCart, Lock, ArrowLeft, Truck } from 'lucide-react';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import { formatCurrency, PHONE_MA_REGEX } from '@/lib/utils';
import type { CheckoutFormData } from '@/types';

const CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Fes', 'Tanger', 'Agadir',
  'Meknes', 'Oujda', 'Kenitra', 'Tetouan', 'Sale', 'Temara',
  'Mohammedia', 'El Jadida', 'Nador',
];

export default function CartPage() {
  const { items, count, subtotal, updateQty, remove, clear } = useCart();
  const toast = useToast();
  const [checkout, setCheckout] = useState(false);
  const [success, setSuccess] = useState<{ orderNumber: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const delivery = subtotal >= 2000 ? 0 : 50;
  const total = subtotal + delivery;

  const handleCheckout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: CheckoutFormData = {
      client_name: String(fd.get('client_name') ?? ''),
      client_phone: String(fd.get('client_phone') ?? ''),
      client_city: String(fd.get('client_city') ?? ''),
      client_address: String(fd.get('client_address') ?? ''),
      notes: String(fd.get('notes') ?? '') || undefined,
    };

    if (data.client_name.length < 3) return toast('Nom requis (min. 3 caracteres)', 'error');
    if (!PHONE_MA_REGEX.test(data.client_phone)) return toast('Telephone invalide (format 06XXXXXXXX)', 'error');

    try {
      setSubmitting(true);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          items: items.map(i => ({
            product_id: i.product_id,
            product_name: i.name,
            unit_price: i.price,
            quantity: i.quantity,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? 'Erreur inconnue');
      setSuccess({ orderNumber: result.order_number });
      clear();
      toast(`Commande ${result.order_number} creee avec succes !`, 'success');
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
        <h2 className="font-display font-extrabold text-2xl mb-2">Commande confirmee !</h2>
        <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
          Votre commande <span className="gradient-text font-bold">{success.orderNumber}</span> a ete enregistree.
        </p>
        <p className="mb-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          Paiement a la livraison. Vous serez contacte par telephone pour confirmer.
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
          Decouvrez nos produits et trouvez la solution ideale pour votre eau.
        </p>
        <Link href="/boutique" className="btn-primary">
          <ArrowLeft size={14} aria-hidden="true" /> Retourner a la boutique
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
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0" unoptimized />
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
                <div className="flex justify-between"><dt style={{ color: 'var(--text-secondary)' }}>Sous-total ({count} article{count > 1 ? 's' : ''})</dt><dd>{formatCurrency(subtotal)}</dd></div>
                <div className="flex justify-between"><dt style={{ color: 'var(--text-secondary)' }}>Livraison</dt><dd>{delivery === 0 ? <span style={{ color: 'var(--success)' }}>Gratuite</span> : formatCurrency(delivery)}</dd></div>
                {delivery > 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Livraison gratuite a partir de 2 000 DH</p>}
                <div className="flex justify-between pt-3 font-display font-extrabold text-lg" style={{ borderTop: '1px solid var(--border)' }}>
                  <dt>Total</dt><dd className="gradient-text">{formatCurrency(total)}</dd>
                </div>
              </dl>
              <button onClick={() => setCheckout(true)} className="btn-primary w-full justify-center mt-6">
                <Lock size={14} aria-hidden="true" /> Passer la commande
              </button>
              <p className="text-center mt-3 text-xs flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                <Truck size={12} /> Paiement a la livraison
              </p>
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
              <div>
                <label className="form-label" htmlFor="client_name">Nom complet *</label>
                <input id="client_name" name="client_name" type="text" required minLength={3} className="form-input" placeholder="Votre nom complet" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label" htmlFor="client_phone">Telephone *</label>
                  <input id="client_phone" name="client_phone" type="tel" required pattern="0[6-7][0-9]{8}" className="form-input" placeholder="06XXXXXXXX" />
                </div>
                <div>
                  <label className="form-label" htmlFor="client_city">Ville *</label>
                  <select id="client_city" name="client_city" required className="form-input">
                    <option value="">Choisir une ville</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label" htmlFor="client_address">Adresse complete *</label>
                <textarea id="client_address" name="client_address" rows={2} required className="form-input" placeholder="Numero, rue, quartier, code postal..." />
              </div>
              <div>
                <label className="form-label" htmlFor="notes">Notes (optionnel)</label>
                <input id="notes" name="notes" type="text" className="form-input" placeholder="Instructions speciales..." />
              </div>

              <div className="p-4 rounded-lg flex items-center gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <Truck style={{ color: 'var(--primary-light)' }} aria-hidden="true" />
                <div>
                  <div className="font-semibold text-sm">Paiement a la livraison</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Vous payez en cash a la reception de votre commande</div>
                </div>
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
              <div className="space-y-2 text-sm">
                {items.map(i => (
                  <div key={i.product_id} className="flex justify-between">
                    <span style={{ color: 'var(--text-secondary)' }} className="truncate mr-2">{i.name} x{i.quantity}</span>
                    <span>{formatCurrency(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 flex justify-between font-display font-bold" style={{ borderTop: '1px solid var(--border)' }}>
                <span>Total</span><span className="gradient-text">{formatCurrency(total)}</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

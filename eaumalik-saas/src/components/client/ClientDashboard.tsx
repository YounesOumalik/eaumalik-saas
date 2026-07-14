'use client';

import { useState, useRef, useEffect } from 'react';
import { Gift, ShieldAlert, MessageCircle, Newspaper, Receipt, Share2, Copy, Send, User, Truck } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { sendClientMessageAction, updateUserProfileAction } from '@/app/actions/clientActions';
import { useToast } from '@/components/shared/ToastProvider';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';

interface Props {
  initialData: {
    user: { id: string; email: string; full_name: string; phone?: string; city?: string; address?: string; referral_code: string; cashback_balance: number };
    referredUsers: any[];
    userOrders: any[];
    userMessages: any[];
    news: any[];
  };
}

export default function ClientDashboard({ initialData }: Props) {
  const [activeTab, setActiveTab] = useState<'parrainage' | 'maintenance' | 'chat' | 'news' | 'orders' | 'profile'>('parrainage');
  const [messages, setMessages] = useState<any[]>(initialData.userMessages);
  const [newMessageText, setNewMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Profile Form States
  const [fullName, setFullName] = useState(initialData.user.full_name);
  const [phone, setPhone] = useState(initialData.user.phone || '');
  const [city, setCity] = useState(initialData.user.city || '');
  const [address, setAddress] = useState(initialData.user.address || '');
  const [password, setPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !city.trim() || updating) return;
    setUpdating(true);
    const res = await updateUserProfileAction({
      full_name: fullName,
      phone,
      city,
      address: address || undefined,
      password: password || undefined,
    });
    if (res.success) {
      toast('Coordonnées mises à jour avec succès !', 'success');
      setPassword('');
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
    setUpdating(false);
  };

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const referralLink = typeof window !== 'undefined'
    ? `${window.location.origin}/login?ref=${initialData.user.referral_code}`
    : `https://eaumalik.com/login?ref=${initialData.user.referral_code}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || sending) return;
    setSending(true);

    const res = await sendClientMessageAction(newMessageText);
    if (res.success && res.message) {
      setMessages(prev => [...prev, res.message]);
      setNewMessageText('');
    }
    setSending(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Welcome Banner */}
      <div className="glass-card p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6" style={{ transform: 'none' }}>
        <div>
          <h1 className="font-display font-extrabold text-2xl mb-1">
            Bonjour, <span className="gradient-text">{initialData.user.full_name}</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Bienvenue dans votre espace client personnalisé.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-[color:var(--bg-surface)] border border-[color:var(--border)] p-4 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-warning-soft flex items-center justify-center text-warning">
            <Gift size={20} />
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Mon Cashback disponible</div>
            <div className="text-xl font-display font-extrabold text-warning">{formatCurrency(initialData.user.cashback_balance)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-3 mb-6 w-full">
        <div className="inline-flex flex-wrap rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {[
            { id: 'parrainage', label: 'Parrainage & Cashback', icon: Gift },
            { id: 'maintenance', label: 'Maintenance Filtres', icon: ShieldAlert },
            { id: 'chat', label: 'Discuter avec le vendeur', icon: MessageCircle },
            { id: 'news', label: 'Actualités & Offres', icon: Newspaper },
            { id: 'orders', label: 'Historique commandes', icon: Receipt },
            { id: 'profile', label: 'Mes Coordonnées', icon: User },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className="px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5"
                style={{
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                aria-pressed={active}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="min-h-[40vh]">
        {/* PARRAINAGE & CASHBACK */}
        {activeTab === 'parrainage' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card p-6" style={{ transform: 'none' }}>
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2 text-warning">
                <Gift size={18} /> Inviter des amis
              </h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Partagez votre lien de parrainage. Pour chaque ami qui s&apos;inscrit et achète son premier purificateur, vous recevrez <strong>150 MAD</strong> de cashback et ils recevront <strong>50 MAD</strong> de bonus !
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>Votre code unique</label>
                  <div className="font-mono text-lg font-bold border border-[color:var(--border)] bg-[color:var(--bg-surface)] py-2 px-4 rounded-xl inline-block">
                    {initialData.user.referral_code}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>Lien de parrainage</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className="form-input font-mono text-xs flex-1"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="btn-outline p-2.5 rounded-xl flex items-center justify-center flex-shrink-0"
                      title="Copier le lien"
                    >
                      {copied ? <span className="text-xs text-success font-bold px-1">Copié !</span> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6" style={{ transform: 'none' }}>
              <h3 className="font-display font-bold text-lg mb-4">Mes Parrainages</h3>
              {initialData.referredUsers.length === 0 ? (
                <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                  <Share2 size={36} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Vous n&apos;avez pas encore de parrainages.</p>
                </div>
              ) : (
                <div className="divide-y divide-[color:var(--border)]">
                  {initialData.referredUsers.map(refUser => (
                    <div key={refUser.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-semibold">{refUser.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{refUser.email}</div>
                      </div>
                      <div className="text-xs font-bold text-success bg-success-soft py-1 px-2 rounded-full">
                        +50 MAD de bonus
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAINTENANCE */}
        {activeTab === 'maintenance' && (() => {
          const deliveredOrder = initialData.userOrders.find(o => o.status === 'livree');
          const shippingOrder = initialData.userOrders.find(o => ['en_attente', 'traitee', 'en_livraison'].includes(o.status));

          return (
            <div className="glass-card p-6" style={{ transform: 'none' }}>
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <ShieldAlert size={18} className="text-sky-400" /> Suivi de la Maintenance
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Retrouvez le calendrier de maintenance et de changement des filtres de vos appareils installés.
              </p>

              {deliveredOrder ? (() => {
                const installDate = new Date(deliveredOrder.updated_at || deliveredOrder.created_at);
                const sedDate = new Date(installDate);
                sedDate.setMonth(installDate.getMonth() + 6);
                const memDate = new Date(installDate);
                memDate.setMonth(installDate.getMonth() + 12);

                const formatDateFR = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                const formatMonthFR = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

                return (
                  <div className="border border-[color:var(--border)] rounded-2xl p-5 bg-[color:var(--bg-surface)]">
                    <div className="flex flex-wrap items-start justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <h4 className="font-bold text-base">{deliveredOrder.items?.[0]?.product_name || "Purificateur d'Eau Pro"}</h4>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Installé le : {formatDateFR(installDate)}</div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-success-soft text-success">
                        Filtres à jour
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-6 mt-4 text-sm">
                      <div>
                        <div className="font-semibold mb-2">Historique / Prochain changement</div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>Filtre à sédiments (Changement prévu : {formatDateFR(sedDate)})</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>Membrane d&apos;osmose (Changement prévu : {formatDateFR(memDate)})</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col justify-center items-start sm:items-end">
                        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Prochaine révision (1 an)</div>
                        <div className="text-lg font-bold text-sky-400 capitalize">{formatMonthFR(memDate)}</div>
                      </div>
                    </div>
                  </div>
                );
              })() : shippingOrder ? (
                <div className="border border-[color:var(--border)] rounded-2xl p-5 bg-[color:var(--bg-surface)] text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-warning-soft flex items-center justify-center mx-auto mb-4 text-warning">
                    <Truck size={24} />
                  </div>
                  <h4 className="font-bold text-base mb-1">Purificateur d&apos;Eau en cours de livraison</h4>
                  <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
                    Votre commande <span className="font-mono font-bold text-warning">{shippingOrder.order_number}</span> est actuellement avec le statut <span className="font-semibold">&quot;{shippingOrder.status === 'en_attente' ? 'En attente' : shippingOrder.status === 'traitee' ? 'Traitée' : 'En cours de livraison'}&quot;</span>.
                  </p>
                  <p className="text-xs mt-3 text-sky-400 font-medium">
                    Le suivi de la maintenance et le calendrier des révisions débuteront dès la finalisation de l&apos;installation de votre appareil.
                  </p>
                </div>
              ) : (
                <div className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <ShieldAlert size={36} className="mx-auto mb-3 opacity-50" />
                  Aucun purificateur d&apos;eau actif enregistré sur votre compte.
                </div>
              )}
            </div>
          );
        })()}

        {/* CHAT MESSAGES */}
        {activeTab === 'chat' && (
          <div className="glass-card flex flex-col h-[55vh]" style={{ transform: 'none' }}>
            {/* Chat header */}
            <div className="p-4 flex items-center gap-3 border-b border-[color:var(--border)]">
              <div className="w-8 h-8 rounded-full bg-primary-soft flex items-center justify-center text-primary-light font-bold text-xs">EM</div>
              <div>
                <div className="font-semibold text-sm">Support EAUMALIK</div>
                <div className="text-[10px] text-success">En ligne</div>
              </div>
            </div>

            {/* Message Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[color:var(--bg-surface)]">
              {messages.length === 0 ? (
                <div className="text-center py-20 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                  Écrivez un message ci-dessous pour démarrer une conversation avec notre équipe commerciale ou technique.
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isAdminMsg = m.senderId === 'admin-id';
                  return (
                    <div key={m.id || idx} className={`flex ${isAdminMsg ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] p-3 rounded-2xl text-sm ${
                        isAdminMsg
                          ? 'bg-[color:var(--bg-card)] border border-[color:var(--border)] rounded-tl-none'
                          : 'bg-[color:var(--primary)] text-white rounded-tr-none'
                      }`}>
                        <div className="font-bold text-[10px] mb-1 opacity-70">
                          {isAdminMsg ? 'Conseiller EAUMALIK' : 'Vous'}
                        </div>
                        <div>{m.text}</div>
                        <div className="text-[9px] text-right mt-1 opacity-60">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Send Message Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-[color:var(--border)] flex gap-2">
              <input
                type="text"
                className="form-input flex-1"
                placeholder="Votre message..."
                value={newMessageText}
                onChange={e => setNewMessageText(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newMessageText.trim() || sending}
                className="btn-primary p-2.5 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* NEWS / ACTUALITÉS */}
        {activeTab === 'news' && (
          <div className="space-y-4">
            {initialData.news.length === 0 ? (
              <div className="glass-card p-8 text-center" style={{ transform: 'none', color: 'var(--text-muted)' }}>
                <Newspaper size={36} className="mx-auto mb-3 opacity-50" />
                <p>Aucune actualité disponible pour le moment.</p>
              </div>
            ) : (
              initialData.news.map((item: any) => {
                const hasPrice = typeof item.price === 'number' && item.price > 0;
                const hasOriginal = typeof item.original_price === 'number' && item.original_price > 0;
                const isPromo = item.is_promotion === true || hasPrice || (Array.isArray(item.product_ids) && item.product_ids.length > 0);
                const discount =
                  hasPrice && hasOriginal && item.original_price > 0
                    ? Math.max(0, Math.round((1 - item.price / item.original_price) * 100))
                    : null;
                return (
                  <div
                    key={item.id}
                    className={`glass-card p-6 flex flex-col md:flex-row gap-6 items-start ${
                      isPromo ? 'border-warning/40 ring-1 ring-warning/30' : ''
                    }`}
                    style={{ transform: 'none' }}
                  >
                    {item.image_url && (
                      <div className="relative w-full md:w-48 h-32 rounded-xl border border-[color:var(--border)] overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                        {discount !== null && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-warning text-bg shadow">
                            -{discount}%
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-primary-400">
                          Publié le {new Date(item.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        {isPromo && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-warning-soft text-warning">
                            🔥 PROMOTION
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-lg mb-2">{item.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {item.content}
                      </p>

                      {hasPrice && (
                        <div className="flex items-end gap-2 mt-3">
                          <span className="font-display font-extrabold text-xl text-warning">
                            {formatCurrency(item.price)}
                          </span>
                          {hasOriginal && (
                            <span className="text-xs line-through opacity-60">
                              {formatCurrency(item.original_price)}
                            </span>
                          )}
                          {discount !== null && (
                            <span className="text-xs font-bold text-success ml-2">
                              Vous économisez {formatCurrency(item.original_price - item.price)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-3">
                        <a
                          href="/boutique"
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary-light hover:underline"
                        >
                          Voir les produits →
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'orders' && (
          <div className="glass-card p-6" style={{ transform: 'none' }}>
            <h3 className="font-display font-bold text-lg mb-4">Historique des Commandes</h3>
            {initialData.userOrders.length === 0 ? (
              <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                <Receipt size={36} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Vous n&apos;avez passé aucune commande pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Commande</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Statut</th>
                      <th>Facture</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialData.userOrders.map(order => (
                      <tr key={order.id}>
                        <td className="font-mono text-sm font-semibold">{order.order_number}</td>
                        <td className="text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                        <td className="font-bold text-sm">{formatCurrency(order.total)}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            order.status === 'livree' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          {order.status !== 'en_attente' && order.status !== 'annulee' ? (
                            <a
                              href={`/api/invoice?order_id=${order.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-light hover:underline font-bold"
                            >
                              Télécharger (PDF)
                            </a>
                          ) : (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              Dispo. après confirmation
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MES COORDONNÉES */}
        {activeTab === 'profile' && (
          <div className="glass-card p-6 max-w-xl" style={{ transform: 'none' }}>
            <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
              <User size={18} className="text-primary-light" /> Modifier mes coordonnées
            </h3>
            <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
              Mettez à jour vos informations personnelles pour faciliter la livraison de vos prochaines commandes.
            </p>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="form-label">Nom complet *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Téléphone *</label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="06XXXXXXXX"
                  />
                </div>
                <div>
                  <label className="form-label">Ville *</label>
                  <SearchableCitySelect
                    value={city}
                    onChange={setCity}
                    placeholder="Choisir une ville"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Adresse de livraison</label>
                <textarea
                  rows={2}
                  className="form-input"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Rue, quartier, n°..."
                />
              </div>
              <div>
                <label className="form-label">Nouveau mot de passe (Laissez vide pour conserver l&apos;actuel)</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={updating}
                className="btn-primary w-full justify-center py-2.5 text-sm disabled:opacity-50"
              >
                {updating ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

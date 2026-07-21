'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Gift,
  ShieldAlert,
  MessageCircle,
  Newspaper,
  Receipt,
  Share2,
  Copy,
  Send,
  User,
  ShoppingBag,
  ExternalLink,
  LogOut,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  Wrench,
  CalendarClock,
  AlertTriangle,
  CircleDot,
  Circle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, daysUntil } from '@/lib/utils';
import { changeOwnPasswordAction, sendClientMessageAction, updateUserProfileAction } from '@/app/actions/clientActions';
import { useToast } from '@/components/shared/ToastProvider';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';
import { OrderTimeline } from '@/components/admin/OrderTracker';
import type { MaintenanceRecord, MaintenanceIntervention, InterventionType, InterventionOutcome, OrderStatus } from '@/types';

interface Props {
  initialData: {
    user: {
      id: string;
      email: string;
      full_name: string;
      phone?: string;
      city?: string;
      address?: string;
      referral_code: string;
      cashback_balance: number;
      /** Vrai si le compte est connecte via Google OAuth (aucun mot de passe local). */
      isGoogleUser: boolean;
    };
    referredUsers: any[];
    userOrders: any[];
    userMessages: any[];
    news: any[];
    /** Fiches de maintenance liees aux commandes livrees du client. */
    maintenanceRecords: MaintenanceRecord[];
  };
}

type ClientTabId = 'parrainage' | 'maintenance' | 'chat' | 'news' | 'orders' | 'profile';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
}

const SIDEBAR_ICONS: Record<string, LucideIcon> = {
  orders: ShoppingBag,
  parrainage: Gift,
  maintenance: ShieldAlert,
  chat: MessageCircle,
  news: Newspaper,
  profile: User,
};

const STORAGE_KEY = 'eaumalik.client.sidebar.collapsed';

const ORDER_STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  traitee: 'Préparée',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

export default function ClientDashboard({ initialData }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<ClientTabId>('parrainage');
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
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
  const [updating, setUpdating] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !city.trim() || updating) return;
    setUpdating(true);
    const res = await updateUserProfileAction({
      full_name: fullName,
      phone,
      city,
      address: address || undefined,
    });
    if (res.success) {
      toast('Coordonnées mises à jour avec succès !', 'success');
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
    setUpdating(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changingPassword) return;
    setChangingPassword(true);
    const res = await changeOwnPasswordAction({
      current_password: currentPassword,
      new_password: newPassword,
      confirmation: passwordConfirmation,
    });
    if (res.success) {
      toast('Mot de passe modifié avec succès.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setPasswordConfirmation('');
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
    setChangingPassword(false);
  };

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling léger : récupère les nouveaux messages (notamment les réponses admin)
  // toutes les 15 s. On n'écrase que si le serveur renvoie plus de messages
  // que l'état local (pour ne pas perdre ce que le client vient de taper).
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/messages/mine', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (Array.isArray(data.messages) && data.messages.length >= messages.length) {
          setMessages(data.messages);
        }
      } catch {
        /* silencieux */
      }
    };
    const id = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [messages.length]);

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

  // --- Sidebar (style admin, repliable, état persisté en localStorage) ---
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const isActiveTab = useCallback(
    (id: ClientTabId) => activeTab === id,
    [activeTab]
  );

  // Commande en PREMIER : ouvre le suivi des commandes du client.
  // L'onglet Maintenance s'affiche dès qu'une commande a été livrée OU qu'une
  // fiche de maintenance existe deja pour ce client (cas ou l'admin en cree
  // une a la main avant que la commande passe en statut 'livree').
  const hasMaintenanceAccess = initialData.userOrders.some((order: any) => order.status === 'livree')
    || initialData.maintenanceRecords.length > 0;
  const navItems: NavItem[] = [
    { id: 'orders', label: 'Commande', icon: ShoppingBag },
    { id: 'parrainage', label: 'Parrainage & Cashback', icon: Gift },
    ...(hasMaintenanceAccess
      ? [{ id: 'maintenance', label: 'Maintenance Filtres', icon: ShieldAlert }]
      : []),
    { id: 'chat', label: 'Discuter avec le vendeur', icon: MessageCircle },
    { id: 'news', label: 'Actualités & Offres', icon: Newspaper },
    { id: 'profile', label: 'Mes Coordonnées', icon: User },
  ];

  const handleNav = useCallback(
    (item: NavItem) => {
      if (item.href) {
        router.push(item.href);
        return;
      }
      setActiveTab(item.id as ClientTabId);
    },
    [router]
  );

  // Hydratation de l'état replié depuis localStorage (évite le mismatch SSR/CSR)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setCollapsed(true);
    } catch {
      /* SSR ou mode privé : on garde `false` */
    }
    setHydrated(true);
  }, []);

  // Persistance du choix utilisateur
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* silencieux */
    }
  }, [collapsed, hydrated]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar repliable (style admin) */}
      <aside
        className={`admin-sidebar ${collapsed ? 'is-collapsed' : ''}`}
        aria-label="Navigation espace client"
      >
        <div className="admin-sidebar__header">
          <div className="admin-sidebar__brand admin-sidebar__brand--collapsed">
            <User size={20} className="text-primary-light shrink-0" aria-hidden="true" />
            {!collapsed && (
              <span className="admin-sidebar__brand-label text-sm font-display font-bold ml-2 truncate">Mon Espace</span>
            )}
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="admin-sidebar__toggle"
            aria-label={collapsed ? 'Déployer la barre latérale' : 'Replier la barre latérale'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Déployer' : 'Replier'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        {!collapsed && <div className="admin-sidebar__subtitle">Mon espace client</div>}

        <nav className="admin-sidebar__nav" aria-label="Sections">
          {navItems.map((item) => {
            const Icon = SIDEBAR_ICONS[item.id] ?? item.icon;
            const active = item.href
              ? pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false)
              : isActiveTab(item.id as ClientTabId);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                className={`sidebar-link ${active ? 'active' : ''}`}
                data-tab={item.id}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                {!collapsed && <span className="sidebar-link__label">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-link"
            aria-label="Voir le site"
            title={collapsed ? 'Voir le site' : undefined}
          >
            <ExternalLink size={16} aria-hidden="true" className="shrink-0" />
            {!collapsed && <span className="sidebar-link__label">Voir le site</span>}
          </Link>
          <button
            type="button"
            onClick={() => {
              window.location.replace('/api/auth/logout');
            }}
            className="sidebar-link w-full text-left"
            aria-label="Déconnexion"
            title={collapsed ? 'Déconnexion' : undefined}
          >
            <LogOut size={16} aria-hidden="true" className="shrink-0" />
            {!collapsed && <span className="sidebar-link__label">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Zone de contenu principale */}
      <div className="min-w-0 flex-1 px-4 sm:px-6 py-6 overflow-auto">
        <div className="max-w-6xl mx-auto">

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
        {activeTab === 'maintenance' && (
          <ClientMaintenanceTab initialRecords={initialData.maintenanceRecords} />
        )}

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
            <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary-light" /> Mes Commandes
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Suivez l&apos;avancement de vos commandes et leur livraison.
            </p>
            {initialData.userOrders.length === 0 ? (
              <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                <Receipt size={36} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Vous n&apos;avez passé aucune commande pour le moment.</p>
              </div>
            ) : (
              <ClientOrdersList orders={initialData.userOrders} />
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
              <button
                type="submit"
                disabled={updating}
                className="btn-primary w-full justify-center py-2.5 text-sm disabled:opacity-50"
              >
                {updating ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </form>

            {!initialData.user.isGoogleUser && (
              <div className="border-t border-[color:var(--border)] mt-8 pt-6">
                <h4 className="font-display font-bold text-base mb-1">Modifier mon mot de passe</h4>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Votre mot de passe reste confidentiel et n’est jamais visible par l’administration.
                </p>
                <form onSubmit={handleChangePassword} className="space-y-4">
                <PasswordInput
                  label="Mot de passe actuel"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  visible={showCurrentPassword}
                  onToggle={() => setShowCurrentPassword(value => !value)}
                  autoComplete="current-password"
                  disabled={changingPassword}
                />
                <PasswordInput
                  label="Nouveau mot de passe"
                  value={newPassword}
                  onChange={setNewPassword}
                  visible={showNewPassword}
                  onToggle={() => setShowNewPassword(value => !value)}
                  autoComplete="new-password"
                  disabled={changingPassword}
                />
                <PasswordInput
                  label="Confirmer le nouveau mot de passe"
                  value={passwordConfirmation}
                  onChange={setPasswordConfirmation}
                  visible={showPasswordConfirmation}
                  onToggle={() => setShowPasswordConfirmation(value => !value)}
                  autoComplete="new-password"
                  disabled={changingPassword}
                />
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Minimum 12 caractères, avec majuscule, minuscule et chiffre.
                </p>
                <button type="submit" disabled={changingPassword} className="btn-outline w-full justify-center py-2.5 text-sm disabled:opacity-50">
                  {changingPassword ? 'Modification...' : 'Modifier le mot de passe'}
                </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  label, value, onChange, visible, onToggle, autoComplete, disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="form-label">{label} *</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          required
          className="form-input pr-10"
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Onglet Commandes compact
// - Mode compact par défaut : 1 ligne récap (n° / date / statut / total / arrow)
// - Bouton "Voir le détail" par ligne qui déplie la timeline + articles + notes
// - Bouton global "Tout déplier / Tout replier"
// ============================================================================

function ClientOrdersList({ orders }: { orders: any[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const o of orders) next[o.id] = true;
    setExpanded(next);
  };
  const collapseAll = () => setExpanded({});
  const allExpanded = orders.length > 0 && orders.every(o => expanded[o.id]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={allExpanded ? collapseAll : expandAll}
          className="btn-outline text-[11px] py-1 px-3 inline-flex items-center gap-1.5"
          aria-label={allExpanded ? 'Tout replier' : 'Tout déplier'}
        >
          {allExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {allExpanded ? 'Tout replier' : 'Tout déplier'}
        </button>
      </div>
      <div className="space-y-2">
        {orders.map(order => (
          <ClientOrderRow
            key={order.id}
            order={order}
            expanded={!!expanded[order.id]}
            onToggle={() => toggle(order.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ClientOrderRow({
  order,
  expanded,
  onToggle,
}: {
  order: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = order.status as OrderStatus;
  const statusClass =
    status === 'livree' ? 'bg-success-soft text-success'
    : status === 'annulee' ? 'bg-danger-soft text-danger'
    : status === 'en_livraison' ? 'text-primary-light'
    : status === 'traitee' ? 'text-primary-light'
    : 'bg-warning-soft text-warning';
  // Couleur de fond de l'icône gauche : si pas de classe bg-* on prend
  // un fond neutre semi-transparent lisible en clair ET sombre.
  const iconBgClass = (() => {
    switch (status) {
      case 'livree': return 'bg-success-soft';
      case 'annulee': return 'bg-danger-soft';
      case 'en_livraison':
      case 'traitee':
        return '';
      default: return 'bg-warning-soft';
    }
  })();

  // Petit résumé produits pour la ligne compacte (max 2 articles).
  const compactItems = (order.items ?? []).slice(0, 2);
  const extraItems = Math.max(0, (order.items?.length ?? 0) - compactItems.length);

  return (
    <article
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-surface)] overflow-hidden"
    >
      {/* Ligne compacte (toujours visible) */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`order-details-${order.id}`}
        className="w-full text-left p-4 sm:p-4 flex items-center gap-3 hover:bg-[color:var(--bg-card)] transition-colors"
      >
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBgClass} text-primary-light`}
          aria-hidden="true"
          style={
            !iconBgClass
              ? { background: 'var(--bg-card)', border: '1px solid var(--border)' }
              : undefined
          }
        >
          {status === 'livree' ? <CheckCircle2 size={18} />
            : status === 'annulee' ? <X size={18} />
            : <ShoppingBag size={18} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-sm">
              Commande {order.order_number}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusClass}`}>
              {ORDER_STATUS_LABELS[status] ?? status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span>{new Date(order.created_at).toLocaleDateString('fr-FR')}</span>
            {compactItems.length > 0 && (
              <>
                <span>·</span>
                <span className="truncate">
                  {compactItems.map((it: any) => `${it.product_name} ×${it.quantity}`).join(' · ')}
                  {extraItems > 0 && ` · +${extraItems}`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="font-display font-extrabold text-sm">{formatCurrency(order.total)}</div>
          <div className="text-[10px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            {expanded ? 'Replier' : 'Voir le détail'}
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </div>
      </button>

      {/* Contenu développé */}
      {expanded && (
        <div
          id={`order-details-${order.id}`}
          className="px-4 sm:px-5 pb-5 pt-1 border-t border-[color:var(--border)]"
        >
          <OrderTimeline order={order} />

          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[color:var(--border)]">
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Articles
              </div>
              <div className="space-y-1 text-sm">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <span>{item.product_name} × {item.quantity}</span>
                    <span className="font-semibold whitespace-nowrap">{formatCurrency(item.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.notes && (
            <div className="mt-5 pt-4 border-t border-[color:var(--border)]">
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                Historique du traitement
              </div>
              <pre
                className="whitespace-pre-wrap break-words text-xs leading-5 rounded-xl p-3"
                style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', fontFamily: 'inherit' }}
              >
                {order.notes}
              </pre>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span style={{ color: 'var(--text-muted)' }}>
              Total : <strong className="text-sm" style={{ color: 'var(--text)' }}>{formatCurrency(order.total)}</strong>
            </span>
            {status !== 'en_attente' && status !== 'annulee' ? (
              <a
                href={`/api/invoice?order_id=${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-light hover:underline font-bold"
              >
                Télécharger la facture (PDF)
              </a>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Facture disponible après confirmation</span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// ============================================================================
// Onglet Maintenance côté client : affiche les fiches maintenance_records
// réellement créées par l'admin (ou auto lors d'une livraison), avec :
//   - statut du programme (actif / à renouveler / suspendu / résilié)
//   - prochaine intervention prévue + alerte J-X
//   - historique complet des interventions technicien
//   - détail des filtres changés / pièces utilisées / coût
// ============================================================================

const CLIENT_MAINTENANCE_STATUS_LABELS: Record<MaintenanceRecord['status'], string> = {
  actif: 'Actif',
  a_renouveler: 'À renouveler',
  suspendu: 'Suspendu',
  resilie: 'Résilié',
};

const CLIENT_MAINTENANCE_STATUS_STYLE: Record<MaintenanceRecord['status'], { bg: string; fg: string }> = {
  actif: { bg: 'bg-success-soft', fg: 'text-success' },
  a_renouveler: { bg: 'bg-warning-soft', fg: 'text-warning' },
  suspendu: { bg: 'bg-bg-surface', fg: 'text-text-muted' },
  resilie: { bg: 'bg-danger-soft', fg: 'text-danger' },
};

const CLIENT_INTERVENTION_LABELS: Record<InterventionType, string> = {
  filter_change: 'Changement de filtre',
  inspection: 'Inspection',
  repair: 'Réparation',
  replacement: 'Remplacement',
  cleaning: 'Nettoyage',
  diagnostic: 'Diagnostic',
  other: 'Autre intervention',
};

const CLIENT_OUTCOME_LABELS: Record<InterventionOutcome, string> = {
  completed: 'Terminée',
  pending: 'En attente',
  failed: 'Échec',
};

function ClientMaintenanceTab({ initialRecords }: { initialRecords: MaintenanceRecord[] }) {
  const [records, setRecords] = useState<MaintenanceRecord[]>(initialRecords);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/maintenance/mine', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records ?? []);
      }
    } catch {
      /* silencieux : on garde l'état précédent */
    } finally {
      setLoading(false);
    }
  }, []);

  if (records.length === 0) {
    return (
      <div className="glass-card p-8 text-center" style={{ transform: 'none' }}>
        <ShieldAlert size={36} className="mx-auto mb-3 opacity-50" style={{ color: 'var(--text-muted)' }} />
        <h3 className="font-display font-bold text-lg mb-2">Suivi de la Maintenance</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          La maintenance sera disponible après la livraison confirmée de votre appareil.
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="btn-outline mt-4 inline-flex items-center gap-2 text-xs disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ transform: 'none' }}>
      <div className="glass-card p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-bold text-lg mb-2 flex items-center gap-2">
            <ShieldAlert size={18} className="text-sky-400" /> Suivi de la Maintenance
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Retrouvez le calendrier de maintenance, le détail des interventions et l&apos;historique des changements de filtres pour chaque appareil installé.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="btn-outline inline-flex items-center gap-2 text-xs disabled:opacity-50"
          title="Recharger les interventions"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {loading ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {records.map(record => (
        <ClientMaintenanceCard key={record.id} record={record} />
      ))}
    </div>
  );
}

function ClientMaintenanceCard({ record }: { record: MaintenanceRecord }) {
  const statusStyle = CLIENT_MAINTENANCE_STATUS_STYLE[record.status];
  const statusLabel = CLIENT_MAINTENANCE_STATUS_LABELS[record.status];
  const dueIn = record.next_service_date ? daysUntil(record.next_service_date) : null;
  const dueBadge = (() => {
    if (dueIn === null || record.status === 'resilie') return null;
    if (dueIn < 0) {
      return { text: `En retard de ${Math.abs(dueIn)} j`, color: 'text-danger', bg: 'bg-danger-soft', icon: AlertTriangle };
    }
    if (dueIn <= 30) {
      return { text: `Dans ${dueIn} j`, color: 'text-warning', bg: 'bg-warning-soft', icon: CalendarClock };
    }
    return { text: `Dans ${dueIn} j`, color: 'text-success', bg: 'bg-success-soft', icon: CheckCircle2 };
  })();

  return (
    <article className="glass-card p-6" style={{ transform: 'none' }}>
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 pb-4 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Wrench size={16} className="text-sky-400" />
            <h4 className="font-display font-bold text-base">{record.product_name}</h4>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Installé le {formatDate(record.install_date)}
            {record.order_id && (
              <span className="ml-2 font-mono">· Réf. {record.order_id.slice(0, 12)}</span>
            )}
          </div>
          {record.filter_types.length > 0 && (
            <div className="text-[11px] mt-2 flex flex-wrap gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span>Filtres suivis :</span>
              {record.filter_types.map(f => (
                <span key={f} className="px-2 py-0.5 rounded-full bg-bg-surface border border-[color:var(--border)] text-[10px]">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyle.bg} ${statusStyle.fg}`}>
            {statusLabel}
          </span>
          {dueBadge && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${dueBadge.bg} ${dueBadge.color}`}>
              <dueBadge.icon size={12} /> {dueBadge.text}
            </span>
          )}
        </div>
      </header>

      {/* Prochaine intervention */}
      {record.next_service_date && record.status !== 'resilie' && (
        <div className="grid sm:grid-cols-3 gap-4 mb-5 text-sm">
          <div className="rounded-xl border border-[color:var(--border)] bg-bg-surface p-3">
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Prochaine intervention
            </div>
            <div className="font-display font-bold text-base">{formatDate(record.next_service_date)}</div>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-bg-surface p-3">
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Dernier passage
            </div>
            <div className="font-display font-bold text-base">
              {record.last_service_date ? formatDate(record.last_service_date) : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] bg-bg-surface p-3">
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Interventions réalisées
            </div>
            <div className="font-display font-bold text-base">
              {record.intervention_count ?? (record.interventions?.length ?? 0)}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {record.notes && (
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Notes de l&apos;équipe technique
          </div>
          <p className="text-sm rounded-xl p-3 bg-bg-surface border border-[color:var(--border)] whitespace-pre-wrap">
            {record.notes}
          </p>
        </div>
      )}

      {/* Historique interventions */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Historique des interventions ({record.interventions?.length ?? 0})
        </div>
        {(!record.interventions || record.interventions.length === 0) ? (
          <div className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            <CircleDot size={20} className="mx-auto mb-2 opacity-50" />
            Aucune intervention enregistrée pour le moment.
          </div>
        ) : (
          <ol className="relative border-l-2 border-[color:var(--border)] ml-2 space-y-4">
            {record.interventions.map((it) => (
              <ClientInterventionItem key={it.id} intervention={it} />
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

function ClientInterventionItem({ intervention }: { intervention: MaintenanceIntervention }) {
  const outcomeStyle: Record<InterventionOutcome, { bg: string; fg: string }> = {
    completed: { bg: 'bg-success-soft', fg: 'text-success' },
    pending: { bg: 'bg-warning-soft', fg: 'text-warning' },
    failed: { bg: 'bg-danger-soft', fg: 'text-danger' },
  };
  return (
    <li className="ml-4 relative pl-4">
      <span
        className="absolute -left-[11px] top-1.5 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: 'var(--bg-card)', border: '2px solid var(--primary)' }}
      >
        <Wrench size={10} className="text-primary-light" />
      </span>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="font-semibold text-sm">{CLIENT_INTERVENTION_LABELS[intervention.intervention_type] ?? intervention.intervention_type}</div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${outcomeStyle[intervention.outcome].bg} ${outcomeStyle[intervention.outcome].fg}`}>
            {CLIENT_OUTCOME_LABELS[intervention.outcome]}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {formatDateTime(intervention.performed_at)}
          </span>
        </div>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {intervention.description}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {intervention.technician_name && (
          <span>👤 {intervention.technician_name}</span>
        )}
        {intervention.parts_used && intervention.parts_used.length > 0 && (
          <span>🔧 Pièces : {intervention.parts_used.join(', ')}</span>
        )}
        {intervention.cost > 0 && (
          <span className="font-semibold">💰 {formatCurrency(intervention.cost)}</span>
        )}
        {intervention.next_service_date && (
          <span>⏭️ Prochain : {formatDate(intervention.next_service_date)}</span>
        )}
      </div>
    </li>
  );
}

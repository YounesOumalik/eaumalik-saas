'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Pencil, Trash2, Archive, ArchiveRestore, Megaphone, Newspaper, Tag,
  CalendarClock, Search, AlertTriangle, Eye, EyeOff, Users,
  Image as ImageIcon,
} from 'lucide-react';
import type { News } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import Dialog from '@/components/ui/Dialog';
import {
  archiveNewsAction,
  unarchiveNewsAction,
  deleteNewsFromCrmAction,
  listAdminNewsAction,
} from '@/app/actions/clientActions';

// ============================================================================
// Props
// ============================================================================
type NewsListProps = {
  /** Liste initiale chargée côté serveur. */
  initialNews: News[];
  /**
   * Filtre parent : n'afficher que les annonces (`false`) ou les promotions
   * (`true`). Si `undefined`, on affiche les deux.
   */
  isPromotionFilter?: boolean;
  /** Édite un élément (bascule le parent en mode édition). */
  onEdit: (item: News) => void;
};

// ============================================================================
// Helpers
// ============================================================================
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ============================================================================
// Composant
// ============================================================================
export default function NewsList({ initialNews, isPromotionFilter, onEdit }: NewsListProps) {
  const toast = useToast();
  const [items, setItems] = useState<News[]>(initialNews);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<News | null>(null);
  const [pendingArchive, setPendingArchive] = useState<News | null>(null);
  const [pendingRestore, setPendingRestore] = useState<News | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  // Re-sync depuis le serveur (utile après un retour à la liste depuis l'édition)
  const refresh = () => {
    startTransition(async () => {
      const res = await listAdminNewsAction();
      if (res.success) setItems(res.news);
    });
  };

  // Filtrage local : par type + recherche + archive
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(n => {
      if (isPromotionFilter !== undefined && n.is_promotion !== isPromotionFilter) return false;
      const archived = n.is_archived === true;
      if (!showArchived && archived) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    });
  }, [items, isPromotionFilter, showArchived, search]);

  const counts = useMemo(() => {
    const all = items.filter(n =>
      isPromotionFilter === undefined ? true : n.is_promotion === isPromotionFilter
    );
    return {
      total: all.length,
      active: all.filter(n => n.is_archived !== true).length,
      archived: all.filter(n => n.is_archived === true).length,
    };
  }, [items, isPromotionFilter]);

  // ============================================================================
  // Handlers
  // ============================================================================
  const onConfirmArchive = async () => {
    if (!pendingArchive) return;
    setBusy(true);
    const res = await archiveNewsAction(pendingArchive.id, null);
    setBusy(false);
    if (res.success && res.news) {
      toast(`📦 « ${pendingArchive.title} » archivée.`, 'success');
      // Remplace l'élément dans la liste locale
      setItems(prev => prev.map(n => (n.id === res.news!.id ? res.news! : n)));
      setPendingArchive(null);
    } else {
      toast(res.error || 'Archivage impossible', 'error');
    }
  };

  const onConfirmRestore = async () => {
    if (!pendingRestore) return;
    setBusy(true);
    const res = await unarchiveNewsAction(pendingRestore.id);
    setBusy(false);
    if (res.success && res.news) {
      toast(`♻️ « ${pendingRestore.title} » restaurée.`, 'success');
      setItems(prev => prev.map(n => (n.id === res.news!.id ? res.news! : n)));
      setPendingRestore(null);
    } else {
      toast(res.error || 'Restauration impossible', 'error');
    }
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    const res = await deleteNewsFromCrmAction(pendingDelete.id);
    setBusy(false);
    if (res.success) {
      toast(`🗑️ « ${pendingDelete.title} » supprimée.`, 'success');
      setItems(prev => prev.filter(n => n.id !== pendingDelete.id));
      setPendingDelete(null);
    } else {
      toast(res.error || 'Suppression impossible', 'error');
    }
  };

  // ============================================================================
  // Rendu
  // ============================================================================
  return (
    <div className="space-y-4">
      {/* ===================== BARRE D'OUTILS ===================== */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[12rem]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans les titres / contenus..."
            className="form-input pl-9 py-2 text-sm w-full"
            aria-label="Rechercher une publication"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowArchived(v => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
            showArchived
              ? 'border-[color:var(--border)] bg-[color:var(--bg-surface)]'
              : 'border-primary/40 bg-primary/5 text-primary'
          }`}
          aria-pressed={showArchived}
        >
          {showArchived ? <Eye size={14} /> : <EyeOff size={14} />}
          {showArchived ? 'Inclure archivées' : 'Archivées masquées'}
        </button>

        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg)]"
          title="Recharger la liste depuis le serveur"
        >
          🔄 Rafraîchir
        </button>
      </div>

      {/* Compteurs rapides */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>
          <strong className="text-[color:var(--text)]">{counts.active}</strong> active{counts.active > 1 ? 's' : ''}
        </span>
        {showArchived && counts.archived > 0 && (
          <>
            <span>·</span>
            <span>
              <strong className="text-[color:var(--text)]">{counts.archived}</strong> archivée{counts.archived > 1 ? 's' : ''}
            </span>
          </>
        )}
        <span>·</span>
        <span>{filtered.length} affichée{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* ===================== LISTE ===================== */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--bg-surface)] p-10 text-center">
          <Megaphone size={28} className="mx-auto opacity-30 mb-3" />
          <p className="text-sm font-semibold">
            {search.trim()
              ? 'Aucun résultat pour cette recherche.'
              : isPromotionFilter === true
                ? 'Aucune promotion pour le moment.'
                : isPromotionFilter === false
                  ? 'Aucune annonce pour le moment.'
                  : 'Aucune publication pour le moment.'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Utilisez le formulaire ci-dessus pour en créer une.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(n => {
            const archived = n.is_archived === true;
            const expired = n.valid_until ? new Date(n.valid_until).getTime() < Date.now() : false;
            return (
              <li
                key={n.id}
                className={`relative rounded-2xl border bg-[color:var(--bg-surface)] p-4 flex flex-col gap-3 transition-shadow hover:shadow-md ${
                  archived
                    ? 'border-dashed border-warning/40 opacity-80'
                    : 'border-[color:var(--border)]'
                }`}
              >
                {/* Badge type + statut */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        n.is_promotion
                          ? 'bg-warning/15 text-warning'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {n.is_promotion ? <Tag size={10} /> : <Newspaper size={10} />}
                      {n.is_promotion ? 'Promotion' : 'Annonce'}
                    </span>
                    {archived && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/15 text-warning">
                        <Archive size={10} /> Archivée
                      </span>
                    )}
                    {!archived && expired && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                        ⏰ Expirée
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(n)}
                      className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--bg)] hover:text-primary"
                      title="Modifier cette publication"
                      aria-label={`Modifier ${n.title}`}
                    >
                      <Pencil size={15} />
                    </button>
                    {archived ? (
                      <button
                        type="button"
                        onClick={() => setPendingRestore(n)}
                        className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--bg)] hover:text-success"
                        title="Restaurer cette publication"
                        aria-label={`Restaurer ${n.title}`}
                      >
                        <ArchiveRestore size={15} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingArchive(n)}
                        className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:bg-[color:var(--bg)] hover:text-warning"
                        title="Archiver cette publication"
                        aria-label={`Archiver ${n.title}`}
                      >
                        <Archive size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingDelete(n)}
                      className="p-1.5 rounded-lg text-[color:var(--text-muted)] hover:bg-red-500/10 hover:text-red-500"
                      title="Supprimer définitivement"
                      aria-label={`Supprimer ${n.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Image ou icône */}
                {n.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={n.image_url}
                    alt={n.title}
                    className="w-full h-32 object-cover rounded-xl border border-[color:var(--border)]"
                  />
                ) : (
                  <div className="w-full h-16 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--bg)] flex items-center justify-center text-[color:var(--text-muted)]">
                    <ImageIcon size={18} />
                    <span className="ml-2 text-xs">Aucune image</span>
                  </div>
                )}

                {/* Titre + contenu */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-sm leading-snug line-clamp-2">
                    {n.title}
                  </h3>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                    {n.content}
                  </p>
                </div>

                {/* Promotion : prix */}
                {n.is_promotion && (n.price != null || n.original_price != null) && (
                  <div className="flex items-center gap-2 text-sm">
                    {n.price != null && (
                      <span className="font-display font-extrabold text-warning">
                        {formatCurrency(n.price)}
                      </span>
                    )}
                    {n.original_price != null && (
                      <span className="text-xs text-stone-400 line-through">
                        {formatCurrency(n.original_price)}
                      </span>
                    )}
                  </div>
                )}

                {/* Pied : méta */}
                <div className="border-t border-[color:var(--border)] pt-2 flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock size={11} />
                    {n.is_promotion
                      ? `Valide jusqu'au ${formatDate(n.valid_until)}`
                      : `Publié le ${formatDateTime(n.created_at)}`}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {n.target_all !== false ? (
                      <>
                        <Users size={11} />
                        Tous
                      </>
                    ) : (
                      <>
                        <Users size={11} />
                        {n.target_user_ids?.length ?? 0} ciblé{(n.target_user_ids?.length ?? 0) > 1 ? 's' : ''}
                      </>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ===================== MODALES DE CONFIRMATION ===================== */}
      <Dialog
        open={pendingArchive !== null}
        onClose={() => !busy && setPendingArchive(null)}
        title="Archiver la publication"
        icon={<Archive size={18} className="text-warning" />}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingArchive(null)}
              disabled={busy}
              className="btn-outline flex-1 justify-center py-2.5 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirmArchive}
              disabled={busy}
              className="btn-primary flex-1 justify-center py-2.5 bg-warning text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Archivage...' : '📦 Archiver'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">
            Archiver <strong>« {pendingArchive?.title} »</strong> ?
          </p>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning text-xs">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              La publication disparaîtra du carrousel de la landing page, de la boutique et de l&apos;espace client.
              Vous pourrez la <strong>restaurer</strong> à tout moment depuis cette même page.
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={pendingRestore !== null}
        onClose={() => !busy && setPendingRestore(null)}
        title="Restaurer la publication"
        icon={<ArchiveRestore size={18} className="text-success" />}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingRestore(null)}
              disabled={busy}
              className="btn-outline flex-1 justify-center py-2.5 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirmRestore}
              disabled={busy}
              className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50"
            >
              {busy ? 'Restauration...' : '♻️ Restaurer'}
            </button>
          </>
        }
      >
        <p className="text-sm">
          Restaurer <strong>« {pendingRestore?.title} »</strong> ? Elle sera à nouveau visible publiquement.
        </p>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => !busy && setPendingDelete(null)}
        title="Supprimer définitivement"
        icon={<Trash2 size={18} className="text-red-500" />}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              disabled={busy}
              className="btn-outline flex-1 justify-center py-2.5 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={busy}
              className="btn-primary flex-1 justify-center py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Suppression...' : '🗑️ Supprimer'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm">
            Supprimer définitivement <strong>« {pendingDelete?.title} »</strong> ?
          </p>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-600 text-xs">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              Cette action est <strong>irréversible</strong>. La publication sera effacée
              de la base de données. Pour la masquer sans la supprimer, préférez l&apos;archivage.
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

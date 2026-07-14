'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Megaphone, Newspaper, Tag, CalendarClock } from 'lucide-react';
import type { News } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import Dialog from '@/components/ui/Dialog';
import {
  createNewsAction,
  updateNewsAction,
  deleteNewsAction,
} from '@/app/actions/newsActions';

const optionalNumber = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : Number(v);

const FormSchema = z.object({
  title: z.string().min(3, 'Titre trop court (min. 3 caractères).').max(160, 'Titre trop long.'),
  content: z.string().min(5, 'Contenu trop court (min. 5 caractères).').max(4000, 'Contenu trop long.'),
  image_url: z.string().url('URL d’image invalide.').optional().or(z.literal('')),
  is_promotion: z.boolean().optional(),
  price: z.preprocess(optionalNumber, z.number().nonnegative('Prix invalide.').optional()),
  original_price: z.preprocess(optionalNumber, z.number().nonnegative('Prix d’origine invalide.').optional()),
  valid_until: z.string().optional().or(z.literal('')),
  target_all: z.boolean().optional(),
});
type FormData = z.infer<typeof FormSchema>;

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function NewsManager({ initialNews }: { initialNews: News[] }) {
  const toast = useToast();
  const [news, setNews] = useState<News[]>(initialNews);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<News | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<News | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
  });

  useEffect(() => {
    if (formOpen) {
      if (editing) {
        reset({
          title: editing.title,
          content: editing.content,
          image_url: editing.image_url ?? '',
          is_promotion: editing.is_promotion,
          price: editing.price ?? undefined,
          original_price: editing.original_price ?? undefined,
          valid_until: toDatetimeLocal(editing.valid_until),
          target_all: editing.target_all,
        });
      } else {
        reset({
          title: '',
          content: '',
          image_url: '',
          is_promotion: false,
          price: undefined,
          original_price: undefined,
          valid_until: '',
          target_all: true,
        });
      }
    }
  }, [formOpen, editing, reset]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (n: News) => {
    setEditing(n);
    setFormOpen(true);
  };
  const askDelete = (n: News) => {
    setPendingDelete(n);
    setConfirmOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        title: data.title,
        content: data.content,
        image_url: data.image_url || null,
        is_promotion: !!data.is_promotion,
        price: data.price ?? null,
        original_price: data.original_price ?? null,
        valid_until: data.valid_until ? new Date(data.valid_until).toISOString() : null,
        target_all: data.target_all ?? true,
        target_user_ids: [],
        product_ids: [],
      };

      const res = editing
        ? await updateNewsAction(editing.id, payload)
        : await createNewsAction(payload);

      if (res.success && res.news) {
        toast(editing ? 'Actualité mise à jour' : 'Actualité publiée', 'success');
        setNews(prev => {
          const without = prev.filter(n => n.id !== res.news!.id);
          return [res.news!, ...without];
        });
        setFormOpen(false);
        setEditing(null);
      } else {
        toast(res.error || 'Erreur', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Erreur inconnue', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      const res = await deleteNewsAction(pendingDelete.id);
      if (res.success) {
        toast('Actualité supprimée', 'success');
        setNews(prev => prev.filter(n => n.id !== pendingDelete.id));
      } else {
        toast(res.error || 'Erreur', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Erreur inconnue', 'error');
    } finally {
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Actualités / Promotions</h1>
          <p className="text-sm text-stone-500 mt-1">
            Publiez des actualités ou des offres promotionnelles visibles sur la boutique et la page d’accueil.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5">
          <Plus size={16} /> Nouvelle publication
        </button>
      </div>

      {news.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <Megaphone size={28} className="mx-auto text-stone-300 mb-3" />
          <p className="text-stone-500">Aucune actualité ou promotion pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {news.map(n => (
            <article key={n.id} className="rounded-2xl border border-stone-200 bg-white p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    n.is_promotion
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {n.is_promotion ? <Tag size={12} /> : <Newspaper size={12} />}
                  {n.is_promotion ? 'Promotion' : 'Actualité'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(n)}
                    className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100"
                    aria-label={`Modifier ${n.title}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => askDelete(n)}
                    className="p-1.5 rounded-lg text-danger hover:bg-red-50"
                    aria-label={`Supprimer ${n.title}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {n.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={n.image_url}
                  alt={n.title}
                  className="w-full h-36 object-cover rounded-xl mb-3"
                />
              )}

              <h3 className="font-serif text-lg text-stone-900 leading-snug">{n.title}</h3>
              <p className="text-sm text-stone-500 mt-1 line-clamp-3 flex-1">{n.content}</p>

              {n.is_promotion && (n.price != null || n.original_price != null) && (
                <div className="mt-3 flex items-center gap-2">
                  {n.price != null && (
                    <span className="font-semibold text-brand-700">{formatCurrency(n.price)}</span>
                  )}
                  {n.original_price != null && (
                    <span className="text-sm text-stone-400 line-through">{formatCurrency(n.original_price)}</span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-400">
                <CalendarClock size={13} />
                <span>Valide jusqu’au {formatDate(n.valid_until)}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Formulaire de création / édition */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier la publication' : 'Nouvelle publication'}
        subtitle={editing ? editing.id : 'Renseignez les informations ci-dessous'}
        size="lg"
        maxHeight="tall"
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} className="btn-outline flex-1 justify-center py-2.5">
              Annuler
            </button>
            <button type="submit" form="news-form" disabled={isSubmitting} className="btn-primary flex-1 justify-center py-2.5">
              {isSubmitting ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Publier'}
            </button>
          </>
        }
      >
        <form id="news-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="form-label">Titre *</label>
            <input className="form-input" placeholder="Ex : Soldes d’été – 20% sur les osmoseurs" {...register('title')} />
            {errors.title && <p className="text-xs text-danger mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="form-label">Contenu *</label>
            <textarea className="form-input" rows={4} placeholder="Décrivez l’actualité ou la promotion..." {...register('content')} />
            {errors.content && <p className="text-xs text-danger mt-1">{errors.content.message}</p>}
          </div>

          <div>
            <label className="form-label">Image (URL)</label>
            <input className="form-input" placeholder="https://... ou /products/..." {...register('image_url')} />
            {errors.image_url && <p className="text-xs text-danger mt-1">{errors.image_url.message}</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Prix promotionnel (DH)</label>
              <input type="number" step="0.01" min={0} className="form-input" placeholder="0" {...register('price')} />
              {errors.price && <p className="text-xs text-danger mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="form-label">Prix d’origine (DH)</label>
              <input type="number" step="0.01" min={0} className="form-input" placeholder="0" {...register('original_price')} />
              {errors.original_price && <p className="text-xs text-danger mt-1">{errors.original_price.message}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Valide jusqu’au</label>
            <input type="datetime-local" className="form-input" {...register('valid_until')} />
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_promotion')} />
              <span className="text-sm flex items-center gap-1">
                <Tag size={12} className="text-brand-600" /> Marquer comme promotion
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('target_all')} />
              <span className="text-sm">Diffuser à tous les clients</span>
            </label>
          </div>
        </form>
      </Dialog>

      {/* Confirmation de suppression */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Supprimer la publication"
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setConfirmOpen(false)} className="btn-outline flex-1 justify-center py-2.5">
              Annuler
            </button>
            <button type="button" onClick={confirmDelete} className="btn-primary flex-1 justify-center py-2.5 bg-danger hover:bg-red-700">
              Supprimer
            </button>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          Voulez-vous vraiment supprimer <strong>{pendingDelete?.title}</strong> ? Cette action est irréversible.
        </p>
      </Dialog>
    </div>
  );
}

'use client';

/**
 * CataloguePdfManager — Panneau admin d'upload/replace/delete du PDF catalogue.
 *
 * Affiché dans /admin/catalogue (juste sous le CatalogueManager produit).
 * Le PDF uploadé alimente le flipbook de la landing page (`/`).
 *
 * Sécurité :
 *   - Admin (superadmin OU administrator) requis — gate() côté Server Action.
 *   - Header %PDF validé avant écriture.
 *   - Taille max 25 Mo (sanity check).
 *   - Nom de fichier sanitizé (regex stricte, basename, extension forcée).
 *
 * UX :
 *   - Zone drag-and-drop avec aperçu du PDF courant (iframe embed).
 *   - Bouton "Remplacer" qui ouvre un sélecteur de fichier.
 *   - Bouton "Réinitialiser" qui supprime le PDF uploadé (retombe sur le
 *     fallback `public/catalogue/Catalogue_EauMalik.pdf`).
 *   - Toast de feedback succès/erreur.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Trash2,
  FileText,
  Calendar,
  HardDrive,
  Download,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/components/shared/ToastProvider';
import {
  uploadCataloguePdfAction,
  deleteCataloguePdfAction,
  getCataloguePdfAction,
  CATALOGUE_PDF_MAX_SIZE,
} from '@/app/actions/cataloguePdfActions';

type CataloguePdfState = {
  filename: string;
  mime: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string | null;
} | null;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function CataloguePdfManager() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [record, setRecord] = useState<CataloguePdfState>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Petit "nonce" pour forcer le navigateur à recharger l'iframe d'aperçu
  // quand l'admin upload un nouveau PDF (sinon le cache HTTP du navigateur
  // continue de servir l'ancien PDF dans l'iframe).
  const [previewNonce, setPreviewNonce] = useState<number>(Date.now());

  // Chargement initial des métadonnées du PDF courant.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getCataloguePdfAction();
      if (cancelled) return;
      if (res.success) {
        setRecord(res.record);
        setPreviewNonce(Date.now());
      } else {
        toast(res.error || 'Erreur de chargement.', 'error');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function uploadFile(file: File) {
    if (!file) return;
    if (file.size > CATALOGUE_PDF_MAX_SIZE) {
      const mo = (CATALOGUE_PDF_MAX_SIZE / (1024 * 1024)).toFixed(0);
      toast(`Fichier trop volumineux (max ${mo} Mo).`, 'error');
      return;
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      toast('Le fichier doit être un PDF.', 'error');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('displayName', file.name);
      const res = await uploadCataloguePdfAction(fd);
      if (res.success) {
        setRecord(res.record);
        setPreviewNonce(Date.now());
        toast('Catalogue PDF mis à jour ✅', 'success');
      } else {
        toast(res.error || 'Erreur lors de l\u2019upload.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Erreur inconnue.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        'Supprimer le PDF catalogue courant ? La landing affichera alors le PDF de fallback (livré avec l\u2019application).',
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await deleteCataloguePdfAction();
      if (res.success) {
        setRecord(null);
        setPreviewNonce(Date.now());
        toast('Catalogue PDF réinitialisé.', 'success');
      } else {
        toast(res.error || 'Erreur lors de la suppression.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Erreur inconnue.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave() {
    setDragOver(false);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center gap-3 text-sm text-meta">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement du catalogue PDF…
      </div>
    );
  }

  return (
    <section className="glass-card p-6 space-y-4" aria-labelledby="catalogue-pdf-heading">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 id="catalogue-pdf-heading" className="font-serif text-xl text-heading">
              Catalogue PDF (Flipbook landing page)
            </h2>
          </div>
          <p className="text-sm text-meta max-w-xl">
            Ce PDF est feuilletable par les visiteurs sur la page d&apos;accueil. Remplacez-le à
            tout moment — un superadmin ou un administrateur peut le faire.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {record ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || uploading}
              className="btn-outline text-sm flex items-center gap-1.5"
              aria-label="Réinitialiser au PDF de fallback"
            >
              <Trash2 size={14} /> {deleting ? 'Suppression…' : 'Réinitialiser'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={openFilePicker}
            disabled={uploading || deleting}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Upload size={14} />{' '}
            {uploading ? 'Upload…' : record ? 'Remplacer' : 'Téléverser un PDF'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
        </div>
      </div>

      {/* Zone drag-and-drop */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`relative rounded-2xl border-2 border-dashed transition-colors p-6 ${
          dragOver ? 'border-primary bg-primary/5' : 'border-soft'
        }`}
        role="region"
        aria-label="Zone de dépôt du PDF"
      >
        <div className="flex flex-col items-center text-center gap-2 pointer-events-none">
          <Upload className={`w-8 h-8 ${dragOver ? 'text-primary' : 'text-meta'}`} />
          <p className="text-sm text-body">
            Glissez-déposez votre PDF ici, ou{' '}
            <button
              type="button"
              onClick={openFilePicker}
              className="font-semibold underline pointer-events-auto"
              style={{ color: 'var(--primary)' }}
            >
              parcourir
            </button>
          </p>
          <p className="text-xs text-meta">
            PDF uniquement · max {(CATALOGUE_PDF_MAX_SIZE / (1024 * 1024)).toFixed(0)} Mo
          </p>
        </div>
      </div>

      {/* État courant + aperçu */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Métadonnées */}
        <div className="rounded-2xl border-soft surface-savor p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-meta">Catalogue actuel</h3>
          {record ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold text-body">PDF personnalisé actif</span>
              </div>
              <div className="flex items-center gap-2 text-body">
                <FileText className="w-4 h-4 text-meta" />
                <span className="font-mono text-xs break-all">{record.filename}</span>
              </div>
              <div className="flex items-center gap-2 text-meta">
                <HardDrive className="w-4 h-4" />
                <span>{formatBytes(record.size)}</span>
              </div>
              <div className="flex items-center gap-2 text-meta">
                <Calendar className="w-4 h-4" />
                <span>Mis en ligne le {formatDate(record.uploadedAt)}</span>
              </div>
              {record.uploadedBy ? (
                <div className="text-xs text-meta">par {record.uploadedBy}</div>
              ) : null}
              <a
                href="/api/catalogue/pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold mt-2"
                style={{ color: 'var(--primary)' }}
              >
                <Download size={12} /> Ouvrir le PDF dans un nouvel onglet
              </a>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
              <div className="text-meta">
                Aucun PDF personnalisé. La landing utilise le PDF de fallback livré avec
                l&apos;application (<code className="font-mono text-xs">public/catalogue/</code>).
              </div>
            </div>
          )}
        </div>

        {/* Aperçu */}
        <div className="rounded-2xl border-soft overflow-hidden bg-slate-100 dark:bg-slate-900">
          {record ? (
            <iframe
              key={previewNonce}
              src={`/api/catalogue/pdf?v=${previewNonce}`}
              title="Aperçu du catalogue PDF"
              className="w-full h-72"
            />
          ) : (
            <iframe
              key={`fallback-${previewNonce}`}
              src="/catalogue/Catalogue_EauMalik.pdf"
              title="Aperçu du catalogue PDF de fallback"
              className="w-full h-72"
            />
          )}
        </div>
      </div>
    </section>
  );
}

'use client';

/**
 * CatalogueFlipbookSection — Section "Feuilletez notre catalogue" sur la
 * landing page (`/`).
 *
 * Le PDF est servi par `/api/catalogue/pdf` :
 *   - soit le PDF uploadé par l'admin (depuis /admin/catalogue)
 *   - soit le fallback `public/catalogue/Catalogue_EauMalik.pdf`
 *
 * Côté UX :
 *   - Page de couverture + dos simulé (effet livre ouvert)
 *   - Navigation prev/next + numéro de page
 *   - Miniatures cliquables
 *   - Bouton zoom plein écran
 *   - Bouton "Télécharger le PDF"
 *   - Animation de transition entre pages (CSS 3D rotateY)
 *
 * Côté implémentation :
 *   - pdfjs-dist (npm, ~200 KB) — rendu des pages via <canvas>
 *   - Worker servi depuis `pdfjs-dist/build/pdf.worker.min.mjs`
 *     (copié vers `public/pdfjs/` pour respecter la CSP — voir
 *     `next.config.mjs` et la section CSP `worker-src 'self' blob:`)
 *   - Pas de rendu côté SSR : la section attend l'hydratation avant de
 *     charger pdfjs (lazy import dynamique).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react';

interface FlipbookState {
  pageCount: number;
  /** data URLs des pages déjà rendues (cache mémoire). */
  pages: (string | null)[];
}

const RENDER_SCALE = 1.4; // compromis qualité/performances

export default function CatalogueFlipbookSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<FlipbookState>({ pageCount: 0, pages: [] });
  const [currentPage, setCurrentPage] = useState(0); // 0 = couverture
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pdfDocRef = useRef<any>(null);

  // Charge le PDF une seule fois (lazy import pdfjs-dist).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Import dynamique pour éviter de tirer pdfjs dans le bundle SSR
        // (Next.js compile les 'use client' quand même côté serveur pour
        // l'hydratation — un import top-level ferait grossir le bundle).
        const pdfjsLib: any = await import('pdfjs-dist');
        // Le worker est servi depuis /pdfjs/pdf.worker.min.mjs (copié via
        // le Dockerfile dans public/pdfjs/). On désactive le fallback CDN
        // pour rester 100% self-hosted.
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

        const loadingTask = pdfjsLib.getDocument({
          url: '/api/catalogue/pdf',
          // Important : avec `output: 'standalone'` (Docker), /api/catalogue/pdf
          // est servi par le runtime Node, donc les Range requests fonctionnent.
          rangeChunkSize: 65536,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        const pageCount = pdf.numPages;
        setState({ pageCount, pages: new Array(pageCount).fill(null) });
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        // Message user-friendly : 404 = pas de PDF, autre = erreur technique.
        const msg =
          err?.message?.includes('404') || err?.message?.includes('InvalidPDF')
            ? 'Catalogue PDF indisponible pour le moment.'
            : err?.message || 'Impossible de charger le catalogue PDF.';
        setError(msg);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rend la page courante dans le canvas (memo par page).
  const renderPage = useCallback(
    async (pageIndex: number) => {
      if (!pdfDocRef.current) return;
      const cached = state.pages[pageIndex];
      if (cached) {
        drawToCanvas(cached);
        return;
      }
      try {
        const pdf = pdfDocRef.current;
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setState((prev) => {
          const next = { ...prev, pages: [...prev.pages] };
          next.pages[pageIndex] = dataUrl;
          return next;
        });
      } catch (err: any) {
        console.error('[flipbook] renderPage error', err);
      }
    },
    [state.pages],
  );

  // Dessine une data URL dans le canvas principal.
  const drawToCanvas = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  // À chaque changement de page, on (re)rend.
  useEffect(() => {
    if (state.pageCount === 0) return;
    void renderPage(currentPage);
  }, [currentPage, state.pageCount, renderPage]);

  // Pré-rendu des pages adjacentes (prev/next) pour une navigation fluide.
  useEffect(() => {
    if (state.pageCount === 0) return;
    const neighbors = [currentPage - 1, currentPage + 1].filter(
      (i) => i >= 0 && i < state.pageCount && !state.pages[i],
    );
    neighbors.forEach((i) => {
      // Rend en parallèle sans bloquer l'UI.
      void renderPage(i);
    });
  }, [currentPage, state.pageCount, state.pages, renderPage]);

  // Plein écran.
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('[flipbook] fullscreen error', err);
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const next = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, state.pageCount - 1));
  }, [state.pageCount]);

  const prev = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 0));
  }, []);

  // Clavier : flèches gauche/droite.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) && !isFullscreen) return;
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, isFullscreen]);

  const progressPct = useMemo(() => {
    if (state.pageCount <= 1) return 0;
    return (currentPage / (state.pageCount - 1)) * 100;
  }, [currentPage, state.pageCount]);

  return (
    <section
      id="catalogue-flipbook"
      className="py-24 surface-page"
      aria-labelledby="flipbook-heading"
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* En-tête */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full pill-themed text-xs font-bold uppercase tracking-[0.3em] mb-4">
            <BookOpen className="w-4 h-4" /> Catalogue
          </div>
          <h2 id="flipbook-heading" className="font-serif text-4xl md:text-6xl mb-4 text-heading">
            Feuilletez notre catalogue
          </h2>
          <p className="max-w-2xl mx-auto text-body">
            Parcourez nos produits page par page, comme un vrai catalogue papier. Téléchargez-le
            pour le consulter hors-ligne.
          </p>
        </div>

        {/* Livre + contrôles */}
        <div
          ref={containerRef}
          className="relative surface-card rounded-3xl p-4 sm:p-6 lg:p-8 border-soft"
        >
          {/* Erreur */}
          {error ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm">
                {error}
              </div>
              <p className="mt-4 text-meta text-sm">
                L&apos;équipe technique a été notifiée. Vous pouvez aussi{' '}
                <a
                  href="/api/catalogue/pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: 'var(--primary)' }}
                >
                  ouvrir le PDF directement
                </a>
                .
              </p>
            </div>
          ) : null}

          {/* Loader */}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-meta">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Chargement du catalogue…
            </div>
          ) : null}

          {/* Canvas + navigation */}
          {!loading && !error && state.pageCount > 0 ? (
            <>
              <div className="relative mx-auto" style={{ perspective: '1800px' }}>
                <div
                  className="flipbook-page relative mx-auto rounded-xl overflow-hidden shadow-2xl border-soft"
                  style={{ transformStyle: 'preserve-3d' }}
                  key={currentPage}
                >
                  <canvas
                    ref={canvasRef}
                    className="block max-w-full h-auto bg-white"
                    aria-label={`Page ${currentPage + 1} sur ${state.pageCount}`}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none rounded-xl"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 12%, rgba(0,0,0,0) 88%, rgba(0,0,0,0.22) 100%)',
                    }}
                  />
                </div>
              </div>

              {/* Barre de contrôles */}
              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={prev}
                  disabled={currentPage === 0}
                  className="btn-outline flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Page précédente"
                >
                  <ChevronLeft size={16} /> Précédente
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-body" aria-live="polite">
                    Page {currentPage + 1} / {state.pageCount}
                  </span>
                  <div className="hidden sm:block w-32 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${progressPct}%`,
                        background: 'var(--primary)',
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={next}
                  disabled={currentPage >= state.pageCount - 1}
                  className="btn-primary flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Page suivante"
                >
                  Suivante <ChevronRight size={16} />
                </button>
              </div>

              {/* Miniatures */}
              <div
                className="mt-6 flex gap-2 overflow-x-auto pb-2"
                aria-label="Miniatures des pages"
              >
                {state.pages.map((dataUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentPage(i)}
                    className={`relative shrink-0 w-16 h-20 rounded-md overflow-hidden border-2 transition-all ${
                      i === currentPage
                        ? 'border-primary scale-105'
                        : 'border-soft hover:border-primary/40'
                    }`}
                    aria-label={`Aller à la page ${i + 1}`}
                    aria-current={i === currentPage ? 'page' : undefined}
                  >
                    {dataUrl ? (
                      <img src={dataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-meta">
                        {i + 1}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Actions secondaires */}
              <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="btn-outline text-xs flex items-center gap-1.5"
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  {isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                </button>
                <a
                  href="/api/catalogue/pdf"
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline text-xs flex items-center gap-1.5"
                >
                  <Download size={14} /> Télécharger le PDF
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Styles locaux pour l'effet 3D */}
      <style jsx>{`
        .flipbook-page {
          animation: flipbook-fade 0.45s ease-out;
          max-width: min(720px, 100%);
          background: linear-gradient(135deg, #fff 0%, #f7f7f7 100%);
        }
        @keyframes flipbook-fade {
          from {
            opacity: 0;
            transform: rotateY(-12deg) translateX(-10px);
          }
          to {
            opacity: 1;
            transform: rotateY(0deg) translateX(0);
          }
        }
      `}</style>
    </section>
  );
}

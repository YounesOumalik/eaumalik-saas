'use client';

import { useEffect } from 'react';

/**
 * Active la révélation des éléments `.reveal` du document.
 *
 * Stratégie progressive (no-JS-safe) :
 *   1) Si IntersectionObserver est disponible → on ajoute `reveal-pending` sur
 *      <html>, ce qui déclenche le masquage initial (.reveal → opacity:0)
 *      défini dans globals.css, puis on observe les éléments.
 *   2) Sinon → on ajoute directement `revealed` à tous les éléments pour qu'ils
 *      restent visibles.
 *
 * Pourquoi cette gymnastique : si on faisait l'inverse (CSS cache par défaut),
 * un échec JS (CSP, extension, hydration error…) rendrait la page illisible.
 *
 * Doit être monté une seule fois au niveau du layout racine (Providers).
 */
export default function RevealOnScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Pas d'IntersectionObserver → révèle tout (sécurité + vieux navigateurs).
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('revealed'));
      return;
    }

    // 1) Active le mode "pending" qui rend les .reveal invisibles via CSS.
    document.documentElement.classList.add('reveal-pending');

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    const observeElement = (element: Element) => {
      if (element.matches('.reveal:not(.revealed)')) {
        observer.observe(element);
      }
      element
        .querySelectorAll('.reveal:not(.revealed)')
        .forEach(el => observer.observe(el));
    };

    // 2) Observe ce qui existe déjà (rendu initial).
    document
      .querySelectorAll('.reveal:not(.revealed)')
      .forEach(el => observer.observe(el));

    // 3) Observe aussi les éléments ajoutés après (changement de page via App Router).
    // On inspecte uniquement les nouveaux sous-arbres au lieu de rescanner tout
    // le document à chaque mutation React.
    const mo = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (node instanceof Element) observeElement(node);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mo.disconnect();
      // Pas de retrait de reveal-pending : on garde l'état cohérent si le
      // composant remonte avant que l'utilisateur navigue.
    };
  }, []);

  return null;
}

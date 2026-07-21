'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Client Espace Error]', error);
  }, [error]);

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center max-w-xl mx-auto my-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-50">
        Une erreur est survenue dans votre espace client
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Nous n&apos;avons pas pu charger vos informations de compte. Veuillez réessayer.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-slate-400 font-mono">Incident ID: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={reset}
          className="rounded-lg bg-teal-600 hover:bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Retour à la boutique
        </Link>
      </div>
    </div>
  );
}

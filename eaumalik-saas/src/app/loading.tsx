export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="relative flex items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600 dark:border-slate-800 dark:border-t-teal-500"></div>
        <div className="absolute h-8 w-8 rounded-full bg-teal-50/50 dark:bg-teal-950/20 animate-pulse"></div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse animate-duration-1000">
        Chargement en cours...
      </p>
    </div>
  );
}

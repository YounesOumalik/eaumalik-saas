export default function CrmLoading() {
  return (
    <div className="w-full p-6 space-y-6">
      <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/4 animate-pulse"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
        <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
        <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
        <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
      <div className="h-72 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
    </div>
  );
}

'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; type: ToastType; }

interface ToastContextValue { toast: (m: string, t?: ToastType) => void; }
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setList(l => [...l, { id, message, type }]);
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 4000);
  }, []);

  const colorClass = {
    success: 'bg-emerald-900/80 text-emerald-200 border-emerald-500',
    error:   'bg-red-900/80 text-red-200 border-red-500',
    info:    'bg-cyan-900/80 text-cyan-200 border-cyan-500',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {list.map(t => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium shadow-xl border backdrop-blur-md animate-toast-in max-w-sm ${colorClass[t.type]}`}
          >
            <span>{t.message}</span>
            <button
              onClick={() => setList(l => l.filter(x => x.id !== t.id))}
              className="ml-2 opacity-70 hover:opacity-100"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}

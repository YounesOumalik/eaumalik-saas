'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Nom ou email à afficher. */
  displayName: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState('');

  // Mode dev (sans Supabase) : session factice écrite par /api/auth/dev-login
  // ou par le checkout invité, lue depuis sessionStorage. On la garde en état
  // pour pouvoir la mettre à jour sans reload (événement custom ci-dessous).
  const [devUser, setDevUser] = useState<any>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('eaumalik_dev_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const supabase = maybeSupabaseBrowserClient();

  const fetchProfile = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', uid)
      .single();
    setIsAdmin((data?.role as string) === 'admin');
    setDisplayName(
      (data?.full_name as string | undefined) ?? user?.email ?? ''
    );
  }, [supabase, user?.email]);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user ?? null);
    if (data.session?.user) {
      await fetchProfile(data.session.user.id);
    } else {
      setIsAdmin(false);
      setDisplayName('');
    }
    setLoading(false);
  }, [supabase, fetchProfile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void fetchProfile(newSession.user.id);
      } else {
        setIsAdmin(false);
        setDisplayName('');
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Mode dev : on écoute la création/mise à jour de session (ex: checkout invité)
  // pour reconnecter l'utilisateur sans recharger la page.
  useEffect(() => {
    if (supabase) return;
    const onDevSession = () => {
      try {
        const raw = sessionStorage.getItem('eaumalik_dev_session');
        setDevUser(raw ? JSON.parse(raw) : null);
      } catch {
        setDevUser(null);
      }
    };
    window.addEventListener('eaumalik:dev-session-change', onDevSession);
    return () => window.removeEventListener('eaumalik:dev-session-change', onDevSession);
  }, [supabase]);

  // Mode dev (sans Supabase) : on lit la session factice ecrite par
  // /api/auth/dev-login (ou le checkout invité) dans sessionStorage.
  if (!supabase) {
    return (
      <AuthContext.Provider
        value={{
          user: devUser ? ({ id: devUser.id, email: devUser.email, user_metadata: { full_name: devUser.full_name } } as any) : null,
          session: devUser ? ({ user: { id: devUser.id, email: devUser.email } } as any) : null,
          loading: false,
          isAdmin: devUser?.role === 'admin',
          refresh: async () => {
            try {
              const raw = sessionStorage.getItem('eaumalik_dev_session');
              setDevUser(raw ? JSON.parse(raw) : null);
            } catch {
              setDevUser(null);
            }
          },
          async signOut() {
            try { sessionStorage.removeItem('eaumalik_dev_session'); } catch {}
            setDevUser(null);
            window.location.href = '/';
          },
          displayName: devUser?.full_name || devUser?.email || '',
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAdmin,
    refresh,
    async signOut() {
      await supabase.auth.signOut();
      // refresh() sera appelé par l'auth listener.
    },
    displayName,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  return ctx;
}

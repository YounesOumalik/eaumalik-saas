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
  // Mode dev (sans Supabase) : la session est lue depuis le cookie httpOnly
  // `eaumalik_dev_session` via l'endpoint /api/auth/dev-session (partagé entre
  // onglets et après refresh). On garde l'état pour pouvoir le mettre à jour
  // sans reload (événement custom + re-fetch).
  const [devUser, setDevUser] = useState<any>(null);

  const supabase = maybeSupabaseBrowserClient();

  const fetchProfile = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', uid)
      .single();
    // `isAdmin` couvre superadmin ET administrator (droits étendus).
    // Pour les opérations super-admin only (ex. supprimer superadmin), on
    // utilise `isSuperAdmin` calculé via role === 'admin'.
    const r = (data?.role as string) ?? '';
    setIsAdmin(r === 'admin' || r === 'administrator');
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

  // Mode dev : on lit la session depuis le cookie httpOnly via l'endpoint
  // /api/auth/dev-session (partagé entre onglets + survit au refresh). On
  // recharge aussi à chaque événement custom (login, checkout invité) émis
  // dans le même onglet.
  useEffect(() => {
    if (supabase) return;
    let cancelled = false;
    const loadDevSession = async () => {
      try {
        const res = await fetch('/api/auth/dev-session', { cache: 'no-store' });
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          setDevUser(json.user ?? null);
        } else {
          setDevUser(null);
        }
      } catch {
        if (!cancelled) setDevUser(null);
      }
    };
    void loadDevSession();
    const onDevSession = () => { void loadDevSession(); };
    window.addEventListener('eaumalik:dev-session-change', onDevSession);
    return () => {
      cancelled = true;
      window.removeEventListener('eaumalik:dev-session-change', onDevSession);
    };
  }, [supabase]);

  // la session factice est portée par le cookie
  // httpOnly `eaumalik_dev_session`, lue via /api/auth/dev-session.
  if (!supabase) {
    return (
      <AuthContext.Provider
        value={{
          user: devUser ? ({ id: devUser.id, email: devUser.email, user_metadata: { full_name: devUser.full_name } } as any) : null,
          session: devUser ? ({ user: { id: devUser.id, email: devUser.email } } as any) : null,
          loading,
          // Dev session : superadmin OU administrator = isAdmin (droits étendus).
          isAdmin: devUser?.role === 'admin' || devUser?.role === 'administrator',
          refresh: async () => {
            try {
              const res = await fetch('/api/auth/dev-session', { cache: 'no-store' });
              if (res.ok) {
                const json = await res.json();
                setDevUser(json.user ?? null);
              } else {
                setDevUser(null);
              }
            } catch {
              setDevUser(null);
            }
          },
          async signOut() {
            try {
              await fetch('/api/auth/dev-session', { method: 'DELETE' });
            } catch {
              /* noop */
            }
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

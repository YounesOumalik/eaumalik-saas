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

  // Si pas de client Supabase (env manquante), on ne casse rien : on rend sans auth.
  if (!supabase) {
    return (
      <AuthContext.Provider
        value={{
          user: null,
          session: null,
          loading: false,
          isAdmin: false,
          refresh: async () => {},
          signOut: async () => {},
          displayName: '',
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

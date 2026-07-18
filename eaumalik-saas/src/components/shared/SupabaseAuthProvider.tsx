'use client';

import { createContext, useContext, useEffect, useState, useMemo, ReactNode, useCallback } from 'react';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  /** Rôle métier réel (admin, administrator, client, technician, sales…).
   *  Alimenté par le fetch de profil au login, ou par la session dev. */
  role: string | null;
  /** Permissions effectives du profil (null si non chargé). */
  permissions: Record<string, boolean> | null;
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
  // Rôle métier + permissions effectives du profil, partagés avec toute la
  // sidebar (lib/adminNav) : source de vérité unique pour ne pas voir la
  // liste des pages clignoter au mount.
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const [displayName, setDisplayName] = useState('');

  // Mode dev (sans Supabase) : session factice écrite par /api/auth/dev-login
  // ou par le checkout invité, lue depuis sessionStorage. On la garde en état
  // pour pouvoir la mettre à jour sans reload (événement custom ci-dessous).
  // Mode dev (sans Supabase) : la session est lue depuis le cookie httpOnly
  // `eaumalik_dev_session` via l'endpoint /api/auth/dev-session (partagé entre
  // onglets et après refresh). On garde l'état pour pouvoir le mettre à jour
  // sans reload (événement custom + re-fetch).
  const [devUser, setDevUser] = useState<any>(null);

  // Keep one browser client for the lifetime of the provider. Creating a new
  // client on every render recreates the auth listener and refresh callbacks,
  // which can cause session flapping (and apparent automatic logouts).
  const supabase = useMemo(() => maybeSupabaseBrowserClient(), []);

  const fetchProfile = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('users')
      .select('role, permissions, full_name')
      .eq('id', uid)
      .single();
    // `isAdmin` couvre superadmin ET administrator (droits étendus).
    // Pour les opérations super-admin only (ex. supprimer superadmin), on
    // utilise `isSuperAdmin` calculé via role === 'admin'.
    const r = (data?.role as string) ?? '';
    setRole(r || null);
    setIsAdmin(r === 'admin' || r === 'administrator');
    setPermissions((data?.permissions as Record<string, boolean> | null) ?? null);
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
      setRole(null);
      setIsAdmin(false);
      setPermissions(null);
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
        setRole(null);
        setPermissions(null);
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
      } finally {
        if (!cancelled) setLoading(false);
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
          role: devUser?.role ?? null,
          permissions: devUser?.permissions ?? null,
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
            // 1) Mise à jour optimiste du state → l'UI passe immédiatement
            //    en "déconnecté" (Connexion au lieu de Déconnexion) sans
            //    attendre la fin du fetch ni un hard reload.
            setDevUser(null);
            setIsAdmin(false);
            setRole(null);
            setPermissions(null);
            setDisplayName('');
            // 2) Supprime le cookie httpOnly. L'événement doit être publié
            //    après cette requête, sinon le listener peut relire l'ancien
            //    cookie et restaurer la session juste après le clic.
            try {
              void fetch('/api/auth/dev-session', {
                method: 'DELETE',
                cache: 'no-store',
              })
                .catch(() => {})
                .then(() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('eaumalik:dev-session-change'));
                  }
                });
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
    role,
    permissions,
    refresh,
    async signOut() {
      // 1) Vidage OPTIMISTE du state React — instantané, sans dépendre du
      //    réseau. L'UI bascule immédiatement sur "Connexion" et tous les
      //    composants dépendants (Navbar, AdminShell) se re-rendent avec
      //    session=null avant même le 1er octet envoyé à Supabase.
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setRole(null);
      setPermissions(null);
      setDisplayName('');
      // 2) Purge locale du client Supabase (memory + localStorage + cookie
      //    SB) en fire-and-forget pour ne PAS bloquer la navigation. C'est
      //    synchrone côté Supabase v2 (clearSession) mais on l'isole pour
      //    garantir la réactivité de l'UI.
      try {
        if (typeof supabase.auth.signOut === 'function') {
          // signOut() retourne une Promise mais on ne l'attend pas pour
          // garantir la déconnexion côté UI : si le réseau rame, l'UI est
          // déjà passée en "déconnecté" et la requête réseau part en
          // arrière-plan. Si elle échoue, l'utilisateur reste déconnecté
          // côté client et la prochaine nav revérifiera côté serveur.
          void supabase.auth.signOut();
        }
      } catch {
        /* noop : on reste déconnecté côté UI */
      }
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

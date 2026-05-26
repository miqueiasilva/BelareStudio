import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';

export type AppUser = SupabaseUser & {
  papel?: string;
  nome?: string;
  avatar_url?: string;
  permissions?: any;
};

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const lastProcessedId = useRef<string | null>(null);
  const isMounted = useRef(true);

  const fetchProfile = React.useCallback(async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      const { data: profData } = await supabase
        .from('team_members')
        .select('access_level, role, photo_url, name, permissions')
        .eq('email', authUser.email)
        .maybeSingle();

      return {
        ...authUser,
        papel: (profData?.access_level || (authUser.email === 'mykeias@gmail.com' ? 'admin' : 'profissional')).toLowerCase(),
        nome: profData?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        avatar_url: profData?.photo_url || authUser.user_metadata?.avatar_url,
        permissions: profData?.permissions || {}
      };
    } catch (e) {
      return { 
        ...authUser, 
        papel: 'profissional', 
        nome: authUser.user_metadata?.full_name || 'Usuário' 
      };
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    // Safety timeout: force resolve initial loading in max 5 seconds under any network circumstance
    const safetyTimer = setTimeout(() => {
      if (isMounted.current && loading) {
        console.warn("[AUTH_DEBUG] Segurança de tempo limite acionada após 5s de carregamento inicial.");
        setLoading(false);
      }
    }, 5000);

    // Timeout helper for promises
    const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> => {
      let timeoutId: any;
      const timeoutPromise = new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`[AUTH_DEBUG] Operação de autenticação excedeu o tempo limite de ${ms}ms.`);
          resolve(fallbackValue);
        }, ms);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
    };

    // Check initial session
    const initSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        if (code) {
          console.log("[AUTH_DEBUG] Detectado código OAuth, trocando por sessão...");
          const { data, error } = await withTimeout(
            supabase.auth.exchangeCodeForSession(window.location.href),
            4000,
            { data: { session: null, user: null }, error: new Error('Exchange timeout') }
          );
          window.history.replaceState({}, '', '/');
          
          if (error) {
            console.error("[AUTH_DEBUG] Erro ao trocar código:", error);
            if (isMounted.current) setLoading(false);
            return;
          }
          
          if (data?.session?.user) {
            const appUser = await withTimeout(
              fetchProfile(data.session.user),
              2000,
              { ...data.session.user, papel: 'profissional', nome: 'Usuário' }
            );
            if (isMounted.current) {
              setUser(appUser);
              setLoading(false);
              return;
            }
          }
        }

        let session = null;
        let sessionError = null;
        try {
          const res = await withTimeout(
            supabase.auth.getSession(),
            3000, // 3 seconds timeout for Chrome dynamic SW hangs
            { data: { session: null }, error: new Error('Sessão expirou ou rede lenta') }
          );
          session = res.data?.session;
          sessionError = res.error;
        } catch (e: any) {
          console.error("[AUTH_DEBUG] Exceção ao obter sessão:", e);
          sessionError = e;
        }
        
        if (sessionError) {
          console.warn("[AUTH_DEBUG] Erro na sessão inicial:", sessionError.message || sessionError);
          const msg = String(sessionError.message || sessionError || "").toLowerCase();
          if (msg.includes("refresh_token_not_found") || 
              msg.includes("refresh token") ||
              msg.includes("invalid refresh token") ||
              msg.includes("invalid-refresh-token") ||
              msg.includes("invalid_grant") ||
              msg.includes("not found") ||
              msg.includes("sessão expirou")) {
            console.log("[AUTH_DEBUG] Sessão corrompida detectada, limpando de forma agressiva...");
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.warn("[AUTH_DEBUG] Erro ao dar signOut:", signOutErr);
            }
            try {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.includes('auth-token') || key.includes('sb-'))) {
                  localStorage.removeItem(key);
                }
              }
            } catch (e) {
              console.error("[AUTH_DEBUG] Erro ao limpar keys de auth do localStorage:", e);
            }
            try {
              localStorage.clear();
              sessionStorage.clear();
            } catch (e) {
              console.warn(e);
            }
            if (isMounted.current) {
              setUser(null);
            }
          }
        }

        if (session?.user) {
          const appUser = await withTimeout(
            fetchProfile(session.user),
            2000,
            { ...session.user, papel: 'profissional', nome: 'Usuário' }
          );
          if (isMounted.current) setUser(appUser);
        }
      } catch (err) {
        console.error("[AUTH_DEBUG] Erro na sessão inicial:", err);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log(`[AUTH_DEBUG] Evento de Autenticação: ${event}`);
      const currentId = currentSession?.user?.id || null;

      if (currentId === lastProcessedId.current && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED' && event !== 'INITIAL_SESSION') {
        setLoading(false);
        return;
      }

      lastProcessedId.current = currentId;

      if (!currentSession?.user) {
        if (isMounted.current) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const appUser = await fetchProfile(currentSession.user);
        if (isMounted.current) setUser(appUser);
      } catch (err) {
        console.error("[AUTH_DEBUG] Erro ao carregar perfil:", err);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    });

    return () => {
      isMounted.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, name: string) => {
    return supabase.auth.signUp({ 
      email, 
      password, 
      options: { data: { full_name: name } } 
    });
  };
  
  const signInWithGoogle = React.useCallback(async () => {
    const callbackUrl = `${window.location.origin}/`;
    console.log(`[AUTH_DEBUG] Iniciando Google OAuth com redirect para: ${callbackUrl}`);
    
    return supabase.auth.signInWithOAuth({ 
      provider: 'google', 
      options: { 
        redirectTo: callbackUrl,
        skipBrowserRedirect: false,
        flowType: 'pkce'
      } 
    });
  }, []);

  const resetPassword = async (email: string) => {
    return supabase.auth.resetPasswordForEmail(email, { 
      redirectTo: `${window.location.origin}/reset-password` 
    });
  };

  const updatePassword = async (newPassword: string) => {
    return supabase.auth.updateUser({ password: newPassword });
  };
  
  const signOut = async () => {
    try {
      lastProcessedId.current = null;
      await supabase.auth.signOut();
    } finally {
      localStorage.clear(); 
      sessionStorage.clear();
      setUser(null);
      setLoading(false);
      window.location.href = '/'; 
    }
  };

  const value = useMemo(() => ({ 
    user, loading, signIn, signUp, signInWithGoogle, resetPassword, updatePassword, signOut 
  }), [user, loading, signInWithGoogle]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

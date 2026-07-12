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
      const emailQuery = (authUser.email || '').trim();
      const queryPromise = supabase
        .from('team_members')
        .select('access_level, role, photo_url, name, permissions')
        .ilike('email', emailQuery)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => 
        setTimeout(() => reject(new Error("Timeout de 2.5 segundos na consulta ao banco")), 2500)
      );

      const { data: profData, error } = await Promise.race([queryPromise, timeoutPromise]);
      if (error) {
        console.warn("[AUTH_DEBUG] Erro ao buscar team_members:", error);
      }

      return {
        ...authUser,
        papel: (profData?.access_level || (authUser.email === 'mykeias@gmail.com' ? 'admin' : 'profissional')).toLowerCase(),
        nome: profData?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        avatar_url: profData?.photo_url || authUser.user_metadata?.avatar_url,
        permissions: profData?.permissions || {}
      };
    } catch (e) {
      console.warn("[AUTH_DEBUG] fetchProfile falhou ou excedeu o limite de tempo, aplicando fallback de emergência:", e);
      return { 
        ...authUser, 
        papel: (authUser.email === 'mykeias@gmail.com' ? 'admin' : 'profissional').toLowerCase(), 
        nome: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
        permissions: {}
      };
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    // Safety timeout: force resolve initial loading in max 7 seconds under any network circumstance
    const safetyTimer = setTimeout(() => {
      if (isMounted.current) {
        setLoading((prev) => {
          if (prev) {
            console.warn("[AUTH_DEBUG] Segurança de tempo limite acionada após 7s de carregamento inicial.");
          }
          return false;
        });
      }
    }, 7000);

    // Check initial session
    const initSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        if (code) {
          console.log("[AUTH_DEBUG] Detectado código OAuth, trocando por sessão...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          
          const isRecovery = 
            window.location.pathname.toLowerCase().startsWith('/reset-password') || 
            window.location.search.toLowerCase().includes('type=recovery') ||
            window.location.hash.toLowerCase().includes('type=recovery');

          if (isRecovery) {
            window.history.replaceState({}, '', '/reset-password');
            window.dispatchEvent(new Event('popstate'));
          } else {
            window.history.replaceState({}, '', '/');
            window.dispatchEvent(new Event('popstate'));
          }
          
          if (error) {
            console.error("[AUTH_DEBUG] Erro ao trocar código:", error);
            if (isMounted.current) setLoading(false);
            return;
          }
          
          if (data?.session?.user) {
            const appUser = await fetchProfile(data.session.user);
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
          const res = await supabase.auth.getSession();
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
              msg.includes("invalid_grant")) {
            console.log("[AUTH_DEBUG] Sessão corrompida detectada, limpando de forma agressiva...");
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.warn("[AUTH_DEBUG] Erro ao dar signOut:", signOutErr);
            }
            try {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.includes('auth-token') || key.includes('sb-') || key.includes('supabase.auth.'))) {
                  localStorage.removeItem(key);
                }
              }
            } catch (e) {
              console.error("[AUTH_DEBUG] Erro ao limpar keys de auth do localStorage:", e);
            }
            try {
              for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const key = sessionStorage.key(i);
                if (key && (key.includes('auth-token') || key.includes('sb-') || key.includes('supabase.auth.'))) {
                  sessionStorage.removeItem(key);
                }
              }
            } catch (e) {
              console.error("[AUTH_DEBUG] Erro ao limpar keys de auth do sessionStorage:", e);
            }
            if (isMounted.current) {
              setUser(null);
            }
          }
        }

        if (session?.user) {
          const appUser = await fetchProfile(session.user);
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
      
      const hasRecoveryToken = 
        window.location.hash.toLowerCase().includes('type=recovery') || 
        window.location.search.toLowerCase().includes('type=recovery');

      if (
        event === 'PASSWORD_RECOVERY' || 
        (currentSession && hasRecoveryToken)
      ) {
        console.log("[AUTH_DEBUG] Fluxo de recuperação de senha detectado e validado! Alterando rota sem limpar sessão.");
        if (window.location.pathname !== '/reset-password') {
          window.history.replaceState({}, '', '/reset-password');
          window.dispatchEvent(new Event('popstate'));
        }
      }

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
      try {
        localStorage.clear(); 
      } catch (e) {
        console.warn("[AuthContext] Failed to clear localStorage on sign out:", e);
      }
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn("[AuthContext] Failed to clear sessionStorage on sign out:", e);
      }
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

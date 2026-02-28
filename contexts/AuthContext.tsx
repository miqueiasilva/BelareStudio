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
        .select('role, photo_url, name')
        .eq('email', authUser.email)
        .maybeSingle();

      return {
        ...authUser,
        papel: profData?.role?.toLowerCase() || 'profissional',
        nome: profData?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        avatar_url: profData?.photo_url || authUser.user_metadata?.avatar_url
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

    // Check initial session
    const initSession = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('code')) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
          window.history.replaceState({}, '', '/');
        }

        const { data: { session } } = await supabase.auth.getSession();
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
  
  const signInWithGoogle = async () => {
    const callbackUrl = window.location.origin;
    console.log(`[AUTH_DEBUG] Iniciando Google OAuth com redirect para: ${callbackUrl}`);
    
    return supabase.auth.signInWithOAuth({ 
      provider: 'google', 
      options: { 
        redirectTo: callbackUrl
      } 
    });
  };

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
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

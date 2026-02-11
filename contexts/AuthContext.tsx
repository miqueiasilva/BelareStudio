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
  const isMounted = useRef(true);
  const initialized = useRef(false);

  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    console.log("[AUTH_DEBUG] Buscando perfil para:", authUser.email);
    try {
      // Timeout de 3 segundos para a busca do perfil para não travar o login
      const profilePromise = supabase
        .from('team_members')
        .select('role, photo_url, name')
        .eq('email', authUser.email)
        .maybeSingle();

      const { data: profData, error } = await Promise.race([
        profilePromise,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout perfil")), 4000))
      ]);

      if (error) console.warn("[AUTH] Erro ao buscar perfil (ignorado):", error);

      return {
        ...authUser,
        papel: profData?.role?.toLowerCase() || 'profissional',
        nome: profData?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        avatar_url: profData?.photo_url || authUser.user_metadata?.avatar_url
      };
    } catch (e) {
      console.error("[AUTH] Falha crítica ao buscar perfil:", e);
      return { 
        ...authUser, 
        papel: 'profissional', 
        nome: authUser.user_metadata?.full_name || 'Usuário' 
      };
    }
  };

  const resolveUser = async (sessionUser: SupabaseUser | null) => {
    if (!sessionUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const appUser = await fetchProfile(sessionUser);
      if (isMounted.current) {
        setUser(appUser);
        setLoading(false);
      }
    } catch (err) {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    
    // Failsafe: se em 7 segundos ainda estiver carregando, libera a tela
    const safetyTimer = setTimeout(() => {
      if (loading && isMounted.current) {
        console.warn("[AUTH_DEBUG] Loading forçado para false por timeout de segurança.");
        setLoading(false);
      }
    }, 7000);

    // Inicialização
    const init = async () => {
      console.log("[AUTH_DEBUG] Iniciando getSession...");
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await resolveUser(session.user);
      } else {
        setLoading(false);
      }
      initialized.current = true;
    };

    init();

    // Listener de mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AUTH_DEBUG] Evento Supabase: ${event}`);
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (session?.user) {
        await resolveUser(session.user);
      } else if (event === 'INITIAL_SESSION' && !session) {
        setLoading(false);
      }
    });

    return () => {
      isMounted.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);
    return supabase.auth.signUp({ 
      email, 
      password, 
      options: { data: { full_name: name } } 
    });
  };
  
  const signInWithGoogle = async () => {
    const callbackUrl = window.location.origin;
    return supabase.auth.signInWithOAuth({ 
      provider: 'google', 
      options: { redirectTo: callbackUrl } 
    });
  };

  const resetPassword = async (email: string) => {
    return supabase.auth.resetPasswordForEmail(email, { 
      redirectTo: `${window.location.origin}/#/reset-password` 
    });
  };

  const updatePassword = async (newPassword: string) => {
    return supabase.auth.updateUser({ password: newPassword });
  };
  
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      localStorage.clear(); 
      sessionStorage.clear();
      setUser(null);
      setLoading(false);
      window.location.hash = '';
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

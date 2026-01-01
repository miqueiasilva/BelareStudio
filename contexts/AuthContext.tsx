
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

  // Busca perfil unificado (Melhoria progressiva)
  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      const { data: profData } = await supabase
        .from('professionals')
        .select('role, photo_url, permissions, name')
        .eq('email', authUser.email)
        .maybeSingle();

      if (profData) {
        return {
          ...authUser,
          papel: profData.role?.toLowerCase() || 'profissional',
          nome: profData.name || authUser.user_metadata?.full_name,
          avatar_url: profData.photo_url || authUser.user_metadata?.avatar_url,
          permissions: profData.permissions
        };
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, papel, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();

      return {
        ...authUser,
        papel: profileData?.papel || 'profissional',
        nome: profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        avatar_url: profileData?.avatar_url || authUser.user_metadata?.avatar_url
      };
    } catch (e) {
      return { 
        ...authUser, 
        papel: 'profissional', 
        nome: authUser.user_metadata?.full_name || 'Usuário' 
      };
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. TIMEOUT DE SEGURANÇA (O Disjuntor Original)
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("AuthContext: Boot demorado detectado. Forçando carregamento da UI.");
        setLoading(false);
      }
    }, 3000);

    // 2. FUNÇÃO DE INICIALIZAÇÃO DE SESSÃO
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session?.user && mounted) {
          const appUser = await fetchProfile(session.user);
          setUser(appUser);
        }
      } catch (err) {
        console.error("AuthContext: Erro ao recuperar sessão inicial:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(safetyTimeout);
        }
      }
    };

    initializeAuth();

    // 3. LISTENER DE MUDANÇAS (Silent Updates)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log("AuthContext: Evento detectado ->", event);

      // SIGNED_IN ou INITIAL_SESSION: Bloqueia apenas se não tivermos usuário
      if (event === 'SIGNED_IN') {
        if (session?.user) {
          const appUser = await fetchProfile(session.user);
          setUser(appUser);
        }
        setLoading(false);
      }

      // TOKEN_REFRESHED ou USER_UPDATED: Atualiza dados SILENCIOSAMENTE em background
      else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          const appUser = await fetchProfile(session.user);
          setUser(appUser);
        }
        // Jamais chame setLoading(true) aqui! Apenas garante que está false.
        setLoading(false); 
      }

      // SIGNED_OUT: Limpa estado e libera UI
      else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    // 4. DISJUNTOR DE VISIBILIDADE (Anti-Travamento de Aba)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && loading) {
        console.log("AuthContext: Aba retomou foco. Destravando loading residual...");
        setTimeout(() => {
          if (mounted) setLoading(false);
        }, 500);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const signIn = async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
  const signUp = async (email: string, password: string, name: string) => supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
  const signInWithGoogle = async () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
  const resetPassword = async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  const updatePassword = async (newPassword: string) => supabase.auth.updateUser({ password: newPassword });
  
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.error("AuthContext: Falha ao sair:", error);
    } finally {
      setUser(null);
      localStorage.clear();
      setLoading(false);
      window.location.href = '/'; 
    }
  };

  const value = useMemo(() => ({ 
    user, 
    loading, 
    signIn, 
    signUp, 
    signInWithGoogle, 
    resetPassword, 
    updatePassword, 
    signOut 
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

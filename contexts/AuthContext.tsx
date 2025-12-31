
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

  // Busca perfil unificado (Auth + Professionals)
  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      // Prioridade 1: Buscar na tabela de profissionais (onde reside o Role operacional)
      const { data: profData } = await supabase
        .from('professionals')
        .select('role, photo_url, permissions, name')
        .eq('email', authUser.email) // Link via e-mail ou auth_user_id se existir
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

      // Prioridade 2: Fallback para perfis genéricos (Profiles)
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
      console.warn("AuthContext: Erro ao buscar perfil extendido.");
      return { 
        ...authUser, 
        papel: 'profissional', 
        nome: authUser.user_metadata?.full_name || 'Usuário' 
      };
    }
  };

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      setLoading(true);
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          if (error.message.toLowerCase().includes('refresh_token')) {
            await supabase.auth.signOut();
            if (mounted) setUser(null);
          }
          return;
        }

        if (session?.user && mounted) {
          const appUser = await fetchProfile(session.user);
          setUser(appUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const appUser = await fetchProfile(session.user);
        if (mounted) setUser(appUser);
      } else {
        if (mounted) setUser(null);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
  const signUp = async (email: string, password: string, name: string) => supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
  const signInWithGoogle = async () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
  const resetPassword = async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  const updatePassword = async (newPassword: string) => supabase.auth.updateUser({ password: newPassword });
  
  /**
   * LOGOUT FAIL-SAFE
   * Implementação robusta que garante a saída do usuário independente da resposta do servidor.
   */
  const signOut = async () => {
    try {
      setLoading(true);
      // Tentativa de encerramento de sessão no servidor
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      // Silenciamos o erro para o usuário não travar em uma tela de erro durante a saída
      console.error("AuthContext: Erro ao desconectar do servidor:", error);
    } finally {
      // LIMPEZA LOCAL OBRIGATÓRIA (Mesmo se a rede falhar)
      setUser(null);
      
      // Limpeza nuclear de persistência local
      localStorage.clear();
      sessionStorage.clear();
      
      setLoading(false);
      
      // Redirecionamento forçado para a raiz
      // Em um SPA com controle de estado como este, o root sem 'user' disparará o LoginView.
      window.location.href = '/'; 
    }
  };

  const value = useMemo(() => ({ user, loading, signIn, signUp, signInWithGoogle, resetPassword, updatePassword, signOut }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

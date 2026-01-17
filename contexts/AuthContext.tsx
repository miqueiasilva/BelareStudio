
import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

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
  
  // Refs para controle de estabilidade (Protocolo de Estabilidade)
  const lastProcessedId = useRef<string | null>(null);
  const isMounted = useRef(true);

  // Helper para buscar perfil detalhado
  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      const { data: profData, error: profErr } = await supabase
        .from('professionals')
        .select('role, photo_url, permissions, name')
        .eq('email', authUser.email)
        .maybeSingle();

      if (profErr) throw profErr;

      if (profData) {
        return {
          ...authUser,
          papel: profData.role?.toLowerCase() || 'profissional',
          nome: profData.name || authUser.user_metadata?.full_name,
          avatar_url: profData.photo_url || authUser.user_metadata?.avatar_url,
          permissions: profData.permissions
        };
      }

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('full_name, papel, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();
      
      if (profileErr) throw profileErr;

      return {
        ...authUser,
        papel: profileData?.papel || 'profissional',
        nome: profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        avatar_url: profileData?.avatar_url || authUser.user_metadata?.avatar_url
      };
    } catch (e) {
      console.error("AuthContext: Erro ao buscar dados estendidos, usando fallback básico.");
      return { 
        ...authUser, 
        papel: 'profissional', 
        nome: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário' 
      };
    }
  };

  useEffect(() => {
    isMounted.current = true;

    // Listener Único para todo o ciclo de vida da Autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      const currentId = currentSession?.user?.id || null;

      // Estabilidade: Evita processar o mesmo ID múltiplas vezes (Corrige o loop de 4 disparos)
      if (currentId === lastProcessedId.current && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED' && event !== 'PASSWORD_RECOVERY') {
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
        setLoading(true);
        const appUser = await fetchProfile(currentSession.user);
        if (isMounted.current) {
          setUser(appUser);
        }
      } catch (err) {
        console.error("AuthContext: Erro crítico ao carregar perfil:", err);
        if (isMounted.current) {
            setUser(null);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    });

    // Safety Timeout para evitar travamento da UI em falhas de rede severas
    const safetyTimer = setTimeout(() => {
      if (isMounted.current && loading) {
        console.warn("AuthContext: Safety timeout atingido. Liberando UI.");
        setLoading(false);
      }
    }, 5000);

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  const signIn = async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
  const signUp = async (email: string, password: string, name: string) => supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
  const signInWithGoogle = async () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
  const resetPassword = async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  const updatePassword = async (newPassword: string) => supabase.auth.updateUser({ password: newPassword });
  
  const signOut = async () => {
    try {
      lastProcessedId.current = null;
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Erro durante signOut:", e);
    } finally {
      localStorage.clear(); 
      sessionStorage.clear();
      if (isMounted.current) {
        setUser(null);
        setLoading(false);
      }
      // Garante redirecionamento limpo
      window.location.href = window.location.origin + '/login'; 
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

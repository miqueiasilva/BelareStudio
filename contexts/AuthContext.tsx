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

  // Fonte única de verdade: Papel do usuário
  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      console.log(`[AUTH] Resolvendo perfil para: ${authUser.email}`);
      
      // 1. Tenta buscar papel na tabela oficial de membros/equipe
      const { data: profData, error } = await supabase
        .from('team_members')
        .select('role, photo_url, name')
        .eq('email', authUser.email)
        .maybeSingle();

      if (error) throw error;

      // 2. Determina o papel final com prioridade:
      // Meta do Auth (Admin se definido no cadastro) > Tabela Equipe > Fallback
      let finalRole = (authUser.app_metadata?.role || authUser.user_metadata?.role || profData?.role || 'profissional').toLowerCase();
      
      // Proteção: Se for o dono da conta (primeiro admin), garante o papel
      if (authUser.email === 'admin@belarestudio.com' || authUser.email?.includes('jaciene')) {
        finalRole = 'admin';
      }

      console.log(`[AUTH] Identidade resolvida: ${finalRole}`);

      return {
        ...authUser,
        papel: finalRole,
        nome: profData?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        avatar_url: profData?.photo_url || authUser.user_metadata?.avatar_url
      };
    } catch (e: any) {
      console.error("[AUTH] Erro ao carregar perfil, usando metadados:", e.message);
      return { 
        ...authUser, 
        papel: authUser.user_metadata?.role || 'profissional', 
        nome: authUser.user_metadata?.full_name || 'Usuário' 
      };
    }
  };

  const resolveUser = async (sessionUser: SupabaseUser | null) => {
    if (!sessionUser) {
      if (isMounted.current) {
        setUser(null);
        setLoading(false);
      }
      return;
    }

    const appUser = await fetchProfile(sessionUser);
    if (isMounted.current) {
      setUser(appUser);
      setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await resolveUser(session?.user || null);
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AUTH] Evento: ${event}`);
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else if (session?.user) {
        await resolveUser(session.user);
      }
    });

    return () => {
      isMounted.current = false;
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
      options: { data: { full_name: name, role: 'profissional' } } 
    });
  };
  
  const signInWithGoogle = async () => {
    return supabase.auth.signInWithOAuth({ 
      provider: 'google', 
      options: { redirectTo: window.location.origin } 
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
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = '/';
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
}

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

  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      const { data: profData, error } = await supabase
        .from('team_members')
        .select('role, photo_url, name, permissions')
        .eq('email', authUser.email)
        .maybeSingle();

      if (error) console.error("Erro ao buscar perfil complementar:", error);

      return {
        ...authUser,
        papel: profData?.role?.toLowerCase() || 'profissional',
        nome: profData?.name || authUser.user_metadata?.full_name || 'Usuário',
        avatar_url: profData?.photo_url || authUser.user_metadata?.avatar_url,
        permissions: profData?.permissions
      };
    } catch (e) {
      return { ...authUser, papel: 'profissional' };
    }
  };

  useEffect(() => {
    isMounted.current = true;

    const initAuth = async () => {
      try {
        // HARD-STOP: Aguarda a sessão real sem timeouts artificiais
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted.current) {
          const detailedUser = await fetchProfile(session.user);
          setUser(detailedUser);
        }
      } catch (e) {
        console.error("Erro crítico na inicialização de Auth:", e);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(true);
        const detailedUser = await fetchProfile(session.user);
        if (isMounted.current) {
          setUser(detailedUser);
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
  const signUp = async (email: string, password: string, name: string) => supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
  const signInWithGoogle = async () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  const resetPassword = async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  const updatePassword = async (newPassword: string) => supabase.auth.updateUser({ password: newPassword });
  
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      localStorage.clear();
      setUser(null);
      setLoading(false);
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

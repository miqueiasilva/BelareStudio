
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

  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      const { data: profData, error: profError } = await supabase
        .from('team_members')
        .select('role, photo_url, permissions, name')
        .eq('email', authUser.email)
        .maybeSingle();

      if (profError) console.warn("Erro ao buscar perfil complementar:", profError.message);

      if (profData) {
        return {
          ...authUser,
          papel: profData.role?.toLowerCase() || 'profissional',
          nome: profData.name || authUser.user_metadata?.full_name,
          avatar_url: profData.photo_url || authUser.user_metadata?.avatar_url,
          permissions: profData.permissions
        };
      }

      return {
        ...authUser,
        papel: 'profissional',
        nome: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        avatar_url: authUser.user_metadata?.avatar_url
      };
    } catch (e) {
      return { ...authUser, papel: 'profissional' };
    }
  };

  useEffect(() => {
    isMounted.current = true;

    // Supabase Auth Listener com tratamento de erro de relógio (Future Session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      try {
        const currentId = currentSession?.user?.id || null;

        if (currentId === lastProcessedId.current && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') {
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

        const appUser = await fetchProfile(currentSession.user);
        if (isMounted.current) setUser(appUser);

      } catch (err: any) {
        // Se o erro for de clock skew ("issued in the future"), o SDK tentará revalidar depois.
        // Liberamos a UI para não ficar em loop infinito.
        console.error("Auth Exception:", err.message);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    });

    const safetyTimer = setTimeout(() => {
      if (isMounted.current && loading) setLoading(false);
    }, 4000);

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
    lastProcessedId.current = null;
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };

  const value = useMemo(() => ({ user, loading, signIn, signUp, signInWithGoogle, resetPassword, updatePassword, signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

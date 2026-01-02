
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  const [session, setSession] = useState<Session | null>(null);

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

    const initializeAuth = async () => {
      try {
        const storageKey = Object.keys(localStorage).find(k => k.includes('-auth-token'));
        if (!storageKey || !localStorage.getItem(storageKey)) {
          if (mounted) setLoading(false);
        }

        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (initialSession?.user && mounted) {
          setSession(initialSession);
          const appUser = await fetchProfile(initialSession.user);
          if (mounted) setUser(appUser);
        }
      } catch (err) {
        console.error("AuthContext: Erro no boot inicial:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (currentSession?.user) {
          setSession(currentSession);
          const appUser = await fetchProfile(currentSession.user);
          if (mounted) setUser(appUser);
        }
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (currentSession?.user) {
          setSession(currentSession);
          const appUser = await fetchProfile(currentSession.user);
          if (mounted) setUser(appUser);
        }
        setLoading(false);
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && loading) {
        setTimeout(() => {
          if (mounted && loading) setLoading(false);
        }, 800);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loading]);

  const signIn = async (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
  const signUp = async (email: string, password: string, name: string) => supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
  const signInWithGoogle = async () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
  const resetPassword = async (email: string) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
  const updatePassword = async (newPassword: string) => supabase.auth.updateUser({ password: newPassword });
  
  const signOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("Erro ao sair (ignorado):", error);
    } finally {
      // Limpeza forçada
      localStorage.clear();
      sessionStorage.clear();
      setUser(null);
      setSession(null);
      setLoading(false); // Destrava a tela
      window.location.href = '/login'; // Hard Reload conforme solicitado
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

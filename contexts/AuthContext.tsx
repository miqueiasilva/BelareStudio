
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

  // Fix: Session issued in the future - Limpeza de Hash da URL
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      window.history.replaceState(
        null,
        document.title,
        window.location.pathname + window.location.search
      );
    }
  }, []);

  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      const { data: profData, error: profError } = await supabase
        .from('team_members')
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      try {
        const currentId = currentSession?.user?.id || null;
        if (currentId === lastProcessedId.current && event !== 'SIGNED_OUT') {
          setLoading(false);
          return;
        }
        lastProcessedId.current = currentId;

        if (!currentSession?.user) {
          setUser(null);
          setLoading(false);
          return;
        }

        const appUser = await fetchProfile(currentSession.user);
        setUser(appUser);
      } catch (err: any) {
        console.error("Auth Listener Error (Clock Skew?):", err.message);
      } finally {
        setLoading(false);
      }
    });

    // Safety Timeout para evitar UI travada caso o Supabase falhe em responder
    const timer = setTimeout(() => setLoading(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
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
    setUser(null);
    window.location.href = '/';
  };

  const value = useMemo(() => ({ user, loading, signIn, signUp, signInWithGoogle, resetPassword, updatePassword, signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

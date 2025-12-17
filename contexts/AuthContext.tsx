
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';

// Extended User type to include role/papel
export type AppUser = SupabaseUser & {
  papel?: string;
  nome?: string;
  avatar_url?: string;
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

  // Helper to fetch extra profile data from 'public.profiles'
  // Designed to NOT crash if the table doesn't exist yet
  const fetchProfile = async (authUser: SupabaseUser): Promise<AppUser> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, papel, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle(); // Use maybeSingle to avoid errors if 0 rows

      if (error || !data) {
        // Fallback: Use metadata if profile table row is missing
        return {
            ...authUser,
            papel: 'admin', // Default role for first user/fallback
            nome: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
            avatar_url: authUser.user_metadata?.avatar_url
        };
      }

      return {
        ...authUser,
        papel: data.papel || 'profissional',
        nome: data.full_name || authUser.user_metadata?.full_name,
        avatar_url: data.avatar_url || authUser.user_metadata?.avatar_url
      };
    } catch (e) {
      // Ultimate fallback
      return { ...authUser, papel: 'admin', nome: 'Usuário' };
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Check active session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const appUser = await fetchProfile(session.user);
          setUser(appUser);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    getInitialSession();

    // 2. Listen for auth changes
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

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, name: string) => {
    return await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            data: { full_name: name } // This metadata triggers the profile creation in SQL if configured
        }
    });
  };

  const signInWithGoogle = async () => {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      },
    });
  };

  const resetPassword = async (email: string) => {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  };

  const updatePassword = async (newPassword: string) => {
    return await supabase.auth.updateUser({ password: newPassword });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    signOut,
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};


import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
    user: User | null;
    signIn: (email: string, pass: string) => Promise<{ error: string | null }>;
    signInWithGoogle: () => Promise<{ error: string | null }>;
    signOut: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session on load
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    mapSupabaseUserToAppUser(session.user);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error checking session:", error);
                setLoading(false);
            }
        };

        checkSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                mapSupabaseUserToAppUser(session.user);
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const mapSupabaseUserToAppUser = (supaUser: any) => {
        // In a real production app, we would fetch the 'role' from a 'profiles' table.
        // For now, we default to 'admin' to ensure access to the dashboard features.
        // We also check user_metadata for stored names/avatars.
        const appUser: User = {
            id: supaUser.id,
            nome: supaUser.user_metadata?.full_name || supaUser.email?.split('@')[0] || 'Usuário',
            email: supaUser.email || '',
            papel: (supaUser.user_metadata?.role as UserRole) || 'admin', 
            avatar_url: supaUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${supaUser.email}`,
            ativo: true
        };
        setUser(appUser);
        setLoading(false);
    };

    const signIn = async (email: string, pass: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: pass,
            });

            if (error) {
                setLoading(false);
                return { error: 'E-mail ou senha incorretos.' }; // Generic message or error.message
            }

            // State update handled by onAuthStateChange
            return { error: null };
        } catch (err) {
            setLoading(false);
            return { error: 'Ocorreu um erro ao tentar fazer login.' };
        }
    };

    const signInWithGoogle = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });

            if (error) throw error;
            return { error: null };
        } catch (err) {
            setLoading(false);
            return { error: 'Erro ao conectar com Google.' };
        }
    };

    const signOut = async () => {
        setLoading(true);
        await supabase.auth.signOut();
        // State update handled by onAuthStateChange
    };

    return (
        <AuthContext.Provider value={{ user, signIn, signInWithGoogle, signOut, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

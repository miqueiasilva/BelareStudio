
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

// Mock User Data for Demo
const MOCK_USER: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    nome: 'Jacilene Felix',
    email: 'admin@bela.com',
    papel: 'admin',
    avatar_url: 'https://i.pravatar.cc/150?img=5',
    ativo: true
};

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
        // Check local storage for session persistence simulation
        const storedUser = localStorage.getItem('belaapp_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const signIn = async (email: string, pass: string) => {
        setLoading(true);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // MOCK AUTHENTICATION LOGIC
        // In the future, this will be: const { data, error } = await supabase.auth.signInWithPassword(...)
        if (email === 'admin@bela.com' && pass === '123123') {
            setUser(MOCK_USER);
            localStorage.setItem('belaapp_user', JSON.stringify(MOCK_USER));
            setLoading(false);
            return { error: null };
        } else {
            setLoading(false);
            return { error: 'E-mail ou senha incorretos.' };
        }
    };

    const signInWithGoogle = async () => {
        setLoading(true);
        // Simulate Popup/Redirect delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock Google User
        const googleUser: User = {
            ...MOCK_USER,
            nome: 'Jacilene (Google)',
            email: 'jacilene@gmail.com',
            avatar_url: 'https://lh3.googleusercontent.com/a-/AOh14Gg', // Placeholder
        };

        setUser(googleUser);
        localStorage.setItem('belaapp_user', JSON.stringify(googleUser));
        setLoading(false);
        return { error: null };
    };

    const signOut = () => {
        setUser(null);
        localStorage.removeItem('belaapp_user');
    };

    return (
        <AuthContext.Provider value={{ user, signIn, signInWithGoogle, signOut, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

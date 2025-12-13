import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURAÇÃO DO SUPABASE
// ------------------------------------------------------------------
// Para que o sistema funcione, você precisa pegar essas chaves no seu painel do Supabase:
// 1. Vá em Settings (Ícone de engrenagem) > API
// 2. Copie "Project URL" e cole em SUPABASE_URL
// 3. Copie "anon" "public" key e cole em SUPABASE_ANON_KEY
// ------------------------------------------------------------------

// Estas chaves devem ser substituídas pelas variáveis de ambiente em produção
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://rxtwmwrgcilmsldtqdfe.supabase.co'; 
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x';

let client;
let isDemoMode = false;

// Helper to create a dummy client that won't crash the app
const createDummyClient = () => ({
    auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }), 
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ data: null, error: { message: "Modo Demo: Use o login de teste." } }),
        signUp: async () => ({ data: null, error: { message: "Cadastro desativado no modo Demo." } }),
        resetPasswordForEmail: async () => ({ data: null, error: { message: "Recuperação desativada no modo Demo." } }),
        signInWithOAuth: async () => ({ data: null, error: { message: "Login social desativado no modo Demo." } }),
        signOut: async () => {},
    },
    from: () => ({ select: async () => ({ error: { code: 'NOT_CONFIGURED' } }) })
} as any);

try {
    // Check if keys are present AND look like valid Supabase keys (anon keys usually start with eyJ)
    const isValidKey = SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.startsWith('eyJ');

    if (SUPABASE_URL && isValidKey) {
        client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn("Supabase credentials missing or invalid. App running in DEMO mode.");
        client = createDummyClient();
        isDemoMode = true;
    }
} catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    client = createDummyClient();
    isDemoMode = true;
}

export const supabase = client;

// Função auxiliar para testar conexão
export const testConnection = async () => {
    // Se estiver explicitamente em modo demo, retorna false imediatamente
    if (isDemoMode) {
        return false;
    }

    try {
        // Tenta verificar a sessão (operação leve)
        const sessionCheck = await supabase.auth.getSession();
        
        // Se a chamada de sessão funcionou (mesmo sem usuário), a conexão existe
        return true; 
    } catch (e) {
        console.error("Supabase Connection Exception:", e);
        return false;
    }
};
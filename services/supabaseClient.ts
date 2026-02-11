import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * [AUTH_DEBUG] Diagnóstico de inicialização
 */
const origin = typeof window !== 'undefined' ? window.location.origin : 'SSR';

// Valores de fallback (Segurança para desenvolvimento local)
const FALLBACK_URL = "https://rxtwmwrgcilmsldtqdfe.supabase.co";
const FALLBACK_KEY = "sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x";

/**
 * No Vite, import.meta.env.CHAVE é substituído estaticamente no build.
 * Esta função tenta pegar os valores das diversas formas possíveis com segurança.
 */
const getEnv = (key: string): string | null => {
  // 1. Tenta acesso direto com proteção contra undefined (forma padrão do Vite)
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const env = (import.meta as any).env;
      if (key === 'VITE_SUPABASE_URL' && env.VITE_SUPABASE_URL) return env.VITE_SUPABASE_URL;
      if (key === 'VITE_SUPABASE_ANON_KEY' && env.VITE_SUPABASE_ANON_KEY) return env.VITE_SUPABASE_ANON_KEY;
    }
  } catch (e) {
    console.warn(`[AUTH_DEBUG] Falha ao ler import.meta.env.${key}:`, e);
  }

  // 2. Tenta LocalStorage (para o EnvGate)
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return stored;
    } catch (e) {}
  }

  return null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || FALLBACK_URL;
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || FALLBACK_KEY;

console.log(`[AUTH_DEBUG] Supabase URL: ${supabaseUrl.substring(0, 20)}...`);

// Inicialização do cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
}) as unknown as SupabaseClient;

/**
 * O sistema é considerado configurado se as variáveis VITE_ estão presentes no bundle
 * ou se o usuário salvou manualmente no localStorage.
 */
export const isConfigured = !!(
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_SUPABASE_URL) || 
  (typeof window !== 'undefined' && localStorage.getItem('VITE_SUPABASE_URL'))
);

export const saveSupabaseConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('VITE_SUPABASE_URL', url);
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', key);
    window.location.reload();
  }
};

if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * [AUTH_DEBUG] Diagnóstico de inicialização
 */
const origin = typeof window !== 'undefined' ? window.location.origin : 'SSR';
console.log(`[AUTH_DEBUG] Origin: ${origin}`);

// Valores padrão do projeto (Hardcoded fallbacks)
const DEFAULT_URL = "https://rxtwmwrgcilmsldtqdfe.supabase.co";
const DEFAULT_KEY = "sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x";

// Função auxiliar para resolver as chaves (Vite env -> LocalStorage -> Default)
const getEnv = (key: string, fallback: string): string => {
  // 1. Tenta variáveis de ambiente do Vite (import.meta.env) de forma segura
  try {
    // @ts-expect-error - import.meta.env is not defined in all environments
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-expect-error - import.meta.env is not defined in all environments
      return import.meta.env[key];
    }
  } catch (e) {
    // Silently ignore
  }

  // 2. Tenta process.env (fallback para outros ambientes)
  try {
    // @ts-expect-error - process.env is not defined in all environments
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-expect-error - process.env is not defined in all environments
      return process.env[key];
    }
  } catch (e) {
    // Silently ignore
  }

  // 3. Tenta LocalStorage (necessário para o funcionamento do EnvGate)
  if (typeof window !== 'undefined') {
    try {
      const localVal = localStorage.getItem(key);
      if (localVal) return localVal;
    } catch (e) {
      // Silently ignore
    }
  }

  return fallback;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL', DEFAULT_URL);
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', DEFAULT_KEY);

console.log(`[AUTH_DEBUG] VITE_SUPABASE_URL: ${supabaseUrl === DEFAULT_URL ? 'utilizando fallback' : 'presente'}`);
console.log(`[AUTH_DEBUG] VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey === DEFAULT_KEY ? 'utilizando fallback' : 'presente'}`);

// Inicialização segura do cliente para evitar "supabaseUrl is required"
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
}) as unknown as SupabaseClient;

// Helpers para o EnvGate.tsx
// Consideramos configurado se houver algo diferente do fallback básico ou se o fallback for o esperado
export const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseAnonKey.length > 10);

export const saveSupabaseConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('VITE_SUPABASE_URL', url);
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', key);
    window.location.reload();
  }
};

// Injeta no window para debug rápido no console se necessário
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

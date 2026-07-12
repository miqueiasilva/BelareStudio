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

export const supabaseUrl = getEnv('VITE_SUPABASE_URL', DEFAULT_URL);
export const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', DEFAULT_KEY);

console.log(`[AUTH_DEBUG] VITE_SUPABASE_URL: ${supabaseUrl === DEFAULT_URL ? 'utilizando fallback' : 'presente'}`);
console.log(`[AUTH_DEBUG] VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey === DEFAULT_KEY ? 'utilizando fallback' : 'presente'}`);

// Detecta se localStorage está disponível para uso sem lançar exceções (ex: em iframes restritos ou bloqueio de cookies de terceiros)
let isLocalStorageAvailable = false;
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('__test_ls__', '1');
    window.localStorage.removeItem('__test_ls__');
    isLocalStorageAvailable = true;
  }
} catch (e) {
  console.warn("[AUTH_DEBUG] LocalStorage não está acessível (comum em iframes do AI Studio ou bloqueio de cookies). Utilizando MemoryStorage.");
}

// Implementação de storage seguro em memória/sessionStorage como fallback
const safeAuthStorage = {
  getItem: (key: string): string | null => {
    if (!isLocalStorageAvailable) {
      try {
        return sessionStorage.getItem(key);
      } catch (e) {
        if (typeof window !== 'undefined') {
          return (window as any).__supabaseMemoryStorage?.[key] || null;
        }
        return null;
      }
    }
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (!isLocalStorageAvailable) {
      try {
        sessionStorage.setItem(key, value);
      } catch (e) {
        if (typeof window !== 'undefined') {
          if (!(window as any).__supabaseMemoryStorage) {
            (window as any).__supabaseMemoryStorage = {};
          }
          (window as any).__supabaseMemoryStorage[key] = value;
        }
      }
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("[supabaseClient] safeAuthStorage.setItem ignored:", e);
    }
  },
  removeItem: (key: string): void => {
    if (!isLocalStorageAvailable) {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        if (typeof window !== 'undefined' && (window as any).__supabaseMemoryStorage) {
          delete (window as any).__supabaseMemoryStorage[key];
        }
      }
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("[supabaseClient] safeAuthStorage.removeItem ignored:", e);
    }
  }
};

// Inicialização segura do cliente para evitar "supabaseUrl is required"
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: safeAuthStorage
  }
}) as unknown as SupabaseClient;

// Helpers para o EnvGate.tsx
// Consideramos configurado se houver algo diferente do fallback básico ou se o fallback for o esperado
export const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseAnonKey.length > 10);

export const saveSupabaseConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('VITE_SUPABASE_URL', url);
      localStorage.setItem('VITE_SUPABASE_ANON_KEY', key);
    } catch (e) {
      console.warn("[supabaseClient] Falha ao salvar no localStorage:", e);
      try {
        sessionStorage.setItem('VITE_SUPABASE_URL', url);
        sessionStorage.setItem('VITE_SUPABASE_ANON_KEY', key);
      } catch (se) {
        console.warn("[supabaseClient] Falha ao salvar no sessionStorage:", se);
      }
    }
    window.location.reload();
  }
};

// Injeta no window para debug rápido no console se necessário
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}


import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Helper para timeout obrigatório de 10s em todas as requisições (Anti-Hang)
const fetchWithTimeout = async (url: string, options: any = {}) => {
  const timeout = 10000; // 10 segundos
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error("Timeout: O servidor demorou muito para responder. Verifique sua conexão.");
    }
    throw error;
  }
};

const getEnvVar = (key: string): string | null => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
      // @ts-ignore
      return window.__ENV__[key];
    }
  } catch (e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (e) {}
  return null;
};

const FALLBACK_URL = "https://rxtwmwrgcilmsldtqdfe.supabase.co";
const FALLBACK_KEY = "sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x";

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || FALLBACK_URL;
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || FALLBACK_KEY;

export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = (isConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        // INJEÇÃO DE SEGURANÇA: Timeout global em todas as chamadas de rede
        fetch: fetchWithTimeout
      }
    }) 
  : null) as unknown as SupabaseClient;

export const saveSupabaseConfig = (url: string, key: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('VITE_SUPABASE_URL', url);
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', key);
    window.location.reload();
  }
};

export async function testConnection() {
    if (!isConfigured || !supabase) return false;
    try {
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Supabase Connection Error:", e);
        return false;
    }
}

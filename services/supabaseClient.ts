
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Prioridade: 1. Variáveis de Ambiente | 2. LocalStorage | 3. Hardcoded Fallback (do EnvGate)
const DEFAULT_URL = 'https://rxtwmwrgcilmsldtqdfe.supabase.co';
const DEFAULT_KEY = 'sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x';

// Uso de try/catch para evitar erro caso process.env não exista no ambiente global
let envUrl, envKey;
try {
  envUrl = process.env.VITE_SUPABASE_URL;
  envKey = process.env.VITE_SUPABASE_ANON_KEY;
} catch (e) {
  envUrl = undefined;
  envKey = undefined;
}

const supabaseUrl = envUrl || localStorage.getItem('supabase_url') || DEFAULT_URL;
const supabaseAnonKey = envKey || localStorage.getItem('supabase_key') || DEFAULT_KEY;

export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn("⚠️ Supabase credentials missing. EnvGate will prompt for configuration.");
}

export const saveSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
  window.location.reload();
};

export const supabase = (isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'bela-app-auth',
      },
    }) 
  : null) as unknown as SupabaseClient;

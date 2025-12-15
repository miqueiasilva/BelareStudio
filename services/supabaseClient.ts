import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Helper to safely get env vars from various sources
const getEnvVar = (key: string): string | null => {
  // 1. Try Vite's import.meta.env
  try {
    // @ts-ignore
    if (import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}

  // 2. Try window.__ENV__ (common in docker/preview builds)
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
      // @ts-ignore
      return window.__ENV__[key];
    }
  } catch (e) {}

  // 3. Try LocalStorage (User override)
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (e) {}

  return null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

// We export a client if configured, otherwise null (cast as Client to satisfy TS imports downstream)
// The EnvGate component prevents usage of this null client.
export const supabase = (isConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
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

export const clearSupabaseConfig = () => {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('VITE_SUPABASE_URL');
        localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
        window.location.reload();
    }
}

// Helper to check connection status
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
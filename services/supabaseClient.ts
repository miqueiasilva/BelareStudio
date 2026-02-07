import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Robust environment variable resolver for Preview and Production environments
const getEnvVar = (key: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Check window overrides (Direct console injection or Preview environment)
    if ((window as any)[`__${key}__`]) return (window as any)[`__${key}__` ];
    if ((window as any).__ENV__ && (window as any).__ENV__[key]) return (window as any).__ENV__[key];

    // 2. Check import.meta.env (Vite standard)
    // FIX: Cast import.meta to any to resolve "Property 'env' does not exist on type 'ImportMeta'" error.
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }

    // 3. Check localStorage (Saved via EnvGate)
    const saved = localStorage.getItem(key);
    if (saved && saved.trim() !== '') return saved.trim();
  } catch (e) {
    console.warn(`Error resolving env var ${key}:`, e);
  }
  return null;
};

// Default credentials - IMPORTANT: Standard Supabase Anon keys are long JWT strings.
const FALLBACK_URL = "https://rxtwmwrgcilmsldtqdfe.supabase.co";
const FALLBACK_KEY = "sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x";

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || FALLBACK_URL;
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || FALLBACK_KEY;

// Diagnostic Log for developers
console.log(`[Supabase Init] URL: ${supabaseUrl} | Key Status: ${supabaseAnonKey ? 'Loaded (' + supabaseAnonKey.substring(0, 5) + '...)' : 'MISSING'}`);

export const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseAnonKey.length > 5);

// Anti-Hang Fetch implementation with explicit header persistence
const fetchWithTimeout = async (url: string, options: any = {}) => {
  const timeout = 15000; 
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  // Ensure headers are handled safely (handles both Object and Headers instances)
  const safeHeaders: Record<string, string> = {};
  
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        safeHeaders[key] = value;
      });
    } else {
      Object.assign(safeHeaders, options.headers);
    }
  }

  // CRITICAL FIX: Ensure 'apikey' is always present in outgoing requests
  if (!safeHeaders['apikey'] && supabaseAnonKey) {
    safeHeaders['apikey'] = supabaseAnonKey;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: safeHeaders,
      signal: controller.signal
    });
    clearTimeout(timer);
    return response;
  } catch (error: any) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new Error("Timeout: A requisição ao Supabase demorou mais que 15s.");
    }
    throw error;
  }
};

export const supabase = (isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: fetchWithTimeout
      }
    }) 
  : null) as unknown as SupabaseClient;

export const saveSupabaseConfig = (url: string, key: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('VITE_SUPABASE_URL', url.trim());
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', key.trim());
    window.location.reload();
  }
};

export async function testConnection() {
    if (!isConfigured || !supabase) return false;
    try {
        const { error } = await supabase.auth.getSession();
        return !error;
    } catch (e) {
        return false;
    }
}

if (typeof window !== 'undefined') {
    (window as any).supabase = supabase;
    (window as any).VITE_SUPABASE_URL = supabaseUrl;
    (window as any).VITE_SUPABASE_ANON_KEY = supabaseAnonKey;
}

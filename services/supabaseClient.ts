
import { createClient } from '@supabase/supabase-js';

// --- Safe Environment Variable Access & Diagnostics ---
let supabaseUrl: string | undefined;
let supabaseAnonKey: string | undefined;

try {
    // Diagnostic: Check if we are running in a Vite-processed environment
    // @ts-ignore
    const env = import.meta.env;
    
    console.group('🔍 Supabase Client Diagnostics');
    console.log('Environment Mode:', env ? env.MODE : 'Unknown (import.meta.env undefined)');
    
    // We access properties directly so Vite can perform static replacement string injection
    // @ts-ignore
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    // @ts-ignore
    supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    console.log('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Defined' : '❌ Missing/Undefined');
    console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Defined' : '❌ Missing/Undefined');
    console.groupEnd();

} catch (error) {
    console.error('CRITICAL ERROR: Failed to access environment variables. The app is likely running untransformed code.', error);
}

// --- Client Initialization ---

// 1. Check for missing keys to warn developer
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '⚠️ Supabase Credentials missing. Authentication will fail.\n' +
        'Check your .env file or Vercel Environment Variables settings.'
    );
}

// 2. Use fallbacks to prevent "White Screen of Death"
// The app will load, but Auth calls will fail gracefully with a 400/401 error instead of crashing the JS thread.
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

// Helper to check connection status (used in Settings)
export async function testConnection() {
    if (!supabaseUrl || !supabaseAnonKey) return false;
    try {
        const { error } = await supabase.auth.getSession();
        return !error;
    } catch (e) {
        console.error("Supabase Connection Error:", e);
        return false;
    }
}

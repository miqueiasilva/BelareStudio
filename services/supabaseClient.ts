
import { createClient } from '@supabase/supabase-js';

// Get Environment Variables
// We use direct access (import.meta.env.VARIABLE) so Vite can statically replace 
// these strings with the actual values during build/serve. 
// Using optional chaining (?. ) or dynamic access often breaks Vite's replacement regex.

// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Warn but don't crash during build time if keys are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Key missing. Authentication will fail in production if not set.');
}

// Create single instance for the app
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
);

// Helper to check connection status (used in Settings)
export async function testConnection() {
    if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') return false;
    try {
        // Simple health check query - checks if we can reach the Auth service
        const { data, error } = await supabase.auth.getSession();
        return !error; 
    } catch (e) {
        console.error("Supabase Connection Error:", e);
        return false;
    }
}


import { createClient } from '@supabase/supabase-js';

// Get Environment Variables
// @ts-ignore
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: Supabase URL or Anon Key is missing. Check your .env file or Vercel Environment Variables.');
}

// Create single instance for the app
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || '',
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
    if (!supabaseUrl) return false;
    try {
        // Simple health check query
        const { error } = await supabase.from('profiles').select('id').limit(1);
        // Error code PGRST116 means "No rows returned" which implies connection is OK, just empty table
        // Or if error is null, it's fine.
        return !error || error.code === 'PGRST116'; 
    } catch (e) {
        console.error("Supabase Connection Error:", e);
        return false;
    }
}

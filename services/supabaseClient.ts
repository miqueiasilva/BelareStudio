
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rxtwmwrgcilmsldtqdfe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://rxtwmwrgcilmsldtqdfe.supabase.co";
const DEFAULT_KEY = "sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x";
const supabase = createClient(DEFAULT_URL, DEFAULT_KEY);

const activeStudioId = "558b07c9-5e8f-4315-81e5-0446547d36df";
const start = "2026-06-01T00:00:00";
const end = "2026-06-30T23:59:59";

async function test() {
    console.log("=== JUNE APPOINTMENTS IN DETAIL (CORRECTED) ===");
    const apptsRes = await supabase.from('appointments')
        .select('id, date, status, value, client_name, client_id, service_name, service_id, professional_id, professional_name')
        .eq('studio_id', activeStudioId)
        .eq('status', 'concluido')
        .gte('date', start)
        .lte('date', end);
    console.log("June concluidos appointments error:", apptsRes.error);
    console.log("June concluidos appointments count:", apptsRes.data?.length);
    if (apptsRes.data && apptsRes.data.length > 0) {
        console.log("Sample:", apptsRes.data.slice(0, 3));
    }
}

test();

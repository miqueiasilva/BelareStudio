import { createClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://rxtwmwrgcilmsldtqdfe.supabase.co";
const DEFAULT_KEY = "sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x";
const supabase = createClient(DEFAULT_URL, DEFAULT_KEY);

const activeStudioId = "558b07c9-5e8f-4315-81e5-0446547d36df";

async function audit() {
    console.log("=== 1. SEARCHING FOR CLIENTS CONTAINING 'LAURA' ===");
    const { data: clients, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .ilike('nome', '%laura%');

    if (clientErr) {
        console.error("Client Error:", clientErr);
        return;
    }
    console.log("Clients found:", clients);

    console.log("\n=== 2. SEARCHING FOR ALL APPOINTMENTS OF LAURA MARIA ===");
    // Let's search using both client_id and matching client_name or client_whatsapp
    const { data: apps, error: appsErr } = await supabase
        .from('appointments')
        .select('*')
        .or('client_name.ilike.%laura%,client_whatsapp.eq.81986952565');

    if (appsErr) {
        console.error("Apps Error:", appsErr);
        return;
    }
    console.log(`Appointments found (${apps?.length || 0} total):`);
    apps.forEach(app => {
        console.log(`ID: ${app.id}, Date: ${app.date}, Name: ${app.client_name}, Phone: ${app.client_whatsapp}, Status: ${app.status}, Created: ${app.created_at}, Notes: ${app.notes || app.notas || ''}`);
    });

    console.log("\n=== 3. SEARCHING FOR ALL APPOINTMENTS ON JULY 16, 2026 ===");
    const { data: dayApps, error: dayAppsErr } = await supabase
        .from('appointments')
        .select('*')
        .gte('date', '2026-07-16T00:00:00Z')
        .lte('date', '2026-07-16T23:59:59Z');

    if (dayAppsErr) {
        console.error("Day Apps Error:", dayAppsErr);
        return;
    }
    console.log(`Appointments on July 16, 2026 (${dayApps?.length || 0} total):`);
    dayApps.forEach(app => {
        console.log(`- ID: ${app.id}, Time: ${app.start_at || app.date}, Name: ${app.client_name}, Phone: ${app.client_whatsapp}, Service: ${app.service_name}, Status: ${app.status}, Created: ${app.created_at}`);
    });
}

audit();

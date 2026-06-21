import { createClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://rxtwmwrgcilmsldtqdfe.supabase.co";
const DEFAULT_KEY = "sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x";
const supabase = createClient(DEFAULT_URL, DEFAULT_KEY);

async function test() {
    console.log("=== TRY CLIENT INSERT ===");
    const testStudioId = "558b07c9-5e8f-4315-81e5-0446547d36df";
    
    // Attempt 1: Inserting integer vs different things in commands
    console.log("\n--- Testing insert with client_id = 240 (integer) and professional_id = null ---");
    const resIntClient = await supabase.from('commands').insert([{
        studio_id: testStudioId,
        client_id: 240,
        client_name: "Test Client",
        status: "open",
        total_amount: 100
    }]).select();
    console.log("Result (integer client_id):", resIntClient.error ? resIntClient.error.message : "Success ID: " + resIntClient.data?.[0]?.id);

    console.log("\n--- Testing insert with professional_id = 240 (integer) ---");
    const resIntProf = await supabase.from('commands').insert([{
        studio_id: testStudioId,
        client_id: null,
        client_name: "Test Client",
        professional_id: 240, 
        status: "open",
        total_amount: 100
    }]).select();
    console.log("Result (integer professional_id):", resIntProf.error ? resIntProf.error.message : "Success ID: " + resIntProf.data?.[0]?.id);

    console.log("\n--- Testing insert with professional_id as string 240 ---");
    const resStrProf = await supabase.from('commands').insert([{
        studio_id: testStudioId,
        client_id: null,
        client_name: "Test Client",
        professional_id: "240", 
        status: "open",
        total_amount: 100
    }]).select();
    console.log("Result (string professional_id):", resStrProf.error ? resStrProf.error.message : "Success ID: " + resStrProf.data?.[0]?.id);
}

test();


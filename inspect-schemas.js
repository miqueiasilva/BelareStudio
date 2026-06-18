import { createClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://rxtwmwrgcilmsldtqdfe.supabase.co";
const DEFAULT_KEY = "sb_publishable_jpVmCuQ3xmbWWcvgHn_H3g_Vypfyw0x";
const supabase = createClient(DEFAULT_URL, DEFAULT_KEY);

async function test() {
    console.log("=== APPOINTMENTS ONE RAW ROW ===");
    const appts = await supabase.from('appointments').select('*').limit(1);
    if (appts.data && appts.data.length > 0) {
        console.log("Columns on appointments:", Object.keys(appts.data[0]));
    } else {
        console.log("No appointments row found or error:", appts.error);
    }

    console.log("=== COMMANDS ONE RAW ROW ===");
    const cmds = await supabase.from('commands').select('*').limit(1);
    if (cmds.data && cmds.data.length > 0) {
        console.log("Columns on commands:", Object.keys(cmds.data[0]));
    } else {
        console.log("No commands row found or error:", cmds.error);
    }
}

test();

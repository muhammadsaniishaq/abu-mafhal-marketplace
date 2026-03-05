require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    console.log("Testing exact AdminPayouts query...");
    const { data, error } = await supabase
        .from('vendor_payouts')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Full Error Response:", JSON.stringify(error, null, 2));
    } else {
        console.log("Success! Data length:", data?.length);
    }
}
run();

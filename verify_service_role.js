import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA3MjE1MCwiZXhwIjoyMDgxNjQ4MTUwfQ.1E6tXzD-r-B8t5_C-H8OPE62j7h4NstG_mU8uFh-LHg';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function verify() {
    console.log('--- Inspecting confirm_order_receipt via service_role ---');

    // Attempting to use a standard query on pg_proc or information_schema.routines
    // Note: PostgREST doesn't expose internal tables by default, but let's try.
    const { data, error } = await supabase
        .from('profiles') // Just testing connection
        .select('*')
        .limit(1);

    if (error) {
        console.error('Service Role Connection Test Failed:', error);
        return;
    }
    console.log('Service Role Connection Test: SUCCESS');

    // Check if we can find any RPC related to running SQL
    const rpcs = ['run_sql', 'exec_sql', 'query', 'execute'];
    for (const rpc of rpcs) {
        const { error: rpcErr } = await supabase.rpc(rpc, { sql: 'SELECT 1' });
        if (rpcErr && rpcErr.message.includes('Could not find the function')) {
            console.log(`RPC ${rpc}: NOT FOUND`);
        } else {
            console.log(`RPC ${rpc}: FOUND (or error: ${rpcErr?.message})`);
        }
    }
}

verify();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    const rpcs = [
        { name: 'exec_sql', params: { sql: 'SELECT 1' } },
        { name: 'run_sql', params: { sql: 'SELECT 1' } },
        { name: 'execute_sql', params: { sql: 'SELECT 1' } },
        { name: 'exec', params: { sql: 'SELECT 1' } },
        { name: 'query', params: { sql: 'SELECT 1' } }
    ];

    for (const rpc of rpcs) {
        try {
            const { data, error } = await supabase.rpc(rpc.name, rpc.params);
            if (error && error.message.includes('Could not find the function')) {
                console.log(`RPC ${rpc.name}: NOT FOUND`);
            } else {
                console.log(`RPC ${rpc.name}: FOUND (or other error: ${error?.message})`, data);
            }
        } catch (err) {
            console.log(`RPC ${rpc.name} exception:`, err.message);
        }
    }
}

probe();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA3MjE1MCwiZXhwIjoyMDgxNjQ4MTUwfQ.1E6tXzD-r-B8t5_C-H8OPE62j7h4NstG_mU8uFh-LHg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    try {
        const { data, error } = await supabase.from('reviews').select('*').limit(1);
        if (error) {
            console.error('Error fetching reviews:', error);
            return;
        }
        if (data && data.length > 0) {
            console.log('Columns found:', Object.keys(data[0]));
        } else {
            console.log('Table exists but is empty. Fetching column names via RPC if available or trying an insert.');
            // Try to fetch column names via postgres rpc if exists
            const { data: cols, error: rpcError } = await supabase.rpc('get_table_columns', { table_name: 'reviews' });
            if (rpcError) {
                console.log('RPC get_table_columns not found. Trying to insert a dummy review to see what fails.');
                const { error: insError } = await supabase.from('reviews').insert({ id: '00000000-0000-0000-0000-000000000000' });
                console.log('Insert error msg:', insError?.message);
            } else {
                console.log('Table columns:', cols);
            }
        }
    } catch (e) {
        console.error('Check failed:', e);
    }
}

check();

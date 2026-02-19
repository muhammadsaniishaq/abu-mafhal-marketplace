const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRLS() {
    console.log('--- RLS POLICY CHECK ---');
    // We can't see policies directly, but we can check if we can select
    // if we had a user. Since we don't, we'll check if a "public" policy exists
    // by trying to select. (We already did, it returned 0).

    // Let's check for "profiles" table RLS too because it's used in joins.
    const { data: p, error: pe } = await supabase.from('profiles').select('*').limit(1);
    console.log('Profiles Select:', p ? 'Success' : 'Failed', pe?.message);
}
checkRLS();

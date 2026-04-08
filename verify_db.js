import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
    console.log('--- Inspecting confirm_order_receipt definition ---');
    // We use a raw query if possible, but since we can't do raw SQL, 
    // we use a trick: query the information_schema view as a regular table.
    const { data, error } = await supabase
        .from('routines')
        .select('routine_definition')
        .eq('routine_name', 'confirm_order_receipt')
        .eq('routine_schema', 'public');

    if (error) {
        console.error('Error fetching routine definition:', error);
        // Maybe it's not exposed via PostgREST. Let's try to query 'profiles' again to be sure.
        return;
    }

    if (data && data.length > 0) {
        console.log('Function Definition found!');
        console.log(data[0].routine_definition);
    } else {
        console.log('Function confirm_order_receipt NOT found in information_schema.routines or not accessible.');
    }
}

verify();

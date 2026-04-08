import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
    console.log('--- Verifying Database Columns for "drivers" ---');
    const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching drivers:', error);
        return;
    }

    if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log('Columns found in drivers:', columns);
        if (columns.includes('amc_coins')) {
            console.log('✅ Found amc_coins in drivers table');
        } else {
            console.log('❌ amc_coins NOT found in drivers table');
        }
    } else {
        console.log('No rows found in drivers table to inspect columns.');
    }
}

verify();

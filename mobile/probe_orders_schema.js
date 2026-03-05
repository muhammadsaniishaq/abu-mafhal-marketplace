const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeSchema() {
    // Try to insert a row with a definitely non-existent column
    const { error } = await supabase
        .from('orders')
        .insert([{ non_existent_column_probe: 'test' }]);

    if (error) {
        console.log('Probe Error:', error.message);
        // Supabase often returns the valid columns in case of unknown column error
    } else {
        console.log('Unexpected success - table may have no columns?');
    }
}
probeSchema();

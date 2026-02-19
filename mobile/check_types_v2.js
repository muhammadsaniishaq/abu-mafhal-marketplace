const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumnTypes() {
    console.log('--- COLUMN TYPES CHECK ---');
    // Using a hack to get types if possible, or just checking the format of a value
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (data?.[0]) {
        console.log('Product ID:', data[0].id, 'Type:', typeof data[0].id);
    }

    // Try to get a hint from a failed cast
    const { error: typeError } = await supabase.from('order_items').select('id').eq('id', 'not-a-uuid');
    if (typeError) {
        console.log('Error hint for ID type:', typeError.message);
    }
}
checkColumnTypes();

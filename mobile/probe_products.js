const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function probeProducts() {
    const columns = [
        'id', 'name', 'price', 'description', 'vendor_id'
    ];

    for (const col of columns) {
        const { error } = await supabase
            .from('products')
            .insert([{ [col]: null }]);

        if (error && error.message.includes(`Could not find the '${col}' column`)) {
            console.log(`[ABSENT] ${col}`);
        } else {
            console.log(`[PRESENT] ${col} (Error: ${error?.message})`);
        }
    }
}
probeProducts();

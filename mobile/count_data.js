const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function countData() {
    try {
        const { count: prodCount, error: prodErr } = await supabase.from('products').select('*', { count: 'exact', head: true });
        console.log('Products count:', prodCount, 'Error:', prodErr?.message);

        const { count: catCount, error: catErr } = await supabase.from('product_categories').select('*', { count: 'exact', head: true });
        console.log('Categories count:', catCount, 'Error:', catErr?.message);

        const { data: catData } = await supabase.from('product_categories').select('*');
        console.log('Categories list:', catData?.map(c => c.name));

        const { count: saleCount, error: saleErr } = await supabase.from('flash_sales').select('*', { count: 'exact', head: true });
        console.log('Flash sales count:', saleCount, 'Error:', saleErr?.message);

        const { data: testData, error: testErr } = await supabase.from('testimonials').select('*');
        console.log('Testimonials count:', testData?.length, 'Error:', testErr?.message);
        console.log('Testimonials list:', testData);
    } catch (e) {
        console.error(e);
    }
}
countData();

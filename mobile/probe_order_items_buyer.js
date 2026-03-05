const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function probe() {
    console.log('Probing order_items table...');
    const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching order_items:', error);
    } else {
        console.log('Columns in order_items:', Object.keys(data[0] || {}).join(', '));
    }
}

probe();

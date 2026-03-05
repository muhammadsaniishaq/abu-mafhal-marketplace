const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
});

const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkSchema() {
    const { data, error } = await supabase.from('mail').select('*').limit(1);
    if (error) {
        console.error("Error fetching mail:", error);
    } else if (data && data.length > 0) {
        console.log("Mail table columns:");
        console.log(Object.keys(data[0]));
    } else {
        console.log("Mail table is empty, trying to insert a dummy row to get error details...");
        const { error: insertError } = await supabase.from('mail').insert([{}]).select();
        console.log("Insert error details:");
        console.log(insertError);
    }
}

checkSchema();

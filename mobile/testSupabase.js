const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*').limit(1);
    console.log('--- profiles ---');
    if (profilesError) console.error(profilesError);
    else console.log(Object.keys(profilesData[0] || {}));

    const { data: refData, error: refError } = await supabase.from('referrals').select('*').limit(1);
    console.log('--- referrals ---');
    if (refError) console.error(refError);
    else console.log(refData.length ? Object.keys(refData[0]) : 'Referrals table exists but empty');
}
checkSchema();

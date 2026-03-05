const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env';
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const urlMatch = envFile.match(/EXPO_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envFile.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

    if (urlMatch && keyMatch) {
        const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

        async function run() {
            const { data: nData } = await supabase.from('notifications').select('*').limit(1);
            console.log('Notifications schema:', nData && nData.length > 0 ? Object.keys(nData[0]) : 'Empty');

            const { data: mData } = await supabase.from('mail').select('*').limit(1);
            console.log('Mail schema:', mData && mData.length > 0 ? Object.keys(mData[0]) : 'Empty');
        }
        run();
    } else {
        console.log('Keys not found in .env');
    }
} else {
    console.log('.env not found');
}

-- Check RLS policies on profiles table specifically
select * from pg_policies where tablename = 'profiles';

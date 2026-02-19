-- triggers.sql

-- 1. Create a function that inserts a row into public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'buyer');
  return new;
end;
$$;

-- 2. Create the trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. (Optional) Create function for wallet creation if needed
create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.wallets (user_id, balance, currency, is_active)
  values (new.id, 0.00, 'NGN', true);
  return new;
end;
$$;

-- 4. Create trigger for wallet
drop trigger if exists on_auth_user_created_wallet on auth.users;

create trigger on_auth_user_created_wallet
  after insert on auth.users
  for each row execute procedure public.handle_new_user_wallet();

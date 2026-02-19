-- Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

-- Helper to check if calling user is admin (if not already defined)
create or replace function public.is_admin()
returns boolean as $$
declare
  is_admin boolean;
begin
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into is_admin;
  return is_admin;
end;
$$ language plpgsql security definer;

-- RPC to manually reset a user's password
create or replace function admin_reset_password(target_user_id uuid, new_password text)
returns void
language plpgsql
security definer
as $$
begin
  -- Check permission
  if not public.is_admin() then
    raise exception 'Access Denied: Only Admins can reset passwords.';
  end if;

  -- Update password in auth.users
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;
  
  -- Validation
  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

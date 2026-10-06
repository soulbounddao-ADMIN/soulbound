create extension if not exists pgtap with schema extensions;

begin;

select plan(7);

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  aud,
  role,
  instance_id,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  'c0000000-0000-0000-0000-000000000001',
  'provisioning-test@soulbound.local',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000',
  '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"provisioning_test"}'::jsonb,
  now(),
  now()
);

select is(
  (
    select count(*)::int
    from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001'::uuid
  ),
  1,
  'auth user creation provisions exactly one profile'
);

select is(
  (
    select role
    from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001'::uuid
  ),
  'applicant',
  'provisioned profile defaults to applicant'
);

select is(
  (
    select membership_status
    from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000001'::uuid
  ),
  'none',
  'provisioned profile defaults to no membership'
);

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  aud,
  role,
  instance_id,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  'c0000000-0000-0000-0000-000000000002',
  'forged-role-test@soulbound.local',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000',
  '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"forged_role_test","role":"admin"}'::jsonb,
  now(),
  now()
);

select is(
  (
    select role
    from public.profiles
    where id = 'c0000000-0000-0000-0000-000000000002'::uuid
  ),
  'applicant',
  'provisioning ignores a forged user metadata role'
);

select is(
  (
    select role
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000001'::uuid
  ),
  'admin',
  'seed preserves the admin role'
);

select is(
  (
    select role
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000002'::uuid
  ),
  'reviewer',
  'seed preserves the reviewer role'
);

select is(
  (
    select role
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000003'::uuid
  ),
  'applicant',
  'seed preserves the applicant role'
);

select * from finish();

rollback;

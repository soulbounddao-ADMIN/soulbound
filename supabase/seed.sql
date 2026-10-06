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
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'admin@soulbound.local',
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
    '{"username":"admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'reviewer@soulbound.local',
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
    '{"username":"reviewer"}'::jsonb,
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'applicant@soulbound.local',
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
    '{"username":"applicant"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'email',
    '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@soulbound.local","email_verified":false,"phone_verified":false}'::jsonb,
    now(),
    now(),
    now()
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'email',
    '{"sub":"a0000000-0000-0000-0000-000000000002","email":"reviewer@soulbound.local","email_verified":false,"phone_verified":false}'::jsonb,
    now(),
    now(),
    now()
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'email',
    '{"sub":"a0000000-0000-0000-0000-000000000003","email":"applicant@soulbound.local","email_verified":false,"phone_verified":false}'::jsonb,
    now(),
    now(),
    now()
  )
on conflict (provider_id, provider) do nothing;

insert into public.profiles (
  id,
  handle,
  display_name,
  bio,
  username,
  member_number,
  role,
  membership_status
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'admin',
    'Admin User',
    'System administrator',
    'admin',
    1,
    'admin',
    'active'
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'reviewer',
    'Reviewer User',
    'Application reviewer',
    'reviewer',
    2,
    'reviewer',
    'active'
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'applicant',
    'Applicant User',
    'Membership applicant',
    'applicant',
    null,
    'applicant',
    'none'
  )
on conflict (id) do update set
  handle = excluded.handle,
  display_name = excluded.display_name,
  bio = excluded.bio,
  username = excluded.username,
  member_number = excluded.member_number,
  role = excluded.role,
  membership_status = excluded.membership_status;

select setval(
  'public.member_numbers_seq',
  (select coalesce(max(member_number), 1) from public.profiles)
);

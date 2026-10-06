create extension if not exists pgtap with schema extensions;

begin;

set search_path = public, extensions;

select no_plan();

create function pg_temp.create_vote_user(
  p_id uuid,
  p_username text,
  p_role text default 'applicant',
  p_active boolean default false,
  p_member_number bigint default null
)
returns void
language plpgsql
as $$
begin
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
    p_id,
    p_username || '@soulbound.internal',
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
    jsonb_build_object('username', p_username),
    now(),
    now()
  )
  on conflict (id) do nothing;

  update public.profiles
    set role = p_role,
        membership_status = case when p_active then 'active' else 'none' end,
        member_number = p_member_number,
        updated_at = now()
  where id = p_id;

  if p_active then
    insert into public.memberships (user_id, status, tier)
    values (p_id, 'active', 'basic')
    on conflict do nothing;
  end if;
end;
$$;

create function pg_temp.sqlstate_for(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000';
exception
  when others then
    return sqlstate;
end;
$$;

create temp table vote_test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update, delete on vote_test_ids to service_role, authenticated;

select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'vote_reviewer',
  'reviewer',
  true,
  9101
);
select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000002'::uuid,
  'vote_admin',
  'admin',
  true,
  9102
);
select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000003'::uuid,
  'vote_member_one',
  'member',
  true,
  9103
);
select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000004'::uuid,
  'vote_member_two',
  'member',
  true,
  9104
);
select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000005'::uuid,
  'vote_member_three',
  'member',
  true,
  9105
);
select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000006'::uuid,
  'vote_non_member',
  'applicant',
  false,
  null
);
select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000007'::uuid,
  'vote_applicant_approve',
  'applicant',
  false,
  null
);
select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000008'::uuid,
  'vote_applicant_tie',
  'applicant',
  false,
  null
);
select pg_temp.create_vote_user(
  'f0000000-0000-0000-0000-000000000009'::uuid,
  'vote_applicant_override',
  'applicant',
  false,
  null
);

set local role service_role;

insert into vote_test_ids (key, id)
select 'approve_app', id
from public.submit_application_tx(
  'f0000000-0000-0000-0000-000000000007'::uuid,
  'phase1-vote',
  'vote-submit-approve',
  'approve by members statement',
  null,
  null,
  null,
  null
);

select is(
  (
    public.start_review_tx(
      (select id from vote_test_ids where key = 'approve_app'),
      'f0000000-0000-0000-0000-000000000001'::uuid,
      'vote-start-approve'
    )
  ).status::text,
  'under_review',
  'reviewer starts review before opening vote'
);

insert into vote_test_ids (key, id)
select 'approve_vote', id
from public.open_vote_tx(
  (select id from vote_test_ids where key = 'approve_app'),
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'vote-open-approve',
  now() + interval '1 day'
);

select is(
  (
    select status
    from public.admission_applications
    where id = (select id from vote_test_ids where key = 'approve_app')
  ),
  'in_vote',
  'open_vote_tx moves application into DB-only in_vote status'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-0000-0000-000000000003',
  true
);

select is(
  (
    select count(*)::int
    from public.list_open_admission_votes(20, null, null)
  ),
  1,
  'active member can see open vote-safe list'
);

select ok(
  (
    select applicant_statement = 'approve by members statement'
    from public.get_admission_vote((select id from vote_test_ids where key = 'approve_vote'))
  ),
  'vote detail exposes statement'
);

select lives_ok(
  format(
    'select public.cast_vote_tx(%L::uuid, %L)',
    (select id::text from vote_test_ids where key = 'approve_vote'),
    'yes'
  ),
  'active member can cast YES'
);

select is(
  pg_temp.sqlstate_for(
    format(
      'select public.cast_vote_tx(%L::uuid, %L)',
      (select id::text from vote_test_ids where key = 'approve_vote'),
      'no'
    )
  ),
  '23505',
  'one-vote uniqueness rejects duplicate casts'
);

select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-0000-0000-000000000004',
  true
);
select lives_ok(
  format(
    'select public.cast_vote_tx(%L::uuid, %L)',
    (select id::text from vote_test_ids where key = 'approve_vote'),
    'no'
  ),
  'second active member can cast NO'
);

select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-0000-0000-000000000005',
  true
);
select lives_ok(
  format(
    'select public.cast_vote_tx(%L::uuid, %L)',
    (select id::text from vote_test_ids where key = 'approve_vote'),
    'yes'
  ),
  'third active member can cast YES'
);

select is(
  (
    select count(*)::int
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admission_vote_ballots'
      and column_name = 'voter_id'
  ),
  0,
  'ballots do not store voter_id'
);

reset role;

select is(
  (
    select count(*)::int
    from public.admission_vote_turnout
    where vote_id = (select id from vote_test_ids where key = 'approve_vote')
  ),
  3,
  'turnout stores who voted without choice'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-0000-0000-000000000006',
  true
);

select is(
  (
    select count(*)::int
    from public.list_open_admission_votes(20, null, null)
  ),
  0,
  'non-active applicant cannot read vote list'
);

select is(
  pg_temp.sqlstate_for(
    format(
      'select public.cast_vote_tx(%L::uuid, %L)',
      (select id::text from vote_test_ids where key = 'approve_vote'),
      'yes'
    )
  ),
  '42501',
  'non-active applicant cannot cast vote'
);

reset role;
set local role service_role;

select lives_ok(
  format(
    'select public.finalize_vote_tx(%L::uuid, %L::uuid, %L)',
    (select id::text from vote_test_ids where key = 'approve_vote'),
    '00000000-0000-4000-8000-000000001012',
    'vote-finalize-approve'
  ),
  'system actor finalizes YES > NO vote'
);

select is(
  (
    select outcome
    from public.admission_votes
    where id = (select id from vote_test_ids where key = 'approve_vote')
  ),
  'approved',
  'YES > NO approves'
);

select is(
  (
    select status
    from public.admission_applications
    where id = (select id from vote_test_ids where key = 'approve_app')
  ),
  'approved',
  'finalize delegates approval to frozen approve_application_tx'
);

select ok(
  (
    select member_number is not null
    from public.profiles
    where id = 'f0000000-0000-0000-0000-000000000007'::uuid
  ),
  'frozen approve path assigns member-N'
);

select ok(
  (
    select applicant_statement is null
    from public.admission_applications
    where id = (select id from vote_test_ids where key = 'approve_app')
  ),
  'frozen approve path shreds applicant statement'
);

select is(
  (
    select count(*)::int
    from public.admission_vote_ballots
    where vote_id = (select id from vote_test_ids where key = 'approve_vote')
  ),
  0,
  'finalize purges choice rows'
);

insert into vote_test_ids (key, id)
select 'tie_app', id
from public.submit_application_tx(
  'f0000000-0000-0000-0000-000000000008'::uuid,
  'phase1-vote',
  'vote-submit-tie',
  'tie by members statement',
  null,
  null,
  null,
  null
);

select is(
  (
    public.start_review_tx(
      (select id from vote_test_ids where key = 'tie_app'),
      'f0000000-0000-0000-0000-000000000001'::uuid,
      'vote-start-tie'
    )
  ).status::text,
  'under_review',
  'reviewer starts tie test review'
);

insert into vote_test_ids (key, id)
select 'tie_vote', id
from public.open_vote_tx(
  (select id from vote_test_ids where key = 'tie_app'),
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'vote-open-tie',
  now() + interval '1 day'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-0000-0000-000000000003',
  true
);
select lives_ok(
  format(
    'select public.cast_vote_tx(%L::uuid, %L)',
    (select id::text from vote_test_ids where key = 'tie_vote'),
    'yes'
  ),
  'tie test member casts YES'
);
select set_config(
  'request.jwt.claim.sub',
  'f0000000-0000-0000-0000-000000000004',
  true
);
select lives_ok(
  format(
    'select public.cast_vote_tx(%L::uuid, %L)',
    (select id::text from vote_test_ids where key = 'tie_vote'),
    'no'
  ),
  'tie test member casts NO'
);

reset role;
set local role service_role;
select lives_ok(
  format(
    'select public.finalize_vote_tx(%L::uuid, %L::uuid, %L)',
    (select id::text from vote_test_ids where key = 'tie_vote'),
    '00000000-0000-4000-8000-000000001012',
    'vote-finalize-tie'
  ),
  'system actor finalizes tie vote'
);

select is(
  (
    select outcome
    from public.admission_votes
    where id = (select id from vote_test_ids where key = 'tie_vote')
  ),
  'rejected',
  'tie rejects by default'
);

select is(
  (
    select status
    from public.admission_applications
    where id = (select id from vote_test_ids where key = 'tie_app')
  ),
  'rejected',
  'tie rejection delegates to frozen reject_application_tx'
);

insert into vote_test_ids (key, id)
select 'override_app', id
from public.submit_application_tx(
  'f0000000-0000-0000-0000-000000000009'::uuid,
  'phase1-vote',
  'vote-submit-override',
  'override by admin statement',
  null,
  null,
  null,
  null
);

select is(
  (
    public.start_review_tx(
      (select id from vote_test_ids where key = 'override_app'),
      'f0000000-0000-0000-0000-000000000001'::uuid,
      'vote-start-override'
    )
  ).status::text,
  'under_review',
  'reviewer starts override test review'
);

insert into vote_test_ids (key, id)
select 'override_vote', id
from public.open_vote_tx(
  (select id from vote_test_ids where key = 'override_app'),
  'f0000000-0000-0000-0000-000000000001'::uuid,
  'vote-open-override',
  now() + interval '1 day'
);

select is(
  pg_temp.sqlstate_for(
    format(
      'select public.override_vote_tx(%L::uuid, %L::uuid, %L, %L)',
      (select id::text from vote_test_ids where key = 'override_vote'),
      'f0000000-0000-0000-0000-000000000001',
      'approved',
      'vote-reviewer-override'
    )
  ),
  '42501',
  'reviewer cannot admin-override vote'
);

select lives_ok(
  format(
    'select public.override_vote_tx(%L::uuid, %L::uuid, %L, %L)',
    (select id::text from vote_test_ids where key = 'override_vote'),
    'f0000000-0000-0000-0000-000000000002',
    'approved',
    'vote-admin-override'
  ),
  'admin can override vote'
);

select is(
  (
    select status
    from public.admission_votes
    where id = (select id from vote_test_ids where key = 'override_vote')
  ),
  'overridden',
  'admin override marks vote overridden'
);

select is(
  (
    select status
    from public.admission_applications
    where id = (select id from vote_test_ids where key = 'override_app')
  ),
  'approved',
  'admin override delegates to frozen approve_application_tx'
);

select is(
  (
    select member_number
    from public.profiles
    where id = '00000000-0000-4000-8000-000000001012'::uuid
  ),
  null,
  'system finalizer has no member number and stays member-facing invisible'
);

select * from finish();

rollback;

create extension if not exists pgtap with schema extensions;

begin;

set search_path = public, extensions;

select no_plan();

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

create function pg_temp.create_resubmit_user(
  p_id uuid,
  p_handle text,
  p_role text default 'applicant'
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
    p_handle || '@soulbound.local',
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
    jsonb_build_object('username', replace(p_handle, '-', '_')),
    now(),
    now()
  )
  on conflict (id) do nothing;

  insert into public.profiles (
    id,
    handle,
    display_name,
    bio,
    username,
    role,
    membership_status
  )
  values (
    p_id,
    p_handle,
    p_handle,
    'admission resubmit test user',
    replace(p_handle, '-', '_'),
    p_role,
    'none'
  )
  on conflict (id) do update set
    handle = excluded.handle,
    display_name = excluded.display_name,
    bio = excluded.bio,
    username = excluded.username,
    role = excluded.role,
    membership_status = excluded.membership_status;
end;
$$;

select pg_temp.create_resubmit_user(
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'resubmit-applicant'
);
select pg_temp.create_resubmit_user(
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'resubmit-other'
);
select pg_temp.create_resubmit_user(
  'e0000000-0000-0000-0000-000000000004'::uuid,
  'resubmit-omitted'
);
select pg_temp.create_resubmit_user(
  'e0000000-0000-0000-0000-000000000003'::uuid,
  'resubmit-reviewer',
  'reviewer'
);

create temp table resubmit_ids (
  key text primary key,
  id uuid not null
) on commit drop;

create temp table resubmit_snapshot (
  application_id uuid primary key,
  reviewer_id uuid,
  reviewed_at timestamptz,
  review_summary text
) on commit drop;

grant select, insert, update, delete on resubmit_ids to service_role, authenticated, anon;
grant select, insert, update, delete on resubmit_snapshot to service_role, authenticated, anon;

set local role service_role;

insert into resubmit_ids (key, id)
select 'main_app', id
from public.submit_application_tx(
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'phase1-resubmit',
  'resubmit-submit-main',
  'original statement',
  null,
  null,
  null,
  null
);

select is(
  (
    public.start_review_tx(
      (select id from resubmit_ids where key = 'main_app'),
      'e0000000-0000-0000-0000-000000000003'::uuid,
      'resubmit-start-main'
    )
  ).status::text,
  'under_review',
  'start_review_tx prepares the resubmit fixture'
);

select is(
  (
    public.request_more_info_tx(
      (select id from resubmit_ids where key = 'main_app'),
      'e0000000-0000-0000-0000-000000000003'::uuid,
      'needs_identity_clarification',
      'resubmit-more-info-main',
      '보완 안내',
      'SECRET_REVIEW_SUMMARY_RESUBMIT'
    )
  ).status::text,
  'needs_more_info',
  'request_more_info_tx moves the fixture into needs_more_info'
);

insert into resubmit_snapshot (application_id, reviewer_id, reviewed_at, review_summary)
select id, reviewer_id, reviewed_at, review_summary
from public.admission_applications
where id = (select id from resubmit_ids where key = 'main_app');

select is(
  (
    public.admission_resubmit(
      (select id from resubmit_ids where key = 'main_app'),
      'e0000000-0000-0000-0000-000000000001'::uuid,
      'updated statement',
      'resubmit-main'
    )
  ).status::text,
  'submitted',
  'admission_resubmit transitions needs_more_info to submitted'
);

select is(
  (
    select applicant_statement
    from public.admission_applications
    where id = (select id from resubmit_ids where key = 'main_app')
  ),
  'updated statement',
  'admission_resubmit replaces the applicant statement'
);

select is(
  (
    select applicant_notice
    from public.admission_applications
    where id = (select id from resubmit_ids where key = 'main_app')
  ),
  null,
  'admission_resubmit clears the applicant notice'
);

select is(
  (
    select reviewer_id
    from public.admission_applications
    where id = (select id from resubmit_ids where key = 'main_app')
  ),
  (
    select reviewer_id
    from resubmit_snapshot
    where application_id = (select id from resubmit_ids where key = 'main_app')
  ),
  'admission_resubmit keeps reviewer_id unchanged'
);

select is(
  (
    select reviewed_at
    from public.admission_applications
    where id = (select id from resubmit_ids where key = 'main_app')
  ),
  (
    select reviewed_at
    from resubmit_snapshot
    where application_id = (select id from resubmit_ids where key = 'main_app')
  ),
  'admission_resubmit keeps reviewed_at unchanged'
);

select is(
  (
    select review_summary
    from public.admission_applications
    where id = (select id from resubmit_ids where key = 'main_app')
  ),
  (
    select review_summary
    from resubmit_snapshot
    where application_id = (select id from resubmit_ids where key = 'main_app')
  ),
  'admission_resubmit keeps review_summary unchanged'
);

select ok(
  exists (
    select 1
    from public.admission_events
    where application_id = (select id from resubmit_ids where key = 'main_app')
      and actor_id = 'e0000000-0000-0000-0000-000000000001'::uuid
      and from_status = 'needs_more_info'
      and to_status = 'submitted'
      and reason_code is null
      and idempotency_key = 'resubmit-main'
  ),
  'admission_resubmit writes the applicant resubmit event without a reason code'
);

select is(
  (
    select metadata
    from public.audit_logs
    where action = 'application.resubmit'
      and entity_id = (select id from resubmit_ids where key = 'main_app')
  ),
  jsonb_build_object(
    'from_status', 'needs_more_info',
    'to_status', 'submitted'
  ),
  'application.resubmit audit metadata is status-only'
);

select ok(
  (
    select hash is not null and previous_hash is not null
    from public.audit_logs
    where action = 'application.resubmit'
      and entity_id = (select id from resubmit_ids where key = 'main_app')
  ),
  'application.resubmit audit row is chained'
);

select ok(
  not exists (
    select 1
    from public.audit_logs
    where action = 'application.resubmit'
      and (
        metadata::text like '%updated statement%'
        or metadata::text like '%SECRET_REVIEW_SUMMARY_RESUBMIT%'
      )
  ),
  'application.resubmit audit row does not carry statement or review summary'
);

select is(
  (
    public.admission_resubmit(
      (select id from resubmit_ids where key = 'main_app'),
      'e0000000-0000-0000-0000-000000000001'::uuid,
      'replay should not update',
      'resubmit-main'
    )
  ).applicant_statement,
  'updated statement',
  'same idempotency key replays the existing application'
);

select is(
  (
    select count(*)::int
    from public.admission_events
    where idempotency_key = 'resubmit-main'
  ),
  1,
  'resubmit idempotency replay does not duplicate admission_events'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where action = 'application.resubmit'
      and entity_id = (select id from resubmit_ids where key = 'main_app')
  ),
  1,
  'resubmit idempotency replay does not duplicate audit logs'
);

select is(
  pg_temp.sqlstate_for(
    format(
      'select public.admission_resubmit(%L::uuid, %L::uuid, %L, %L)',
      (select id::text from resubmit_ids where key = 'main_app'),
      'e0000000-0000-0000-0000-000000000002',
      'other applicant statement',
      'resubmit-other-applicant'
    )
  ),
  '42501',
  'another applicant cannot resubmit the application'
);

insert into resubmit_ids (key, id)
select 'wrong_state_app', id
from public.submit_application_tx(
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'phase1-resubmit',
  'resubmit-submit-wrong-state',
  'wrong state statement',
  null,
  null,
  null,
  null
);

select is(
  pg_temp.sqlstate_for(
    format(
      'select public.admission_resubmit(%L::uuid, %L::uuid, %L, %L)',
      (select id::text from resubmit_ids where key = 'wrong_state_app'),
      'e0000000-0000-0000-0000-000000000002',
      'wrong state update',
      'resubmit-wrong-state'
    )
  ),
  'P0001',
  'a non-needs_more_info application cannot be resubmitted with a different key'
);

select is(
  pg_temp.sqlstate_for(
    format(
      'select public.admission_resubmit(%L::uuid, %L::uuid, %L, %L)',
      (select id::text from resubmit_ids where key = 'wrong_state_app'),
      'e0000000-0000-0000-0000-000000000002',
      'wrong application key reuse',
      'resubmit-main'
    )
  ),
  'P0001',
  'a globally matched idempotency key for another application is rejected'
);

insert into resubmit_ids (key, id)
select 'omitted_statement_app', id
from public.submit_application_tx(
  'e0000000-0000-0000-0000-000000000004'::uuid,
  'phase1-resubmit',
  'resubmit-submit-omitted-statement',
  'kept original statement',
  null,
  null,
  null,
  null
);

with started as (
  select public.start_review_tx(
    (select id from resubmit_ids where key = 'omitted_statement_app'),
    'e0000000-0000-0000-0000-000000000003'::uuid,
    'resubmit-start-omitted-statement'
  )
)
select ok(true, 'start_review_tx prepares the omitted statement fixture')
from started;

with requested as (
  select public.request_more_info_tx(
    (select id from resubmit_ids where key = 'omitted_statement_app'),
    'e0000000-0000-0000-0000-000000000003'::uuid,
    'needs_identity_clarification',
    'resubmit-more-info-omitted-statement',
    '보완 안내',
    'omitted statement review summary'
  )
)
select ok(true, 'request_more_info_tx prepares the omitted statement fixture')
from requested;

select is(
  (
    public.admission_resubmit(
      (select id from resubmit_ids where key = 'omitted_statement_app'),
      'e0000000-0000-0000-0000-000000000004'::uuid,
      null,
      'resubmit-omitted-statement'
    )
  ).applicant_statement,
  'kept original statement',
  'omitted statement keeps the previous applicant statement'
);

select ok(
  public.audit_hash_chain_verify(),
  'audit hash chain verifies after admission_resubmit'
);

reset role;
set local role authenticated;

select is(
  pg_temp.sqlstate_for(
    format(
      'select public.admission_resubmit(%L::uuid, %L::uuid, %L, %L)',
      (select id::text from resubmit_ids where key = 'main_app'),
      'e0000000-0000-0000-0000-000000000001',
      'authenticated call',
      'resubmit-authenticated-denied'
    )
  ),
  '42501',
  'authenticated role cannot execute admission_resubmit directly'
);

reset role;
set local role anon;

select is(
  pg_temp.sqlstate_for(
    format(
      'select public.admission_resubmit(%L::uuid, %L::uuid, %L, %L)',
      (select id::text from resubmit_ids where key = 'main_app'),
      'e0000000-0000-0000-0000-000000000001',
      'anon call',
      'resubmit-anon-denied'
    )
  ),
  '42501',
  'anon role cannot execute admission_resubmit directly'
);

reset role;

select * from finish();

rollback;

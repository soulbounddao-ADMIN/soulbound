create extension if not exists pgtap with schema extensions;

begin;

set search_path = public, extensions;

select no_plan();

create function pg_temp.create_audit_chain_user(
  p_id uuid,
  p_handle text
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
    'audit hash chain test user',
    replace(p_handle, '-', '_'),
    'applicant',
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

select pg_temp.create_audit_chain_user(
  'd0000000-0000-0000-0000-000000000101'::uuid,
  'audit-chain-approve'
);
select pg_temp.create_audit_chain_user(
  'd0000000-0000-0000-0000-000000000102'::uuid,
  'audit-chain-reject'
);
select pg_temp.create_audit_chain_user(
  'd0000000-0000-0000-0000-000000000103'::uuid,
  'audit-chain-info'
);

create temp table audit_chain_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update, delete on audit_chain_ids to service_role, authenticated;

set local role service_role;

insert into public.audit_logs (
  actor_id,
  action,
  entity_type,
  entity_id,
  reason_code,
  metadata
)
values (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'role.changed',
  'profile',
  'a0000000-0000-0000-0000-000000000002'::uuid,
  null,
  jsonb_build_object('test', 'audit_hash_chain', 'path', 'adapter_equivalent')
);

insert into audit_chain_ids (key, id)
select
  'approve_app',
  id
from public.submit_application_tx(
  'd0000000-0000-0000-0000-000000000101'::uuid,
  'phase1-audit-chain',
  'audit-chain-submit-approve',
  'approval applicant statement',
  'approval motivation',
  null,
  null,
  null
);

with started as (
  select public.start_review_tx(
    (select id from audit_chain_ids where key = 'approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'audit-chain-start-approve'
  )
)
select ok(true, 'start_review_tx executes for approve branch')
from started;

with approved as (
  select public.approve_application_tx(
    (select id from audit_chain_ids where key = 'approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'meets_phase1_policy',
    'audit-chain-approve',
    'approved notice',
    'audit-chain internal summary'
  )
)
select ok(true, 'approve_application_tx executes for approve branch')
from approved;

insert into audit_chain_ids (key, id)
select
  'reject_app',
  id
from public.submit_application_tx(
  'd0000000-0000-0000-0000-000000000102'::uuid,
  'phase1-audit-chain',
  'audit-chain-submit-reject',
  'reject applicant statement',
  'reject motivation',
  null,
  null,
  null
);

with started as (
  select public.start_review_tx(
    (select id from audit_chain_ids where key = 'reject_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'audit-chain-start-reject'
  )
)
select ok(true, 'start_review_tx executes for reject branch')
from started;

with rejected as (
  select public.reject_application_tx(
    (select id from audit_chain_ids where key = 'reject_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'mismatch_with_policy',
    'audit-chain-reject',
    'reject notice',
    'audit-chain reject summary'
  )
)
select ok(true, 'reject_application_tx executes for reject branch')
from rejected;

insert into audit_chain_ids (key, id)
select
  'info_app',
  id
from public.submit_application_tx(
  'd0000000-0000-0000-0000-000000000103'::uuid,
  'phase1-audit-chain',
  'audit-chain-submit-info',
  'info applicant statement',
  'info motivation',
  null,
  null,
  null
);

with started as (
  select public.start_review_tx(
    (select id from audit_chain_ids where key = 'info_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'audit-chain-start-info'
  )
)
select ok(true, 'start_review_tx executes for more-info branch')
from started;

with requested as (
  select public.request_more_info_tx(
    (select id from audit_chain_ids where key = 'info_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'needs_identity_clarification',
    'audit-chain-info',
    'more info notice',
    'audit-chain info summary'
  )
)
select ok(true, 'request_more_info_tx executes for more-info branch')
from requested;

select ok(
  public.audit_hash_chain_verify(),
  'audit hash chain verifies after adapter-equivalent and RPC inserts'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'role.changed'
      and metadata->>'path' = 'adapter_equivalent'
      and hash is not null
      and previous_hash is not null
  ),
  'adapter-equivalent audit insert receives hash and previous_hash'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'application.submit'
      and entity_id = (select id from audit_chain_ids where key = 'approve_app')
      and hash is not null
      and previous_hash is not null
  ),
  'submit_application_tx audit row is chained'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'application.review_started'
      and entity_id = (select id from audit_chain_ids where key = 'approve_app')
      and hash is not null
      and previous_hash is not null
  ),
  'start_review_tx audit row is chained'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'application.approved'
      and entity_id = (select id from audit_chain_ids where key = 'approve_app')
      and hash is not null
      and previous_hash is not null
  ),
  'approve_application_tx application.approved audit row is chained'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'membership.issued'
      and metadata->>'source_application_id' = (
        select id::text from audit_chain_ids where key = 'approve_app'
      )
      and hash is not null
      and previous_hash is not null
  ),
  'approve_application_tx membership.issued audit row is chained'
);

select is(
  (
    select issued.previous_hash
    from public.audit_logs issued
    where issued.action = 'membership.issued'
      and issued.metadata->>'source_application_id' = (
        select id::text from audit_chain_ids where key = 'approve_app'
      )
  ),
  (
    select approved.hash
    from public.audit_logs approved
    where approved.action = 'application.approved'
      and approved.entity_id = (
        select id from audit_chain_ids where key = 'approve_app'
      )
  ),
  'approve_application_tx chains membership.issued after application.approved in the same transaction'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'application.rejected'
      and entity_id = (select id from audit_chain_ids where key = 'reject_app')
      and hash is not null
      and previous_hash is not null
  ),
  'reject_application_tx audit row is chained'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'application.more_info_requested'
      and entity_id = (select id from audit_chain_ids where key = 'info_app')
      and hash is not null
      and previous_hash is not null
  ),
  'request_more_info_tx audit row is chained'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where previous_hash = public.audit_hash_chain_genesis()
  ),
  1,
  'exactly one audit row uses the fixed genesis sentinel'
);

update public.audit_logs
  set metadata = metadata || jsonb_build_object('tampered', true)
where id = (
  select id
  from public.audit_logs
  where action = 'application.approved'
    and entity_id = (select id from audit_chain_ids where key = 'approve_app')
);

select is(
  public.audit_hash_chain_verify(),
  false,
  'tampering with a chained audit row breaks verification'
);

select * from finish();

rollback;

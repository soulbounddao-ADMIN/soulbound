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

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  role,
  raw_app_meta_data,
  raw_user_meta_data
)
values (
  'b0000000-0000-0000-0000-000000000004',
  'other-applicant@soulbound.local',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  'authenticated',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"smoke_other_applicant"}'::jsonb
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
  'b0000000-0000-0000-0000-000000000004',
  'other-applicant',
  'Other Applicant',
  'RLS smoke-test applicant',
  'smoke_other_applicant',
  'applicant',
  'none'
)
on conflict (id) do update
  set handle = excluded.handle,
      display_name = excluded.display_name,
      bio = excluded.bio,
      username = excluded.username,
      role = excluded.role,
      membership_status = excluded.membership_status;

create temp table smoke_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update, delete on smoke_ids to service_role, authenticated;

set local role service_role;

insert into smoke_ids (key, id)
select
  'approve_app',
  id
from public.submit_application_tx(
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'phase1-v0.95',
  'smoke-submit-approve',
  'approval applicant statement',
  'approval motivation',
  null,
  null,
  null
);

select is(
  (
    select status::text
    from public.admission_applications
    where id = (select id from smoke_ids where key = 'approve_app')
  ),
  'submitted',
  'submit_application_tx creates a submitted application'
);

select is(
  (
    public.start_review_tx(
      (select id from smoke_ids where key = 'approve_app'),
      'a0000000-0000-0000-0000-000000000002'::uuid,
      'smoke-start-approve'
    )
  ).status::text,
  'under_review',
  'start_review_tx transitions submitted to under_review'
);

with outcome as (
  select public.approve_application_tx(
    (select id from smoke_ids where key = 'approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'meets_phase1_policy',
    'smoke-approve',
    'approved notice',
    'SECRET_REVIEW_SUMMARY_SMOKE'
  ) as r
)
select is(
  (((r).application).status)::text,
  'approved',
  'approve_application_tx composite includes approved application'
)
from outcome;

with outcome as (
  select public.approve_application_tx(
    (select id from smoke_ids where key = 'approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'meets_phase1_policy',
    'smoke-approve',
    'approved notice replay',
    'SECRET_REVIEW_SUMMARY_SMOKE_REPLAY'
  ) as r
)
select is(
  (((r).membership).status)::text,
  'active',
  'approve_application_tx composite includes active membership'
)
from outcome;

with outcome as (
  select public.approve_application_tx(
    (select id from smoke_ids where key = 'approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'meets_phase1_policy',
    'smoke-approve',
    'approved notice replay',
    'SECRET_REVIEW_SUMMARY_SMOKE_REPLAY'
  ) as r
)
select is(
  (((r).membership).tier)::text,
  'basic',
  'approve_application_tx composite includes basic membership tier'
)
from outcome;

with outcome as (
  select public.approve_application_tx(
    (select id from smoke_ids where key = 'approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'meets_phase1_policy',
    'smoke-approve',
    'approved notice replay',
    'SECRET_REVIEW_SUMMARY_SMOKE_REPLAY'
  ) as r
)
select isnt(
  (((r).membership).id)::text,
  null,
  'approve_application_tx composite includes membership id'
)
from outcome;

select is(
  (
    select status::text
    from public.memberships
    where source_application_id = (select id from smoke_ids where key = 'approve_app')
  ),
  'active',
  'approve_application_tx creates an active membership row'
);

select is(
  (
    select tier::text
    from public.memberships
    where source_application_id = (select id from smoke_ids where key = 'approve_app')
  ),
  'basic',
  'approve_application_tx creates a basic membership'
);

select is(
  (
    select membership_status::text
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000003'::uuid
  ),
  'active',
  'approve_application_tx activates the applicant profile'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where (
      action = 'application.approved'
      and entity_id = (select id from smoke_ids where key = 'approve_app')
    )
    or (
      action = 'membership.issued'
      and metadata->>'source_application_id' = (
        select id::text from smoke_ids where key = 'approve_app'
      )
    )
  ),
  2,
  'approve_application_tx writes application.approved and membership.issued audit rows'
);

with replay as (
  select public.approve_application_tx(
    (select id from smoke_ids where key = 'approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'meets_phase1_policy',
    'smoke-approve',
    'approved notice replay',
    'SECRET_REVIEW_SUMMARY_SMOKE_REPLAY'
  ) as r
)
select is(
  (((r).application).id)::text,
  (select id::text from smoke_ids where key = 'approve_app'),
  'approve_application_tx idempotency replay returns the same application'
)
from replay;

select is(
  (
    select count(*)::int
    from public.admission_events
    where idempotency_key = 'smoke-approve'
  ),
  1,
  'approve idempotency replay does not duplicate admission_events'
);

select is(
  (
    select count(*)::int
    from public.memberships
    where source_application_id = (select id from smoke_ids where key = 'approve_app')
  ),
  1,
  'approve idempotency replay does not duplicate membership rows'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where (
      action = 'application.approved'
      and entity_id = (select id from smoke_ids where key = 'approve_app')
    )
    or (
      action = 'membership.issued'
      and metadata->>'source_application_id' = (
        select id::text from smoke_ids where key = 'approve_app'
      )
    )
  ),
  2,
  'approve idempotency replay does not duplicate approve audit rows'
);

select is(
  pg_temp.sqlstate_for(format(
    $sql$
      select public.approve_application_tx(
        %L::uuid,
        'a0000000-0000-0000-0000-000000000002'::uuid,
        'meets_phase1_policy',
        'smoke-approve-invalid-state',
        null,
        null
      )
    $sql$,
    (select id from smoke_ids where key = 'approve_app')
  )),
  'P0001',
  'approving an already-approved application raises P0001'
);

select is(
  pg_temp.sqlstate_for(
    $sql$
      select public.approve_application_tx(
        '00000000-0000-0000-0000-000000000404'::uuid,
        'a0000000-0000-0000-0000-000000000002'::uuid,
        'meets_phase1_policy',
        'smoke-approve-missing',
        null,
        null
      )
    $sql$
  ),
  'P0002',
  'approving a missing application raises P0002'
);

insert into smoke_ids (key, id)
select
  'bogus_reason_app',
  id
from public.submit_application_tx(
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'phase1-v0.95',
  'smoke-submit-bogus-reason',
  null,
  null,
  null,
  null,
  null
);

do $$
begin
  perform public.start_review_tx(
    (select id from smoke_ids where key = 'bogus_reason_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'smoke-start-bogus-reason'
  );
end;
$$;

select is(
  pg_temp.sqlstate_for(format(
    $sql$
      select public.approve_application_tx(
        %L::uuid,
        'a0000000-0000-0000-0000-000000000002'::uuid,
        'not_a_reason',
        'smoke-approve-bogus-reason',
        null,
        null
      )
    $sql$,
    (select id from smoke_ids where key = 'bogus_reason_app')
  )),
  'P0001',
  'bogus approve reason_code raises P0001'
);

do $$
begin
  perform public.reject_application_tx(
    (select id from smoke_ids where key = 'bogus_reason_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'mismatch_with_policy',
    'smoke-reject-bogus-reason-app',
    null,
    null
  );
end;
$$;

select ok(
  not exists (
    select 1
    from public.audit_logs
    where metadata::text like '%SECRET_REVIEW_SUMMARY_SMOKE%'
  ),
  'audit metadata does not include review_summary text'
);

select ok(
  not exists (
    select 1
    from public.admission_events
    where reason_code is not null
    and reason_code not in (
      'meets_phase1_policy',
      'insufficient_context',
      'mismatch_with_policy',
      'needs_identity_clarification',
      'duplicate_identity_suspected',
      'applicant_withdrew',
      'application_expired'
    )
  ),
  'admission_events reason_code values stay within the frozen enum'
);

insert into public.persona_clip_assets (
  id,
  applicant_id,
  storage_provider,
  storage_path,
  content_hash,
  mime_type,
  size_bytes,
  status
)
values (
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'b0000000-0000-0000-0000-000000000004'::uuid,
  'supabase',
  'b0000000-0000-0000-0000-000000000004/SECRET_STORAGE_PATH_SMOKE_APPROVE.webm',
  'clip-hash-approve',
  'video/webm',
  123,
  'draft'
);

insert into smoke_ids (key, id)
select
  'clip_approve_app',
  id
from public.submit_application_tx(
  'b0000000-0000-0000-0000-000000000004'::uuid,
  'phase1-v0.95',
  'smoke-submit-clip-approve',
  null,
  null,
  null,
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'clip-hash-approve'
);

do $$
begin
  perform public.start_review_tx(
    (select id from smoke_ids where key = 'clip_approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'smoke-start-clip-approve'
  );

  perform public.approve_application_tx(
    (select id from smoke_ids where key = 'clip_approve_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'meets_phase1_policy',
    'smoke-approve-clip',
    null,
    null
  );
end;
$$;

select ok(
  exists (
    select 1
    from public.persona_clip_assets
    where id = 'c0000000-0000-0000-0000-000000000001'::uuid
      and delete_after is not null
      and deletion_reason = 'application_approved'
  ),
  'approve marks persona clip for deletion without deleting the row'
);

insert into public.persona_clip_assets (
  id,
  applicant_id,
  storage_provider,
  storage_path,
  content_hash,
  mime_type,
  size_bytes,
  status
)
values (
  'c0000000-0000-0000-0000-000000000002'::uuid,
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'supabase',
  'a0000000-0000-0000-0000-000000000003/SECRET_STORAGE_PATH_SMOKE_REJECT.webm',
  'clip-hash-reject',
  'video/webm',
  456,
  'draft'
);

insert into smoke_ids (key, id)
select
  'clip_reject_app',
  id
from public.submit_application_tx(
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'phase1-v0.95',
  'smoke-submit-clip-reject',
  null,
  null,
  null,
  'c0000000-0000-0000-0000-000000000002'::uuid,
  'clip-hash-reject'
);

do $$
begin
  perform public.start_review_tx(
    (select id from smoke_ids where key = 'clip_reject_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'smoke-start-clip-reject'
  );
end;
$$;

select is(
  (
    public.reject_application_tx(
      (select id from smoke_ids where key = 'clip_reject_app'),
      'a0000000-0000-0000-0000-000000000002'::uuid,
      'mismatch_with_policy',
      'smoke-reject-clip',
      'rejected notice',
      null
    )
  ).status::text,
  'rejected',
  'reject_application_tx transitions to rejected'
);

select ok(
  exists (
    select 1
    from public.persona_clip_assets
    where id = 'c0000000-0000-0000-0000-000000000002'::uuid
      and delete_after is not null
      and deletion_reason = 'application_rejected'
  ),
  'reject marks persona clip for deletion without deleting the row'
);

select ok(
  not exists (
    select 1
    from public.audit_logs
    where metadata::text like '%SECRET_STORAGE_PATH_SMOKE%'
  ),
  'audit metadata does not include persona clip storage_path after clip approve/reject'
);

insert into smoke_ids (key, id)
select
  'more_info_app',
  id
from public.submit_application_tx(
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'phase1-v0.95',
  'smoke-submit-more-info',
  null,
  null,
  null,
  null,
  null
);

do $$
begin
  perform public.start_review_tx(
    (select id from smoke_ids where key = 'more_info_app'),
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'smoke-start-more-info'
  );
end;
$$;

select is(
  (
    public.request_more_info_tx(
      (select id from smoke_ids where key = 'more_info_app'),
      'a0000000-0000-0000-0000-000000000002'::uuid,
      'needs_identity_clarification',
      'smoke-more-info',
      'more info notice',
      null
    )
  ).status::text,
  'needs_more_info',
  'request_more_info_tx transitions to needs_more_info'
);

insert into smoke_ids (key, id)
select
  'other_app',
  id
from public.submit_application_tx(
  'b0000000-0000-0000-0000-000000000004'::uuid,
  'phase1-v0.95',
  'smoke-submit-other-applicant',
  'other applicant statement',
  null,
  null,
  null,
  null
);

reset role;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    'a0000000-0000-0000-0000-000000000003',
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;
set local role authenticated;

select is(
  auth.uid(),
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'authenticated smoke session resolves auth.uid() to seeded applicant'
);

select is(
  public.current_user_role(),
  'applicant',
  'current_user_role returns applicant for seeded applicant session'
);

select is(
  pg_temp.sqlstate_for(format(
    $sql$
      select
        id,
        applicant_id,
        status,
        applicant_statement,
        motivation,
        referral_code,
        reviewer_id,
        reviewed_at,
        applicant_notice,
        policy_version,
        policy_snapshot_hash,
        persona_clip_asset_id,
        persona_clip_hash,
        ledger_ticket_ref,
        ledger_tx_ref,
        created_at,
        updated_at
      from public.admission_applications
      where id = %L::uuid
    $sql$,
    (select id from smoke_ids where key = 'approve_app')
  )),
  '00000',
  'authenticated applicant can select safe columns on own application'
);

select is(
  (
    select count(*)::int
    from public.admission_applications
    where id = (select id from smoke_ids where key = 'approve_app')
  ),
  1,
  'authenticated applicant sees exactly one own application row'
);

select is(
  pg_temp.sqlstate_for(format(
    $sql$
      select review_summary
      from public.admission_applications
      where id = %L::uuid
    $sql$,
    (select id from smoke_ids where key = 'approve_app')
  )),
  '42501',
  'authenticated applicant cannot select review_summary'
);

select is(
  (
    select count(*)::int
    from public.admission_applications
    where id = (select id from smoke_ids where key = 'other_app')
  ),
  0,
  'authenticated applicant sees zero rows for another applicant application'
);

select is(
  pg_temp.sqlstate_for(
    'select role from public.profiles where id = auth.uid()'
  ),
  '42501',
  'authenticated applicant cannot select profiles.role'
);

select is(
  pg_temp.sqlstate_for(
    'update public.profiles set role = ''admin'' where id = auth.uid()'
  ),
  '42501',
  'authenticated applicant cannot update profiles.role'
);

select is(
  pg_temp.sqlstate_for(
    'update public.profiles set membership_status = ''active'' where id = auth.uid()'
  ),
  '42501',
  'authenticated applicant cannot update profiles.membership_status'
);

select is(
  pg_temp.sqlstate_for(format(
    $sql$
      select public.approve_application_tx(
        %L::uuid,
        auth.uid(),
        'meets_phase1_policy',
        'smoke-authenticated-approve-denied',
        null,
        null
      )
    $sql$,
    (select id from smoke_ids where key = 'more_info_app')
  )),
  '42501',
  'authenticated applicant cannot execute approve_application_tx directly'
);

select is(
  pg_temp.sqlstate_for(
    'select source_application_id from public.memberships where user_id = auth.uid()'
  ),
  '42501',
  'authenticated applicant cannot select memberships.source_application_id'
);

select is(
  pg_temp.sqlstate_for(
    'select ledger_credential_ref from public.memberships where user_id = auth.uid()'
  ),
  '42501',
  'authenticated applicant cannot select memberships.ledger_credential_ref'
);

select is(
  pg_temp.sqlstate_for(
    'select count(*) from public.audit_logs'
  ),
  '42501',
  'authenticated applicant cannot select audit_logs'
);

select is(
  pg_temp.sqlstate_for(
    'select count(*) from public.outbox_events'
  ),
  '42501',
  'authenticated applicant cannot select outbox_events'
);

reset role;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    'a0000000-0000-0000-0000-000000000001',
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;
set local role authenticated;

select is(
  auth.uid(),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'authenticated smoke session resolves auth.uid() to seeded admin'
);

select is(
  public.current_user_role(),
  'admin',
  'current_user_role returns admin for seeded admin session'
);

reset role;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    'a0000000-0000-0000-0000-000000000002',
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;
set local role authenticated;

select is(
  auth.uid(),
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'authenticated smoke session resolves auth.uid() to seeded reviewer'
);

select is(
  public.current_user_role(),
  'reviewer',
  'current_user_role returns reviewer for seeded reviewer session'
);

reset role;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated","user_metadata":{"role":"reviewer"},"app_metadata":{"role":"reviewer"}}',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    'a0000000-0000-0000-0000-000000000003',
    true
  );
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;
set local role authenticated;

select is(
  auth.uid(),
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'forged-role smoke session still resolves auth.uid() to seeded applicant'
);

select is(
  public.current_user_role(),
  'applicant',
  'current_user_role ignores forged role claims and returns profile role'
);

reset role;

set local role anon;

select is(
  pg_temp.sqlstate_for('select public.current_user_role()'),
  '42501',
  'anon cannot execute current_user_role'
);

reset role;

select is(
  (
    select role::text
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000003'::uuid
  ),
  'applicant',
  'denied authenticated role update leaves profile role as applicant'
);

select ok(
  not exists (
    select 1
    from auth.users
    where id in (
      'a0000000-0000-0000-0000-000000000001'::uuid,
      'a0000000-0000-0000-0000-000000000002'::uuid,
      'a0000000-0000-0000-0000-000000000003'::uuid
    )
    and raw_app_meta_data ? 'role'
  ),
  'seeded users do not yet have trusted app_metadata role'
);

select ok(
  not exists (
    select 1
    from auth.users
    where id in (
      'a0000000-0000-0000-0000-000000000001'::uuid,
      'a0000000-0000-0000-0000-000000000002'::uuid,
      'a0000000-0000-0000-0000-000000000003'::uuid,
      'b0000000-0000-0000-0000-000000000004'::uuid
    )
    and raw_user_meta_data ? 'role'
  ),
  'seeded and smoke-test users do not have user_metadata role'
);

select is(
  (
    select role::text
    from public.profiles
    where id = 'a0000000-0000-0000-0000-000000000002'::uuid
  ),
  'reviewer',
  'seeded reviewer profile role is populated'
);

select * from finish();

rollback;

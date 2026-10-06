alter table public.profiles
  add column if not exists username text,
  add column if not exists member_number bigint;

with normalized as (
  select
    p.id,
    lower(
      regexp_replace(
        coalesce(nullif(split_part(u.email, '@', 1), ''), 'member'),
        '[^a-z0-9_-]',
        '_',
        'g'
      )
    ) as raw_base
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.username is null
),
candidates as (
  select
    id,
    case
      when length(trim(both '_' from raw_base)) < 3 then 'member'
      else left(trim(both '_' from raw_base), 20)
    end as base
  from normalized
),
numbered as (
  select
    id,
    base,
    row_number() over (partition by base order by id) as duplicate_index
  from candidates
)
update public.profiles p
  set username = case
    when n.duplicate_index = 1 then n.base
    else left(n.base, 20) || '_' || n.duplicate_index::text
  end
from numbered n
where p.id = n.id
  and p.username is null;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format_chk
    check (username ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  add constraint profiles_member_number_positive_chk
    check (member_number is null or member_number > 0);

create unique index if not exists profiles_username_key
  on public.profiles(username);

create unique index if not exists profiles_member_number_key
  on public.profiles(member_number)
  where member_number is not null;

create sequence if not exists public.member_numbers_seq;

with active_members as (
  select
    p.id,
    row_number() over (
      order by coalesce(min(m.issued_at), p.created_at), p.created_at, p.id
    ) as next_number
  from public.profiles p
  left join public.memberships m
    on m.user_id = p.id
   and m.status = 'active'
  where p.membership_status = 'active'
    and p.member_number is null
  group by p.id, p.created_at
)
update public.profiles p
  set member_number = active_members.next_number
from active_members
where p.id = active_members.id;

select setval(
  'public.member_numbers_seq',
  greatest(coalesce((select max(member_number) from public.profiles), 0) + 1, 1),
  false
);

grant select (member_number) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
begin
  v_username := lower(trim(new.raw_user_meta_data->>'username'));

  if v_username is null
     or v_username !~ '^[a-z0-9][a-z0-9_-]{2,23}$' then
    raise exception 'valid username is required' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, role, username)
  values (new.id, 'applicant', v_username)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.approve_application_tx(
  p_application_id uuid,
  p_actor_id uuid,
  p_reason_code text,
  p_idempotency_key text,
  p_applicant_notice text default null,
  p_review_summary text default null
)
returns public.approve_outcome
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.admission_applications%rowtype;
  v_membership public.memberships%rowtype;
  v_existing_application_id uuid;
  v_from_status text;
  v_outcome public.approve_outcome;
  v_clip_asset_id uuid;
  v_member_number bigint;
begin
  if p_reason_code is null
     or p_reason_code not in (
       'meets_phase1_policy',
       'insufficient_context',
       'mismatch_with_policy',
       'needs_identity_clarification',
       'duplicate_identity_suspected',
       'applicant_withdrew',
       'application_expired'
     ) then
    raise exception 'invalid reason code' using errcode = 'P0001';
  end if;

  select e.application_id
    into v_existing_application_id
  from public.admission_events e
  where e.idempotency_key = p_idempotency_key
  limit 1;

  if v_existing_application_id is not null then
    select *
      into v_app
    from public.admission_applications
    where id = v_existing_application_id;

    select *
      into v_membership
    from public.memberships
    where source_application_id = v_existing_application_id
    limit 1;

    v_outcome.application := v_app;
    v_outcome.membership := v_membership;
    return v_outcome;
  end if;

  select *
    into v_app
  from public.admission_applications
  where id = p_application_id;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  if v_app.status not in ('under_review', 'needs_more_info') then
    raise exception 'cannot approve from status %', v_app.status using errcode = 'P0001';
  end if;

  v_from_status := v_app.status;
  v_clip_asset_id := v_app.persona_clip_asset_id;

  update public.admission_applications
    set status = 'approved',
        reviewer_id = p_actor_id,
        reviewed_at = now(),
        review_summary = p_review_summary,
        applicant_notice = p_applicant_notice,
        applicant_statement = null,
        motivation = null,
        referral_code = null,
        persona_clip_asset_id = null,
        persona_clip_hash = null,
        updated_at = now()
  where id = p_application_id
  returning * into v_app;

  insert into public.memberships (
    user_id,
    status,
    tier,
    source_application_id
  )
  values (
    v_app.applicant_id,
    'active',
    'basic',
    p_application_id
  )
  returning * into v_membership;

  update public.profiles
    set membership_status = 'active',
        member_number = coalesce(
          member_number,
          nextval('public.member_numbers_seq'::regclass)
        ),
        updated_at = now()
  where id = v_app.applicant_id
  returning member_number into v_member_number;

  insert into public.admission_events (
    application_id,
    actor_id,
    from_status,
    to_status,
    reason_code,
    idempotency_key
  )
  values (
    p_application_id,
    p_actor_id,
    v_from_status,
    'approved',
    p_reason_code,
    p_idempotency_key
  );

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason_code,
    metadata
  )
  values (
    p_actor_id,
    'application.approved',
    'admission_application',
    p_application_id,
    p_reason_code,
    jsonb_build_object(
      'from_status', v_from_status,
      'to_status', 'approved',
      'reason_code', p_reason_code,
      'policy_version', v_app.policy_version
    )
  );

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason_code,
    metadata
  )
  values (
    p_actor_id,
    'membership.issued',
    'membership',
    v_membership.id,
    p_reason_code,
    jsonb_build_object(
      'user_id', v_membership.user_id,
      'member_number', v_member_number,
      'tier', v_membership.tier,
      'source_application_id', p_application_id,
      'policy_version', v_app.policy_version
    )
  );

  if v_clip_asset_id is not null then
    update public.persona_clip_assets
      set delete_after = now(),
          deletion_reason = 'application_approved'
    where id = v_clip_asset_id;
  end if;

  v_outcome.application := v_app;
  v_outcome.membership := v_membership;
  return v_outcome;
end;
$$;

create or replace function public.reject_application_tx(
  p_application_id uuid,
  p_actor_id uuid,
  p_reason_code text,
  p_idempotency_key text,
  p_applicant_notice text default null,
  p_review_summary text default null
)
returns public.admission_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.admission_applications%rowtype;
  v_existing_application_id uuid;
  v_from_status text;
  v_clip_asset_id uuid;
begin
  if p_reason_code is null
     or p_reason_code not in (
       'meets_phase1_policy',
       'insufficient_context',
       'mismatch_with_policy',
       'needs_identity_clarification',
       'duplicate_identity_suspected',
       'applicant_withdrew',
       'application_expired'
     ) then
    raise exception 'invalid reason code' using errcode = 'P0001';
  end if;

  select e.application_id
    into v_existing_application_id
  from public.admission_events e
  where e.idempotency_key = p_idempotency_key
  limit 1;

  if v_existing_application_id is not null then
    select *
      into v_app
    from public.admission_applications
    where id = v_existing_application_id;

    return v_app;
  end if;

  select *
    into v_app
  from public.admission_applications
  where id = p_application_id;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  if v_app.status not in ('under_review', 'needs_more_info') then
    raise exception 'cannot reject from status %', v_app.status using errcode = 'P0001';
  end if;

  v_from_status := v_app.status;
  v_clip_asset_id := v_app.persona_clip_asset_id;

  update public.admission_applications
    set status = 'rejected',
        reviewer_id = p_actor_id,
        reviewed_at = now(),
        review_summary = p_review_summary,
        applicant_notice = p_applicant_notice,
        applicant_statement = null,
        motivation = null,
        referral_code = null,
        persona_clip_asset_id = null,
        persona_clip_hash = null,
        updated_at = now()
  where id = p_application_id
  returning * into v_app;

  insert into public.admission_events (
    application_id,
    actor_id,
    from_status,
    to_status,
    reason_code,
    idempotency_key
  )
  values (
    p_application_id,
    p_actor_id,
    v_from_status,
    'rejected',
    p_reason_code,
    p_idempotency_key
  );

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason_code,
    metadata
  )
  values (
    p_actor_id,
    'application.rejected',
    'admission_application',
    p_application_id,
    p_reason_code,
    jsonb_build_object(
      'from_status', v_from_status,
      'to_status', 'rejected',
      'reason_code', p_reason_code,
      'policy_version', v_app.policy_version
    )
  );

  if v_clip_asset_id is not null then
    update public.persona_clip_assets
      set delete_after = now(),
          deletion_reason = 'application_rejected'
    where id = v_clip_asset_id;
  end if;

  return v_app;
end;
$$;

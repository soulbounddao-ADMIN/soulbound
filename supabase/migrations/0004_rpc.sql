create type public.approve_outcome as (
  application public.admission_applications,
  membership public.memberships
);

create or replace function public.submit_application_tx(
  p_applicant_id uuid,
  p_policy_version text,
  p_idempotency_key text,
  p_applicant_statement text default null,
  p_motivation text default null,
  p_referral_code text default null,
  p_persona_clip_asset_id uuid default null,
  p_persona_clip_hash text default null
)
returns public.admission_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.admission_applications%rowtype;
  v_existing_application_id uuid;
begin
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

  if p_persona_clip_asset_id is not null
     and not exists (
       select 1
       from public.persona_clip_assets c
       where c.id = p_persona_clip_asset_id
         and c.applicant_id = p_applicant_id
     ) then
    raise exception 'persona clip asset not found for applicant' using errcode = 'P0002';
  end if;

  insert into public.admission_applications (
    applicant_id,
    status,
    applicant_statement,
    motivation,
    referral_code,
    policy_version,
    persona_clip_asset_id,
    persona_clip_hash
  )
  values (
    p_applicant_id,
    'submitted',
    p_applicant_statement,
    p_motivation,
    p_referral_code,
    p_policy_version,
    p_persona_clip_asset_id,
    p_persona_clip_hash
  )
  returning * into v_app;

  if p_persona_clip_asset_id is not null then
    update public.persona_clip_assets
      set application_id = v_app.id,
          status = 'attached'
    where id = p_persona_clip_asset_id
      and applicant_id = p_applicant_id;
  end if;

  insert into public.admission_events (
    application_id,
    actor_id,
    from_status,
    to_status,
    reason_code,
    idempotency_key
  )
  values (
    v_app.id,
    p_applicant_id,
    'draft',
    'submitted',
    null,
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
    p_applicant_id,
    'application.submit',
    'admission_application',
    v_app.id,
    null,
    jsonb_build_object(
      'from_status', 'draft',
      'to_status', 'submitted',
      'policy_version', p_policy_version
    )
  );

  return v_app;
end;
$$;

revoke execute on function public.submit_application_tx(
  uuid, text, text, text, text, text, uuid, text
) from anon, authenticated, public;
grant execute on function public.submit_application_tx(
  uuid, text, text, text, text, text, uuid, text
) to service_role;

create or replace function public.start_review_tx(
  p_application_id uuid,
  p_actor_id uuid,
  p_idempotency_key text
)
returns public.admission_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.admission_applications%rowtype;
  v_existing_application_id uuid;
begin
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

  if v_app.status != 'submitted' then
    raise exception 'cannot start review from status %', v_app.status using errcode = 'P0001';
  end if;

  update public.admission_applications
    set status = 'under_review',
        reviewer_id = p_actor_id,
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
    'submitted',
    'under_review',
    null,
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
    'application.review_started',
    'admission_application',
    p_application_id,
    null,
    jsonb_build_object(
      'from_status', 'submitted',
      'to_status', 'under_review'
    )
  );

  return v_app;
end;
$$;

revoke execute on function public.start_review_tx(
  uuid, uuid, text
) from anon, authenticated, public;
grant execute on function public.start_review_tx(
  uuid, uuid, text
) to service_role;

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

  update public.admission_applications
    set status = 'approved',
        reviewer_id = p_actor_id,
        reviewed_at = now(),
        review_summary = p_review_summary,
        applicant_notice = p_applicant_notice,
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
        updated_at = now()
  where id = v_app.applicant_id;

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
      'membership_id', v_membership.id,
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
      'tier', v_membership.tier,
      'source_application_id', p_application_id,
      'policy_version', v_app.policy_version
    )
  );

  if v_app.persona_clip_asset_id is not null then
    update public.persona_clip_assets
      set delete_after = now(),
          deletion_reason = 'application_approved'
    where id = v_app.persona_clip_asset_id;
  end if;

  v_outcome.application := v_app;
  v_outcome.membership := v_membership;
  return v_outcome;
end;
$$;

revoke execute on function public.approve_application_tx(
  uuid, uuid, text, text, text, text
) from anon, authenticated, public;
grant execute on function public.approve_application_tx(
  uuid, uuid, text, text, text, text
) to service_role;

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

  update public.admission_applications
    set status = 'rejected',
        reviewer_id = p_actor_id,
        reviewed_at = now(),
        review_summary = p_review_summary,
        applicant_notice = p_applicant_notice,
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

  if v_app.persona_clip_asset_id is not null then
    update public.persona_clip_assets
      set delete_after = now(),
          deletion_reason = 'application_rejected'
    where id = v_app.persona_clip_asset_id;
  end if;

  return v_app;
end;
$$;

revoke execute on function public.reject_application_tx(
  uuid, uuid, text, text, text, text
) from anon, authenticated, public;
grant execute on function public.reject_application_tx(
  uuid, uuid, text, text, text, text
) to service_role;

create or replace function public.request_more_info_tx(
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

  if v_app.status != 'under_review' then
    raise exception 'cannot request more info from status %', v_app.status using errcode = 'P0001';
  end if;

  v_from_status := v_app.status;

  update public.admission_applications
    set status = 'needs_more_info',
        reviewer_id = p_actor_id,
        reviewed_at = now(),
        review_summary = p_review_summary,
        applicant_notice = p_applicant_notice,
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
    'needs_more_info',
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
    'application.more_info_requested',
    'admission_application',
    p_application_id,
    p_reason_code,
    jsonb_build_object(
      'from_status', v_from_status,
      'to_status', 'needs_more_info',
      'reason_code', p_reason_code,
      'policy_version', v_app.policy_version
    )
  );

  return v_app;
end;
$$;

revoke execute on function public.request_more_info_tx(
  uuid, uuid, text, text, text, text
) from anon, authenticated, public;
grant execute on function public.request_more_info_tx(
  uuid, uuid, text, text, text, text
) to service_role;

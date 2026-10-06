alter table public.audit_logs
  drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (
    action in (
      'application.submit',
      'application.resubmit',
      'application.review_started',
      'application.more_info_requested',
      'application.approved',
      'application.rejected',
      'membership.issued',
      'role.changed'
    )
  );

create or replace function public.admission_resubmit(
  p_application_id uuid,
  p_applicant_id uuid,
  p_statement text,
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
  v_from_status text;
begin
  select e.application_id
    into v_existing_application_id
  from public.admission_events e
  where e.idempotency_key = p_idempotency_key
  limit 1;

  if v_existing_application_id is not null then
    if v_existing_application_id is distinct from p_application_id then
      raise exception 'idempotency key belongs to another application' using errcode = 'P0001';
    end if;

    select *
      into v_app
    from public.admission_applications
    where id = v_existing_application_id;

    if not found then
      raise exception 'application not found' using errcode = 'P0002';
    end if;

    if v_app.applicant_id is distinct from p_applicant_id then
      raise exception 'application does not belong to applicant' using errcode = '42501';
    end if;

    return v_app;
  end if;

  select *
    into v_app
  from public.admission_applications
  where id = p_application_id;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  if v_app.applicant_id is distinct from p_applicant_id then
    raise exception 'application does not belong to applicant' using errcode = '42501';
  end if;

  if v_app.status != 'needs_more_info' then
    raise exception 'cannot resubmit from status %', v_app.status using errcode = 'P0001';
  end if;

  v_from_status := v_app.status;

  update public.admission_applications
    set status = 'submitted',
        applicant_statement = coalesce(p_statement, applicant_statement),
        applicant_notice = null,
        updated_at = now()
  where id = p_application_id
    and applicant_id = p_applicant_id
    and status = 'needs_more_info'
  returning * into v_app;

  if not found then
    raise exception 'cannot resubmit from current status' using errcode = 'P0001';
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
    p_application_id,
    p_applicant_id,
    v_from_status,
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
    'application.resubmit',
    'admission_application',
    p_application_id,
    null,
    jsonb_build_object(
      'from_status', v_from_status,
      'to_status', 'submitted'
    )
  );

  return v_app;
end;
$$;

revoke execute on function public.admission_resubmit(
  uuid, uuid, text, text
) from anon, authenticated, public;
grant execute on function public.admission_resubmit(
  uuid, uuid, text, text
) to service_role;

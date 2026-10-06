create table public.audit_hash_chain_state (
  id boolean primary key default true check (id),
  last_hash text not null,
  last_audit_log_id uuid,
  updated_at timestamptz not null default now()
);

create or replace function public.audit_hash_chain_genesis()
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.repeat('0', 64);
$$;

create or replace function public.audit_log_canonical_payload(
  p_id uuid,
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_reason_code text,
  p_metadata jsonb,
  p_created_at timestamptz,
  p_previous_hash text
)
returns text
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', p_id,
    'actor_id', p_actor_id,
    'action', p_action,
    'entity_type', p_entity_type,
    'entity_id', p_entity_id,
    'reason_code', p_reason_code,
    'metadata', coalesce(p_metadata, '{}'::jsonb),
    'created_at', pg_catalog.to_char(
      p_created_at at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    ),
    'previous_hash', p_previous_hash
  )::text;
$$;

create or replace function public.audit_log_compute_hash(
  p_id uuid,
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_reason_code text,
  p_metadata jsonb,
  p_created_at timestamptz,
  p_previous_hash text
)
returns text
language sql
stable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        public.audit_log_canonical_payload(
          p_id,
          p_actor_id,
          p_action,
          p_entity_type,
          p_entity_id,
          p_reason_code,
          p_metadata,
          p_created_at,
          p_previous_hash
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

do $$
declare
  v_previous_hash text := public.audit_hash_chain_genesis();
  v_hash text;
  v_last_audit_log_id uuid := null;
  v_row record;
begin
  for v_row in
    select
      id,
      actor_id,
      action,
      entity_type,
      entity_id,
      reason_code,
      metadata,
      created_at
    from public.audit_logs
    order by created_at asc, id asc
  loop
    v_hash := public.audit_log_compute_hash(
      v_row.id,
      v_row.actor_id,
      v_row.action,
      v_row.entity_type,
      v_row.entity_id,
      v_row.reason_code,
      v_row.metadata,
      v_row.created_at,
      v_previous_hash
    );

    update public.audit_logs
      set previous_hash = v_previous_hash,
          hash = v_hash
    where id = v_row.id;

    v_previous_hash := v_hash;
    v_last_audit_log_id := v_row.id;
  end loop;

  insert into public.audit_hash_chain_state (
    id,
    last_hash,
    last_audit_log_id
  )
  values (
    true,
    v_previous_hash,
    v_last_audit_log_id
  )
  on conflict (id) do update
    set last_hash = excluded.last_hash,
        last_audit_log_id = excluded.last_audit_log_id,
        updated_at = now();
end;
$$;

create unique index audit_logs_hash_unique_idx
  on public.audit_logs(hash)
  where hash is not null;

create unique index audit_logs_previous_hash_unique_idx
  on public.audit_logs(previous_hash)
  where previous_hash is not null;

create or replace function public.audit_logs_set_hash_chain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_hash text;
begin
  insert into public.audit_hash_chain_state (id, last_hash)
  values (true, public.audit_hash_chain_genesis())
  on conflict (id) do nothing;

  select last_hash
    into v_previous_hash
  from public.audit_hash_chain_state
  where id = true
  for update;

  if v_previous_hash is null then
    v_previous_hash := public.audit_hash_chain_genesis();
  end if;

  new.previous_hash := v_previous_hash;
  new.hash := public.audit_log_compute_hash(
    new.id,
    new.actor_id,
    new.action,
    new.entity_type,
    new.entity_id,
    new.reason_code,
    new.metadata,
    new.created_at,
    new.previous_hash
  );

  update public.audit_hash_chain_state
    set last_hash = new.hash,
        last_audit_log_id = new.id,
        updated_at = now()
  where id = true;

  return new;
end;
$$;

create trigger audit_logs_set_hash_chain_before_insert
  before insert on public.audit_logs
  for each row
  execute function public.audit_logs_set_hash_chain();

create or replace function public.audit_hash_chain_verify()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_previous_hash text := public.audit_hash_chain_genesis();
  v_last_audit_log_id uuid := null;
  v_next_count integer;
  v_row record;
  v_seen integer := 0;
  v_total integer;
  v_state record;
begin
  select pg_catalog.count(*)::integer
    into v_total
  from public.audit_logs;

  select last_hash, last_audit_log_id
    into v_state
  from public.audit_hash_chain_state
  where id = true;

  if not found then
    return false;
  end if;

  if v_total = 0 then
    return v_state.last_hash = public.audit_hash_chain_genesis()
      and v_state.last_audit_log_id is null;
  end if;

  loop
    select pg_catalog.count(*)::integer
      into v_next_count
    from public.audit_logs
    where previous_hash = v_expected_previous_hash;

    if v_next_count = 0 then
      exit;
    end if;

    if v_next_count > 1 then
      return false;
    end if;

    select
      id,
      actor_id,
      action,
      entity_type,
      entity_id,
      reason_code,
      metadata,
      hash,
      previous_hash,
      created_at
      into v_row
    from public.audit_logs
    where previous_hash = v_expected_previous_hash;

    if v_row.hash is distinct from public.audit_log_compute_hash(
      v_row.id,
      v_row.actor_id,
      v_row.action,
      v_row.entity_type,
      v_row.entity_id,
      v_row.reason_code,
      v_row.metadata,
      v_row.created_at,
      v_row.previous_hash
    ) then
      return false;
    end if;

    v_seen := v_seen + 1;
    v_expected_previous_hash := v_row.hash;
    v_last_audit_log_id := v_row.id;

    if v_seen > v_total then
      return false;
    end if;
  end loop;

  return v_seen = v_total
    and v_state.last_hash = v_expected_previous_hash
    and v_state.last_audit_log_id is not distinct from v_last_audit_log_id;
end;
$$;

revoke all on table public.audit_hash_chain_state from anon, authenticated, public;
grant select on table public.audit_hash_chain_state to service_role;

revoke all on function public.audit_hash_chain_genesis() from anon, authenticated, public;
revoke all on function public.audit_log_canonical_payload(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz,
  text
) from anon, authenticated, public;
revoke all on function public.audit_log_compute_hash(
  uuid,
  uuid,
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz,
  text
) from anon, authenticated, public;
revoke all on function public.audit_logs_set_hash_chain() from anon, authenticated, public;
revoke all on function public.audit_hash_chain_verify() from anon, authenticated, public;
grant execute on function public.audit_hash_chain_verify() to service_role;

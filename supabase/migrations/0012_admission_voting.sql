alter table public.admission_applications
  drop constraint if exists admission_applications_status_check;

alter table public.admission_applications
  add constraint admission_applications_status_check
  check (
    status in (
      'draft',
      'submitted',
      'under_review',
      'in_vote',
      'needs_more_info',
      'approved',
      'rejected',
      'withdrawn',
      'expired'
    )
  );

drop index if exists public.admission_applications_one_active_per_applicant_idx;

create unique index admission_applications_one_active_per_applicant_idx
  on public.admission_applications(applicant_id)
  where status in ('draft', 'submitted', 'under_review', 'in_vote', 'needs_more_info');

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
  '00000000-0000-4000-8000-000000001012',
  'system-vote-finalizer@soulbound.internal',
  extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"username":"system_vote_finalizer"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (
  id,
  username,
  role,
  membership_status
)
values (
  '00000000-0000-4000-8000-000000001012',
  'system_vote_finalizer',
  'admin',
  'none'
)
on conflict (id) do update
  set username = excluded.username,
      role = excluded.role,
      membership_status = excluded.membership_status,
      member_number = null,
      updated_at = now();

create table public.admission_votes (
  id uuid primary key default extensions.gen_random_uuid(),
  application_id uuid not null references public.admission_applications(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'closed', 'overridden')),
  rule_kind text not null default 'one_account_one_vote'
    check (rule_kind in ('one_account_one_vote')),
  decision_rule text not null default 'yes_gt_no'
    check (decision_rule in ('yes_gt_no')),
  window_ends_at timestamptz not null,
  yes_count integer not null default 0 check (yes_count >= 0),
  no_count integer not null default 0 check (no_count >= 0),
  turnout_count integer not null default 0 check (turnout_count >= 0),
  outcome text check (outcome is null or outcome in ('approved', 'rejected')),
  opened_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index admission_votes_one_open_per_application_idx
  on public.admission_votes(application_id)
  where status = 'open';

create index admission_votes_status_window_idx
  on public.admission_votes(status, window_ends_at, created_at);

create table public.admission_vote_turnout (
  vote_id uuid not null references public.admission_votes(id) on delete cascade,
  application_id uuid not null references public.admission_applications(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  cast_at timestamptz not null default date_trunc('minute', now()),
  primary key (vote_id, voter_id),
  unique (application_id, voter_id)
);

create table public.admission_vote_ballots (
  vote_id uuid not null references public.admission_votes(id) on delete cascade,
  blind_token uuid primary key default extensions.gen_random_uuid(),
  choice text not null check (choice in ('yes', 'no')),
  cast_at timestamptz not null default date_trunc('minute', now())
);

create index admission_vote_ballots_vote_choice_idx
  on public.admission_vote_ballots(vote_id, choice);

create table public.admission_vote_clip_accesses (
  id uuid primary key default extensions.gen_random_uuid(),
  vote_id uuid not null references public.admission_votes(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.admission_votes enable row level security;
alter table public.admission_vote_turnout enable row level security;
alter table public.admission_vote_ballots enable row level security;
alter table public.admission_vote_clip_accesses enable row level security;

grant all privileges on public.admission_votes to service_role;
grant all privileges on public.admission_vote_turnout to service_role;
grant all privileges on public.admission_vote_ballots to service_role;
grant all privileges on public.admission_vote_clip_accesses to service_role;

revoke all privileges on public.admission_votes from anon, authenticated;
revoke all privileges on public.admission_vote_turnout from anon, authenticated;
revoke all privileges on public.admission_vote_ballots from anon, authenticated;
revoke all privileges on public.admission_vote_clip_accesses from anon, authenticated;

create or replace function public.open_vote_tx(
  p_application_id uuid,
  p_actor_id uuid,
  p_idempotency_key text,
  p_window_ends_at timestamptz
)
returns public.admission_votes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_app public.admission_applications%rowtype;
  v_existing public.admission_votes%rowtype;
  v_vote public.admission_votes%rowtype;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor_id;

  if v_actor_role not in ('reviewer', 'admin') then
    raise exception 'reviewer role required' using errcode = '42501';
  end if;

  select *
    into v_existing
  from public.admission_votes
  where idempotency_key = p_idempotency_key;

  if found then
    return v_existing;
  end if;

  if p_window_ends_at <= now() then
    raise exception 'vote window must end in the future' using errcode = 'P0001';
  end if;

  select *
    into v_app
  from public.admission_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;

  if v_app.status != 'under_review' then
    raise exception 'cannot open vote from status %', v_app.status using errcode = 'P0001';
  end if;

  insert into public.admission_votes (
    application_id,
    window_ends_at,
    opened_by,
    idempotency_key
  )
  values (
    p_application_id,
    p_window_ends_at,
    p_actor_id,
    p_idempotency_key
  )
  returning * into v_vote;

  update public.admission_applications
    set status = 'in_vote',
        updated_at = now()
  where id = p_application_id;

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
    'under_review',
    'in_vote',
    null,
    p_idempotency_key || ':opened'
  );

  return v_vote;
end;
$$;

create or replace function public.cast_vote_tx(
  p_vote_id uuid,
  p_choice text
)
returns public.admission_votes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voter_id uuid := auth.uid();
  v_vote public.admission_votes%rowtype;
begin
  if v_voter_id is null then
    raise exception 'authenticated voter required' using errcode = '42501';
  end if;

  if p_choice not in ('yes', 'no') then
    raise exception 'invalid vote choice' using errcode = 'P0001';
  end if;

  if not public.is_active_member(v_voter_id) then
    raise exception 'active membership required' using errcode = '42501';
  end if;

  select *
    into v_vote
  from public.admission_votes
  where id = p_vote_id
  for update;

  if not found then
    raise exception 'vote not found' using errcode = 'P0002';
  end if;

  if v_vote.status != 'open' or v_vote.window_ends_at <= now() then
    raise exception 'vote is not open' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.admission_applications app
    where app.id = v_vote.application_id
      and app.status = 'in_vote'
  ) then
    raise exception 'application is not in vote' using errcode = 'P0001';
  end if;

  insert into public.admission_vote_turnout (
    vote_id,
    application_id,
    voter_id
  )
  values (
    p_vote_id,
    v_vote.application_id,
    v_voter_id
  );

  insert into public.admission_vote_ballots (
    vote_id,
    choice
  )
  values (
    p_vote_id,
    p_choice
  );

  return v_vote;
exception
  when unique_violation then
    raise exception 'voter already cast a ballot' using errcode = '23505';
end;
$$;

create or replace function public.finalize_vote_tx(
  p_vote_id uuid,
  p_actor_id uuid,
  p_idempotency_key text
)
returns public.admission_votes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vote public.admission_votes%rowtype;
  v_actor_role text;
  v_yes_count integer;
  v_no_count integer;
  v_turnout_count integer;
  v_outcome text;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor_id;

  if v_actor_role not in ('reviewer', 'admin') then
    raise exception 'reviewer role required' using errcode = '42501';
  end if;

  select *
    into v_vote
  from public.admission_votes
  where id = p_vote_id
  for update;

  if not found then
    raise exception 'vote not found' using errcode = 'P0002';
  end if;

  if v_vote.status != 'open' then
    return v_vote;
  end if;

  select
    count(*) filter (where choice = 'yes')::integer,
    count(*) filter (where choice = 'no')::integer,
    (select count(*)::integer from public.admission_vote_turnout where vote_id = p_vote_id)
    into v_yes_count, v_no_count, v_turnout_count
  from public.admission_vote_ballots
  where vote_id = p_vote_id;

  v_outcome := case when v_yes_count > v_no_count then 'approved' else 'rejected' end;

  update public.admission_votes
    set status = 'closed',
        yes_count = v_yes_count,
        no_count = v_no_count,
        turnout_count = v_turnout_count,
        outcome = v_outcome,
        closed_by = p_actor_id,
        closed_at = now(),
        updated_at = now()
  where id = p_vote_id
  returning * into v_vote;

  delete from public.admission_vote_ballots
  where vote_id = p_vote_id;

  update public.admission_applications
    set status = 'under_review',
        updated_at = now()
  where id = v_vote.application_id
    and status = 'in_vote';

  insert into public.admission_events (
    application_id,
    actor_id,
    from_status,
    to_status,
    reason_code,
    idempotency_key
  )
  values (
    v_vote.application_id,
    p_actor_id,
    'in_vote',
    'under_review',
    null,
    p_idempotency_key || ':vote-finalized'
  )
  on conflict (idempotency_key) do nothing;

  if v_outcome = 'approved' then
    perform public.approve_application_tx(
      v_vote.application_id,
      p_actor_id,
      'meets_phase1_policy',
      p_idempotency_key || ':approved',
      '멤버 투표 결과 입장이 승인되었습니다.',
      'Admission vote finalized: YES ' || v_yes_count || ', NO ' || v_no_count
    );
  else
    perform public.reject_application_tx(
      v_vote.application_id,
      p_actor_id,
      'mismatch_with_policy',
      p_idempotency_key || ':rejected',
      '멤버 투표 결과 이번 입장은 승인되지 않았습니다.',
      'Admission vote finalized: YES ' || v_yes_count || ', NO ' || v_no_count
    );
  end if;

  return v_vote;
end;
$$;

create or replace function public.override_vote_tx(
  p_vote_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_idempotency_key text
)
returns public.admission_votes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vote public.admission_votes%rowtype;
  v_actor_role text;
  v_yes_count integer;
  v_no_count integer;
  v_turnout_count integer;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor_id;

  if v_actor_role != 'admin' then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid override decision' using errcode = 'P0001';
  end if;

  select *
    into v_vote
  from public.admission_votes
  where id = p_vote_id
  for update;

  if not found then
    raise exception 'vote not found' using errcode = 'P0002';
  end if;

  if v_vote.status != 'open' then
    return v_vote;
  end if;

  select
    count(*) filter (where choice = 'yes')::integer,
    count(*) filter (where choice = 'no')::integer,
    (select count(*)::integer from public.admission_vote_turnout where vote_id = p_vote_id)
    into v_yes_count, v_no_count, v_turnout_count
  from public.admission_vote_ballots
  where vote_id = p_vote_id;

  update public.admission_votes
    set status = 'overridden',
        yes_count = v_yes_count,
        no_count = v_no_count,
        turnout_count = v_turnout_count,
        outcome = p_decision,
        closed_by = p_actor_id,
        closed_at = now(),
        updated_at = now()
  where id = p_vote_id
  returning * into v_vote;

  delete from public.admission_vote_ballots
  where vote_id = p_vote_id;

  update public.admission_applications
    set status = 'under_review',
        updated_at = now()
  where id = v_vote.application_id
    and status = 'in_vote';

  insert into public.admission_events (
    application_id,
    actor_id,
    from_status,
    to_status,
    reason_code,
    idempotency_key
  )
  values (
    v_vote.application_id,
    p_actor_id,
    'in_vote',
    'under_review',
    null,
    p_idempotency_key || ':vote-overridden'
  )
  on conflict (idempotency_key) do nothing;

  if p_decision = 'approved' then
    perform public.approve_application_tx(
      v_vote.application_id,
      p_actor_id,
      'meets_phase1_policy',
      p_idempotency_key || ':override-approved',
      '운영자 확인으로 입장이 승인되었습니다.',
      'Admission vote admin override approved: YES ' || v_yes_count || ', NO ' || v_no_count
    );
  else
    perform public.reject_application_tx(
      v_vote.application_id,
      p_actor_id,
      'mismatch_with_policy',
      p_idempotency_key || ':override-rejected',
      '운영자 확인으로 이번 입장은 승인되지 않았습니다.',
      'Admission vote admin override rejected: YES ' || v_yes_count || ', NO ' || v_no_count
    );
  end if;

  return v_vote;
end;
$$;

create or replace function public.list_open_admission_votes(
  p_limit integer default 20,
  p_cursor_opened_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  candidate_token text,
  applicant_statement text,
  has_clip boolean,
  window_ends_at timestamptz,
  opened_at timestamptz,
  has_voted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    vote.id,
    'candidate-' || pg_catalog.left(vote.id::text, 8),
    app.applicant_statement,
    app.persona_clip_asset_id is not null,
    vote.window_ends_at,
    vote.opened_at,
    exists (
      select 1
      from public.admission_vote_turnout turnout
      where turnout.vote_id = vote.id
        and turnout.voter_id = auth.uid()
    ) as has_voted
  from public.admission_votes vote
  join public.admission_applications app on app.id = vote.application_id
  where public.is_active_member(auth.uid())
    and vote.status = 'open'
    and vote.window_ends_at > now()
    and app.status = 'in_vote'
    and (
      p_cursor_opened_at is null
      or vote.opened_at < p_cursor_opened_at
      or (
        vote.opened_at = p_cursor_opened_at
        and vote.id < p_cursor_id
      )
    )
  order by vote.opened_at desc, vote.id desc
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.get_admission_vote(
  p_vote_id uuid
)
returns table (
  id uuid,
  candidate_token text,
  applicant_statement text,
  has_clip boolean,
  window_ends_at timestamptz,
  opened_at timestamptz,
  status text,
  outcome text,
  yes_count integer,
  no_count integer,
  turnout_count integer,
  has_voted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    vote.id,
    'candidate-' || pg_catalog.left(vote.id::text, 8),
    app.applicant_statement,
    app.persona_clip_asset_id is not null,
    vote.window_ends_at,
    vote.opened_at,
    vote.status,
    vote.outcome,
    vote.yes_count,
    vote.no_count,
    vote.turnout_count,
    exists (
      select 1
      from public.admission_vote_turnout turnout
      where turnout.vote_id = vote.id
        and turnout.voter_id = auth.uid()
    ) as has_voted
  from public.admission_votes vote
  join public.admission_applications app on app.id = vote.application_id
  where public.is_active_member(auth.uid())
    and vote.id = p_vote_id
    and app.status in ('in_vote', 'approved', 'rejected');
$$;

revoke execute on function public.open_vote_tx(
  uuid, uuid, text, timestamptz
) from anon, authenticated, public;
grant execute on function public.open_vote_tx(
  uuid, uuid, text, timestamptz
) to service_role;

revoke execute on function public.finalize_vote_tx(
  uuid, uuid, text
) from anon, authenticated, public;
grant execute on function public.finalize_vote_tx(
  uuid, uuid, text
) to service_role;

revoke execute on function public.override_vote_tx(
  uuid, uuid, text, text
) from anon, authenticated, public;
grant execute on function public.override_vote_tx(
  uuid, uuid, text, text
) to service_role;

revoke execute on function public.cast_vote_tx(
  uuid, text
) from anon, public;
grant execute on function public.cast_vote_tx(
  uuid, text
) to authenticated;

revoke execute on function public.list_open_admission_votes(
  integer, timestamptz, uuid
) from anon, public;
grant execute on function public.list_open_admission_votes(
  integer, timestamptz, uuid
) to authenticated;

revoke execute on function public.get_admission_vote(
  uuid
) from anon, public;
grant execute on function public.get_admission_vote(
  uuid
) to authenticated;

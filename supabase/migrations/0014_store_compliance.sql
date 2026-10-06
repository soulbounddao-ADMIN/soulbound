-- 0014: App Store compliance — account deletion, UGC reports, member blocks.
-- JunTae 승인 2026-10-06: 보호 영역 개방 — 계정삭제/신고/차단
-- See docs/store-compliance/IMPLEMENTATION_NOTES.md for the retention matrix.

-- ---------------------------------------------------------------------------
-- 1. Audit enums: new actions + reason codes (codes only, INV-16).
-- ---------------------------------------------------------------------------
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
      'role.changed',
      'report.resolved',
      'report.dismissed',
      'account.deletion_requested',
      'account.deleted'
    )
  );

alter table public.audit_logs
  drop constraint if exists audit_logs_reason_code_check;

alter table public.audit_logs
  add constraint audit_logs_reason_code_check
  check (
    reason_code is null
    or reason_code in (
      'meets_phase1_policy',
      'insufficient_context',
      'mismatch_with_policy',
      'needs_identity_clarification',
      'duplicate_identity_suspected',
      'applicant_withdrew',
      'application_expired',
      'content_removed',
      'member_sanctioned',
      'warning_issued',
      'no_violation',
      'duplicate_report',
      'insufficient_information',
      'user_requested'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. De-identification on account deletion.
--    Retained operational records must not block auth.users deletion.
--    audit_logs.actor_id is part of the hash-chain payload (0009), so it is
--    kept as an unlinked UUID (FK dropped) instead of being rewritten.
-- ---------------------------------------------------------------------------
alter table public.audit_logs
  drop constraint if exists audit_logs_actor_id_fkey;

alter table public.admission_events
  drop constraint if exists admission_events_actor_id_fkey;
alter table public.admission_events
  add constraint admission_events_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.admission_applications
  drop constraint if exists admission_applications_reviewer_id_fkey;
alter table public.admission_applications
  add constraint admission_applications_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles(id) on delete set null;

alter table public.admission_votes
  alter column opened_by drop not null;
alter table public.admission_votes
  drop constraint if exists admission_votes_opened_by_fkey;
alter table public.admission_votes
  add constraint admission_votes_opened_by_fkey
  foreign key (opened_by) references public.profiles(id) on delete set null;
alter table public.admission_votes
  drop constraint if exists admission_votes_closed_by_fkey;
alter table public.admission_votes
  add constraint admission_votes_closed_by_fkey
  foreign key (closed_by) references public.profiles(id) on delete set null;

-- Turnout rows keep tallies consistent with anonymous ballots; the voter UUID
-- stays as an unlinked value once the account is gone.
alter table public.admission_vote_turnout
  drop constraint if exists admission_vote_turnout_voter_id_fkey;

-- ---------------------------------------------------------------------------
-- 3. Blocks.
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_block check (blocker_id <> blocked_id)
);

create index blocks_blocked_id_idx on public.blocks(blocked_id);

alter table public.blocks enable row level security;

grant all privileges on public.blocks to service_role;
revoke all privileges on public.blocks from anon, authenticated;
grant select (blocker_id, blocked_id, created_at) on public.blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;
grant delete on public.blocks to authenticated;

create policy "blocks select own"
  on public.blocks
  for select
  to authenticated
  using (blocker_id = auth.uid());

create policy "blocks insert own"
  on public.blocks
  for insert
  to authenticated
  with check (
    blocker_id = auth.uid()
    and public.is_active_member(auth.uid())
  );

create policy "blocks delete own"
  on public.blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());

-- SECURITY DEFINER bypasses blocks RLS, and EXECUTE is granted to authenticated.
-- Without this guard any caller could probe two arbitrary profile ids. Every
-- legitimate caller passes auth.uid() as p_blocker_id, so only that caller
-- may learn that their own block exists.
create or replace function public.is_blocked_by(
  p_blocker_id uuid,
  p_blocked_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_blocker_id is not null
    and p_blocker_id = (select auth.uid())
    and exists (
      select 1
      from public.blocks b
      where b.blocker_id = p_blocker_id
        and b.blocked_id = p_blocked_id
    );
$$;

revoke execute on function public.is_blocked_by(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_by(uuid, uuid) to authenticated, service_role;

-- Blocked users disappear from the blocker's direct reads (member directory
-- reads profiles through the user-scoped client).
create policy "profiles hide blocked from blocker"
  on public.profiles
  as restrictive
  for select
  to authenticated
  using (not public.is_blocked_by(auth.uid(), id));

create policy "board posts hide blocked authors"
  on public.board_posts
  as restrictive
  for select
  to authenticated
  using (not public.is_blocked_by(auth.uid(), author_id));

create policy "board comments hide blocked authors"
  on public.board_comments
  as restrictive
  for select
  to authenticated
  using (not public.is_blocked_by(auth.uid(), author_id));

create or replace function public.block_member(p_member_number bigint)
returns table (member_number bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
begin
  if v_uid is null or not public.is_active_member(v_uid) then
    raise exception 'active membership required' using errcode = '42501';
  end if;

  select p.id
    into v_target
  from public.profiles p
  where p.member_number = p_member_number;

  if v_target is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  if v_target = v_uid then
    raise exception 'cannot block yourself' using errcode = '22023';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, v_target)
  on conflict on constraint blocks_pkey do nothing;

  return query
  select p_member_number, b.created_at
  from public.blocks b
  where b.blocker_id = v_uid
    and b.blocked_id = v_target;
end;
$$;

create or replace function public.unblock_member(p_member_number bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted integer;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.blocks b
  using public.profiles p
  where b.blocker_id = v_uid
    and b.blocked_id = p.id
    and p.member_number = p_member_number;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

create or replace function public.list_my_blocks()
returns table (member_number bigint, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.member_number, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
    and p.member_number is not null
  order by b.created_at desc, p.member_number asc;
$$;

revoke execute on function public.block_member(bigint) from public, anon;
revoke execute on function public.unblock_member(bigint) from public, anon;
revoke execute on function public.list_my_blocks() from public, anon;
grant execute on function public.block_member(bigint) to authenticated;
grant execute on function public.unblock_member(bigint) to authenticated;
grant execute on function public.list_my_blocks() to authenticated;

-- Board RPCs (security definer, bypass RLS): add the same block filter.
create or replace function public.list_board_posts(
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  member_number bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    post.id,
    post.body,
    post.created_at,
    profile.member_number
  from public.board_posts post
  join public.profiles profile on profile.id = post.author_id
  where public.is_active_member(auth.uid())
    and post.deleted_at is null
    and profile.membership_status = 'active'
    and profile.member_number is not null
    and not public.is_blocked_by(auth.uid(), post.author_id)
    and (
      p_cursor_created_at is null
      or post.created_at < p_cursor_created_at
      or (
        post.created_at = p_cursor_created_at
        and post.id < p_cursor_id
      )
    )
  order by post.created_at desc, post.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 51);
$$;

create or replace function public.get_board_post(p_post_id uuid)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  member_number bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    post.id,
    post.body,
    post.created_at,
    profile.member_number
  from public.board_posts post
  join public.profiles profile on profile.id = post.author_id
  where public.is_active_member(auth.uid())
    and post.id = p_post_id
    and post.deleted_at is null
    and profile.membership_status = 'active'
    and profile.member_number is not null
    and not public.is_blocked_by(auth.uid(), post.author_id);
$$;

create or replace function public.list_board_comments(p_post_id uuid)
returns table (
  id uuid,
  post_id uuid,
  body text,
  created_at timestamptz,
  member_number bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    comment.id,
    comment.post_id,
    comment.body,
    comment.created_at,
    profile.member_number
  from public.board_comments comment
  join public.profiles profile on profile.id = comment.author_id
  join public.board_posts post on post.id = comment.post_id
  where public.is_active_member(auth.uid())
    and comment.post_id = p_post_id
    and comment.deleted_at is null
    and post.deleted_at is null
    and profile.membership_status = 'active'
    and profile.member_number is not null
    and not public.is_blocked_by(auth.uid(), comment.author_id)
    and not public.is_blocked_by(auth.uid(), post.author_id)
  order by comment.created_at asc, comment.id asc;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reports. The schema-only 0002 table was never wired; replace it.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.reports) then
    raise exception '0014: legacy public.reports contains rows; migrate them manually before applying'
      using errcode = 'P0001';
  end if;
end;
$$;

drop table public.reports;

create table public.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null
    check (target_type in ('board_post', 'board_comment', 'member')),
  -- board_post / board_comment: row uuid; member: member number.
  target_ref text not null check (char_length(target_ref) between 1 and 64),
  subject_user_id uuid references public.profiles(id) on delete set null,
  reason text not null
    check (
      reason in (
        'spam',
        'harassment',
        'hate',
        'sexual',
        'violence',
        'illegal',
        'impersonation',
        'privacy',
        'other'
      )
    ),
  detail text check (detail is null or char_length(detail) between 1 and 500),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_code text
    check (
      resolution_code is null
      or resolution_code in (
        'content_removed',
        'member_sanctioned',
        'warning_issued',
        'no_violation',
        'duplicate_report',
        'insufficient_information'
      )
    ),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_resolution_consistency check (
    (status = 'open' and resolution_code is null and resolved_at is null)
    or (status <> 'open' and resolution_code is not null and resolved_at is not null)
  )
);

create unique index reports_one_open_per_reporter_target_idx
  on public.reports(reporter_id, target_type, target_ref)
  where status = 'open';

create index reports_status_created_at_idx
  on public.reports(status, created_at desc, id desc);

create index reports_reporter_created_at_idx
  on public.reports(reporter_id, created_at desc);

alter table public.reports enable row level security;

grant all privileges on public.reports to service_role;
revoke all privileges on public.reports from anon, authenticated;
-- reporter_id, subject_user_id, and resolved_by are omitted on purpose.
-- RLS "reports select own" may still filter on reporter_id; a column SELECT
-- grant is not required for a policy qual. Reviewers never read this table.
grant select (
  id,
  target_type,
  target_ref,
  reason,
  detail,
  status,
  resolution_code,
  resolved_at,
  created_at,
  updated_at
) on public.reports to authenticated;
grant insert (
  reporter_id,
  target_type,
  target_ref,
  reason,
  detail
) on public.reports to authenticated;

create policy "reports select own"
  on public.reports
  for select
  to authenticated
  using (reporter_id = auth.uid());

-- No reviewer/admin SELECT policy. The queue is list_reports_for_review only
-- (security definer; checks reviewer/admin itself; never returns reporter_id).
-- resolve_report is also security definer and checks the same role itself.

create policy "reports insert own active"
  on public.reports
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and public.is_active_member(auth.uid())
  );

-- Rate limit: at most 10 reports per reporter per rolling hour (DB-backed).
create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent integer;
  v_subject uuid;
begin
  if new.reporter_id is null then
    raise exception 'reporter required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('reports:' || new.reporter_id::text, 0)
  );

  select pg_catalog.count(*)::integer
    into v_recent
  from public.reports r
  where r.reporter_id = new.reporter_id
    and r.created_at > now() - interval '1 hour';

  if v_recent >= 10 then
    raise exception 'report rate limit exceeded' using errcode = 'SB429';
  end if;

  if new.target_type in ('board_post', 'board_comment') then
    if new.target_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'invalid report target' using errcode = '22023';
    end if;
    new.target_ref := lower(new.target_ref);
  elsif new.target_ref !~ '^[1-9][0-9]{0,17}$' then
    raise exception 'invalid report target' using errcode = '22023';
  end if;

  if new.target_type = 'board_post' then
    select p.author_id into v_subject
    from public.board_posts p
    where p.id = new.target_ref::uuid
      and p.deleted_at is null;
  elsif new.target_type = 'board_comment' then
    select c.author_id into v_subject
    from public.board_comments c
    where c.id = new.target_ref::uuid
      and c.deleted_at is null;
  else
    select p.id into v_subject
    from public.profiles p
    where p.member_number = new.target_ref::bigint;
  end if;

  if v_subject is null then
    raise exception 'report target not found' using errcode = 'P0002';
  end if;

  if v_subject = new.reporter_id then
    raise exception 'cannot report yourself' using errcode = '22023';
  end if;

  new.subject_user_id := v_subject;
  new.status := 'open';
  new.resolved_by := null;
  new.resolution_code := null;
  new.resolved_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger reports_before_insert
  before insert on public.reports
  for each row
  execute function public.reports_before_insert();

create or replace function public.list_reports_for_review(
  p_status text default 'open',
  p_limit integer default 50
)
returns table (
  id uuid,
  target_type text,
  target_ref text,
  reason text,
  detail text,
  status text,
  resolution_code text,
  resolved_at timestamptz,
  created_at timestamptz,
  subject_member_number bigint,
  target_excerpt text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), '') not in ('reviewer', 'admin') then
    raise exception 'reviewer role required' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.target_type,
    r.target_ref,
    r.reason,
    r.detail,
    r.status,
    r.resolution_code,
    r.resolved_at,
    r.created_at,
    subject.member_number,
    case r.target_type
      when 'board_post' then (
        select left(p.body, 200)
        from public.board_posts p
        where p.id::text = r.target_ref and p.deleted_at is null
      )
      when 'board_comment' then (
        select left(c.body, 200)
        from public.board_comments c
        where c.id::text = r.target_ref and c.deleted_at is null
      )
      else null
    end
  from public.reports r
  left join public.profiles subject on subject.id = r.subject_user_id
  where p_status is null or p_status = 'all' or r.status = p_status
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.resolve_report(
  p_report_id uuid,
  p_status text,
  p_resolution_code text
)
returns table (
  id uuid,
  status text,
  resolution_code text,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.reports%rowtype;
begin
  if v_uid is null
     or coalesce(public.current_user_role(), '') not in ('reviewer', 'admin') then
    raise exception 'reviewer role required' using errcode = '42501';
  end if;

  if p_status = 'resolved' then
    if p_resolution_code not in ('content_removed', 'member_sanctioned', 'warning_issued') then
      raise exception 'invalid resolution code' using errcode = '22023';
    end if;
  elsif p_status = 'dismissed' then
    if p_resolution_code not in ('no_violation', 'duplicate_report', 'insufficient_information') then
      raise exception 'invalid resolution code' using errcode = '22023';
    end if;
  else
    raise exception 'invalid resolution status' using errcode = '22023';
  end if;

  select * into v_report
  from public.reports r
  where r.id = p_report_id
  for update;

  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if v_report.status <> 'open' then
    if v_report.status = p_status and v_report.resolution_code = p_resolution_code then
      return query select v_report.id, v_report.status, v_report.resolution_code, v_report.resolved_at;
      return;
    end if;
    raise exception 'report already closed' using errcode = 'P0001';
  end if;

  update public.reports r
    set status = p_status,
        resolution_code = p_resolution_code,
        resolved_by = v_uid,
        resolved_at = now(),
        updated_at = now()
  where r.id = p_report_id
  returning * into v_report;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason_code,
    metadata
  )
  values (
    v_uid,
    case when p_status = 'resolved' then 'report.resolved' else 'report.dismissed' end,
    'report',
    v_report.id,
    p_resolution_code,
    jsonb_build_object(
      'from_status', 'open',
      'to_status', p_status,
      'target_type', v_report.target_type
    )
  );

  return query select v_report.id, v_report.status, v_report.resolution_code, v_report.resolved_at;
end;
$$;

revoke execute on function public.reports_before_insert() from public, anon, authenticated;
revoke execute on function public.list_reports_for_review(text, integer) from public, anon;
revoke execute on function public.resolve_report(uuid, text, text) from public, anon;
grant execute on function public.list_reports_for_review(text, integer) to authenticated;
grant execute on function public.resolve_report(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Account deletion (service_role only).
--    prepare_account_deletion shreds the dossier and returns Persona Clip
--    asset ids. It appends account.deletion_requested at most once per profile
--    (retries do not append another row). It does not write account.deleted.
--    complete_account_deletion appends account.deleted / user_requested only
--    after the id is gone from both auth.users and public.profiles, and it
--    does not append a second account.deleted for that profile entity.
--    Both functions share an advisory lock so concurrent calls cannot
--    double-insert. 0009 hashes the action string as payload data; the new
--    action needs no hash-trigger change.
-- ---------------------------------------------------------------------------
create or replace function public.prepare_account_deletion(p_user_id uuid)
returns table (persona_clip_asset_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || p_user_id::text, 0)
  );

  if not exists (
    select 1
    from public.audit_logs a
    where a.action = 'account.deletion_requested'
      and a.entity_type = 'profile'
      and a.entity_id = p_user_id
  ) then
    insert into public.audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      reason_code,
      metadata
    )
    values (
      p_user_id,
      'account.deletion_requested',
      'profile',
      p_user_id,
      'user_requested',
      '{}'::jsonb
    );
  end if;

  -- Dossier content is destroyed now even if the auth deletion below has to
  -- be retried (ANON_IDENTITY_BRIEF: statement shredding).
  update public.admission_applications a
    set applicant_statement = null,
        motivation = null,
        referral_code = null
  where a.applicant_id = p_user_id
    and (
      a.applicant_statement is not null
      or a.motivation is not null
      or a.referral_code is not null
    );

  return query
  select c.id
  from public.persona_clip_assets c
  where c.applicant_id = p_user_id
    and c.status <> 'deleted'
  order by c.created_at, c.id;
end;
$$;

create or replace function public.complete_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('account-deletion:' || p_user_id::text, 0)
  );

  -- Still present in auth or profiles: deletion has not finished.
  if exists (select 1 from auth.users u where u.id = p_user_id)
     or exists (select 1 from public.profiles p where p.id = p_user_id) then
    return;
  end if;

  -- Only complete a deletion that this flow actually started.
  if not exists (
    select 1
    from public.audit_logs a
    where a.action = 'account.deletion_requested'
      and a.entity_type = 'profile'
      and a.entity_id = p_user_id
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.audit_logs a
    where a.action = 'account.deleted'
      and a.entity_type = 'profile'
      and a.entity_id = p_user_id
  ) then
    return;
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    reason_code,
    metadata
  )
  values (
    p_user_id,
    'account.deleted',
    'profile',
    p_user_id,
    'user_requested',
    '{}'::jsonb
  );
end;
$$;

revoke execute on function public.prepare_account_deletion(uuid)
  from public, anon, authenticated;
revoke execute on function public.complete_account_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
grant execute on function public.complete_account_deletion(uuid) to service_role;

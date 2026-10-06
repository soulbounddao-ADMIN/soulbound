create extension if not exists pgtap with schema extensions;

begin;

set search_path = public, extensions;

select no_plan();

create function pg_temp.create_sc_user(
  p_id uuid,
  p_username text,
  p_role text default 'applicant',
  p_member_number bigint default null
)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at, confirmation_token,
    recovery_token, email_change, email_change_token_new, aud, role,
    instance_id, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    p_id,
    p_username || '@soulbound.internal',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), '', '', '', '',
    'authenticated', 'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', p_username),
    now(), now()
  )
  on conflict (id) do nothing;

  update public.profiles
    set role = p_role,
        membership_status = case when p_member_number is not null then 'active' else 'none' end,
        member_number = p_member_number
  where id = p_id;

  if p_member_number is not null then
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

-- A/B/C/D members, R reviewer, X applicant.
select pg_temp.create_sc_user('f0000000-0000-0000-0000-00000000000a', 'sc_member_a', 'member', 3001);
select pg_temp.create_sc_user('f0000000-0000-0000-0000-00000000000b', 'sc_member_b', 'member', 3002);
select pg_temp.create_sc_user('f0000000-0000-0000-0000-00000000000c', 'sc_member_c', 'member', 3003);
select pg_temp.create_sc_user('f0000000-0000-0000-0000-00000000000d', 'sc_member_d', 'member', 3004);
select pg_temp.create_sc_user('f0000000-0000-0000-0000-0000000000ee', 'sc_reviewer', 'reviewer', null);
select pg_temp.create_sc_user('f0000000-0000-0000-0000-0000000000ad', 'sc_admin', 'admin', null);
select pg_temp.create_sc_user('f0000000-0000-0000-0000-0000000000ff', 'sc_applicant', 'applicant', null);

insert into public.board_posts (id, author_id, body) values
  ('a1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000a', 'post by a'),
  ('b1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000b', 'post by b'),
  ('c1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000c', 'post by c'),
  ('d1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000d', 'post by d');

insert into public.board_posts (id, author_id, body)
select
  ('b2000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'f0000000-0000-0000-0000-00000000000b',
  'bulk post ' || i
from generate_series(1, 11) as i;

insert into public.board_comments (id, post_id, author_id, body) values
  ('bc000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000b', 'comment by b'),
  ('ac000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000a', 'comment by a');

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000a', true);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.blocks (blocker_id, blocked_id)
    values ('f0000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000000b')
  $sql$),
  '00000',
  'member can insert own block row'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000ff', true);

select throws_ok(
  $sql$
    insert into public.blocks (blocker_id, blocked_id)
    values (
      'f0000000-0000-0000-0000-0000000000ff',
      'f0000000-0000-0000-0000-00000000000b'
    )
  $sql$,
  '42501'::char(5),
  null::text,
  'a non-active authenticated user cannot insert a block directly'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000a', true);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.blocks (blocker_id, blocked_id)
    values ('f0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-00000000000b')
  $sql$),
  '42501',
  'member cannot insert a block row on behalf of another user'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.blocks (blocker_id, blocked_id)
    values ('f0000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000000a')
  $sql$),
  '23514',
  'self-block is rejected by constraint'
);

select is(
  pg_temp.sqlstate_for('select * from public.block_member(3001)'),
  '22023',
  'block_member rejects blocking yourself'
);

select is(
  pg_temp.sqlstate_for('select * from public.block_member(999999)'),
  'P0002',
  'block_member rejects unknown member numbers'
);

select is(
  (select count(*)::int from public.blocks),
  1,
  'blocker sees own block rows'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000c', true);

select is(
  public.is_blocked_by(
    'f0000000-0000-0000-0000-00000000000a',
    'f0000000-0000-0000-0000-00000000000b'
  ),
  false,
  'a third member cannot probe is_blocked_by for someone else''s block'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000a', true);

select is(
  public.is_blocked_by(
    'f0000000-0000-0000-0000-00000000000a',
    'f0000000-0000-0000-0000-00000000000b'
  ),
  true,
  'the blocker''s is_blocked_by returns true for their own block'
);

select is(
  (select array_agg(member_number)::bigint[] from public.list_my_blocks()),
  array[3002]::bigint[],
  'list_my_blocks returns member numbers of blocked members'
);

select is(
  (select count(*)::int from public.list_board_posts(50) where id = 'b1000000-0000-0000-0000-000000000001'),
  0,
  'board list excludes posts by blocked members'
);

select is(
  (select count(*)::int from public.get_board_post('b1000000-0000-0000-0000-000000000001')),
  0,
  'board detail hides posts by blocked members'
);

select is(
  (select array_agg(id)::uuid[] from public.list_board_comments('c1000000-0000-0000-0000-000000000001')),
  array['ac000000-0000-0000-0000-000000000001']::uuid[],
  'board comments exclude comments by blocked members'
);

select is(
  (select count(*)::int from public.board_posts where id = 'b1000000-0000-0000-0000-000000000001'),
  0,
  'direct board_posts reads hide blocked authors'
);

select is(
  (select count(*)::int from public.profiles where member_number = 3002),
  0,
  'member directory (profiles) hides blocked members from the blocker'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000b', true);

select is(
  (select count(*)::int from public.blocks),
  0,
  'blocked member cannot read who blocked them'
);

select is(
  (select count(*)::int from public.list_my_blocks()),
  0,
  'blocked member list_my_blocks does not reveal blockers'
);

select is(
  (select count(*)::int from public.profiles where member_number = 3001),
  1,
  'blocking is one-directional for directory visibility'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000c', true);

delete from public.blocks
where blocker_id = 'f0000000-0000-0000-0000-00000000000a';

select is(
  (select count(*)::int from public.list_board_posts(50) where id = 'b1000000-0000-0000-0000-000000000001'),
  1,
  'other members still see posts by the blocked member'
);

reset role;

select is(
  (select count(*)::int from public.blocks where blocker_id = 'f0000000-0000-0000-0000-00000000000a'),
  1,
  'another member cannot delete someone else''s block row'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000a', true);

select is(
  public.unblock_member(3002),
  true,
  'unblock_member removes own block'
);

select is(
  public.unblock_member(3002),
  false,
  'unblock_member is idempotent'
);

select is(
  (select count(*)::int from public.list_board_posts(50) where id = 'b1000000-0000-0000-0000-000000000001'),
  1,
  'unblocked member posts are visible again'
);

select is(
  (select count(*)::int from public.block_member(3002)),
  1,
  'block_member creates a block'
);

select is(
  (select count(*)::int from public.block_member(3002)),
  1,
  'block_member is idempotent'
);

select ok(public.unblock_member(3002), 'cleanup unblock');

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000a', 'board_post', 'b1000000-0000-0000-0000-000000000001', 'spam')
  $sql$),
  '00000',
  'member can report a board post'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason, detail)
    values ('f0000000-0000-0000-0000-00000000000a', 'board_post', 'b1000000-0000-0000-0000-000000000001', 'hate', 'again')
  $sql$),
  '23505',
  'duplicate open report for the same target is rejected'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000a', 'board_comment', 'bc000000-0000-0000-0000-000000000001', 'harassment')
  $sql$),
  '00000',
  'member can report a board comment'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000a', 'member', '3002', 'impersonation')
  $sql$),
  '00000',
  'member can report a member by member number'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000a', 'board_post', 'a1000000-0000-0000-0000-000000000001', 'spam')
  $sql$),
  '22023',
  'reporting your own content is rejected'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000a', 'board_post', 'e9000000-0000-0000-0000-000000000001', 'spam')
  $sql$),
  'P0002',
  'reporting a missing target is rejected'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000b', 'board_post', 'c1000000-0000-0000-0000-000000000001', 'spam')
  $sql$),
  '42501',
  'member cannot file a report as another user'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason, detail)
    values ('f0000000-0000-0000-0000-00000000000a', 'board_post', 'c1000000-0000-0000-0000-000000000001', 'other', repeat('x', 501))
  $sql$),
  '23514',
  'report detail is length-limited'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000a', 'board_post', 'c1000000-0000-0000-0000-000000000001', 'not_a_reason')
  $sql$),
  '23514',
  'report reason must be an enum value'
);

select is(
  pg_temp.sqlstate_for($sql$
    select
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
    from public.reports
  $sql$),
  '00000',
  'reporter can list own reports using granted columns'
);

select is(
  (select count(*)::int from public.reports),
  3,
  'reporter reads only own reports'
);

select throws_ok(
  'select reporter_id from public.reports',
  '42501'::char(5),
  null::text,
  'reporter cannot select reporter_id'
);

select is(
  pg_temp.sqlstate_for($sql$
    update public.reports set status = 'dismissed'
  $sql$),
  '42501',
  'reporter cannot update reports directly'
);

select is(
  pg_temp.sqlstate_for('select * from public.list_reports_for_review(''open'', 50)'),
  '42501',
  'member cannot list reports for review'
);

select is(
  pg_temp.sqlstate_for($sql$
    select * from public.resolve_report(
      (select id from public.reports limit 1), 'dismissed', 'no_violation')
  $sql$),
  '42501',
  'member cannot resolve reports'
);

select is(
  has_column_privilege('authenticated', 'public.reports', 'subject_user_id', 'SELECT'),
  false,
  'authenticated clients cannot select report subject uuid'
);

select is(
  has_column_privilege('authenticated', 'public.reports', 'reporter_id', 'SELECT'),
  false,
  'authenticated clients cannot select reporter_id'
);

select is(
  has_column_privilege('anon', 'public.reports', 'reporter_id', 'SELECT'),
  false,
  'anon clients cannot select reporter_id'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000b', true);

select is(
  (select count(*)::int from public.reports),
  0,
  'other members cannot read someone else''s reports'
);

select throws_ok(
  'select reporter_id from public.reports',
  '42501'::char(5),
  null::text,
  'an unrelated member cannot select reporter_id'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000ff', true);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-0000000000ff', 'member', '3002', 'spam')
  $sql$),
  '42501',
  'non-members cannot file reports'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000ee', true);

select is(
  (select count(*)::int from public.reports),
  0,
  'reviewer direct read returns only own reports'
);

select throws_ok(
  'select reporter_id from public.reports',
  '42501'::char(5),
  null::text,
  'reviewer cannot select reporter_id'
);

select is(
  (select count(*)::int from public.list_reports_for_review('open', 50)),
  3,
  'reviewer can list open reports via rpc'
);

select is(
  pg_temp.sqlstate_for('select reporter_id from public.list_reports_for_review(''open'', 50)'),
  '42703',
  'review queue result has no reporter column'
);

select is(
  (
    select subject_member_number
    from public.list_reports_for_review('open', 50)
    where target_type = 'board_post'
  ),
  3002::bigint,
  'review list exposes subject member number'
);

select is(
  (
    select target_excerpt
    from public.list_reports_for_review('open', 50)
    where target_type = 'board_comment'
  ),
  'comment by b',
  'review list exposes target excerpt'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000ad', true);

select is(
  (select count(*)::int from public.reports),
  0,
  'admin direct read returns only own reports'
);

select throws_ok(
  'select reporter_id from public.reports',
  '42501'::char(5),
  null::text,
  'admin cannot select reporter_id'
);

select is(
  (select count(*)::int from public.list_reports_for_review('open', 50)),
  3,
  'admin can list the review queue via rpc'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000ee', true);

select is(
  (
    select status
    from public.resolve_report(
      (
        select queued.id
        from public.list_reports_for_review('open', 50) as queued
        where queued.target_type = 'board_post'
      ),
      'resolved',
      'content_removed'
    )
  ),
  'resolved',
  'reviewer can resolve a report'
);

select is(
  (
    select status
    from public.resolve_report(
      (
        select queued.id
        from public.list_reports_for_review('resolved', 50) as queued
        where queued.target_type = 'board_post'
      ),
      'resolved',
      'content_removed'
    )
  ),
  'resolved',
  'resolve_report is idempotent for the same decision'
);

select is(
  pg_temp.sqlstate_for($sql$
    select * from public.resolve_report(
      (
        select queued.id
        from public.list_reports_for_review('resolved', 50) as queued
        where queued.target_type = 'board_post'
      ),
      'dismissed',
      'no_violation'
    )
  $sql$),
  'P0001',
  'closed reports cannot be re-decided differently'
);

select is(
  pg_temp.sqlstate_for($sql$
    select * from public.resolve_report(
      (
        select queued.id
        from public.list_reports_for_review('open', 50) as queued
        where queued.target_type = 'member'
      ),
      'dismissed',
      'content_removed'
    )
  $sql$),
  '22023',
  'resolution code must match the resolution status'
);

reset role;

select is(
  (
    select count(*)::int
    from public.audit_logs
    where action = 'report.resolved'
      and reason_code = 'content_removed'
      and entity_type = 'report'
      and actor_id = 'f0000000-0000-0000-0000-0000000000ee'
  ),
  1,
  'report resolution writes exactly one audit row with an enum reason code'
);

select is(
  (select resolved_by from public.reports where target_type = 'board_post'),
  'f0000000-0000-0000-0000-0000000000ee'::uuid,
  'resolver is recorded'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000a', true);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000a', 'board_post', 'b1000000-0000-0000-0000-000000000001', 'spam')
  $sql$),
  '00000',
  'a new report is allowed once the previous one is closed'
);

select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000c', true);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    select
      'f0000000-0000-0000-0000-00000000000c',
      'board_post',
      'b2000000-0000-0000-0000-' || lpad(i::text, 12, '0'),
      'spam'
    from generate_series(1, 10) as i
  $sql$),
  '00000',
  'ten reports within an hour are allowed'
);

select is(
  pg_temp.sqlstate_for($sql$
    insert into public.reports (reporter_id, target_type, target_ref, reason)
    values ('f0000000-0000-0000-0000-00000000000c', 'board_post', 'b2000000-0000-0000-0000-000000000011', 'spam')
  $sql$),
  'SB429',
  'the eleventh report within an hour is rate limited'
);

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------
reset role;

insert into public.admission_applications (id, applicant_id, status, policy_version, reviewer_id)
values (
  'aa000000-0000-0000-0000-0000000000ff',
  'f0000000-0000-0000-0000-0000000000ff',
  'under_review',
  'v1',
  'f0000000-0000-0000-0000-00000000000d'
);

insert into public.admission_events (application_id, actor_id, from_status, to_status, idempotency_key)
values (
  'aa000000-0000-0000-0000-0000000000ff',
  'f0000000-0000-0000-0000-00000000000d',
  'submitted',
  'under_review',
  'sc-event-d'
);

insert into public.admission_votes (id, application_id, window_ends_at, opened_by, idempotency_key)
values (
  'ab000000-0000-0000-0000-0000000000ff',
  'aa000000-0000-0000-0000-0000000000ff',
  now() + interval '1 day',
  'f0000000-0000-0000-0000-00000000000d',
  'sc-vote-d'
);

insert into public.admission_vote_turnout (vote_id, application_id, voter_id)
values (
  'ab000000-0000-0000-0000-0000000000ff',
  'aa000000-0000-0000-0000-0000000000ff',
  'f0000000-0000-0000-0000-00000000000d'
);

insert into public.admission_applications (id, applicant_id, status, policy_version, applicant_statement)
values (
  'aa000000-0000-0000-0000-00000000000d',
  'f0000000-0000-0000-0000-00000000000d',
  'approved',
  'v1',
  'statement by d'
);

insert into public.persona_clip_assets (
  id, applicant_id, application_id, storage_path, content_hash, mime_type, size_bytes, status
)
values (
  'ac100000-0000-0000-0000-00000000000d',
  'f0000000-0000-0000-0000-00000000000d',
  'aa000000-0000-0000-0000-00000000000d',
  'f0000000-0000-0000-0000-00000000000d/ac100000-0000-0000-0000-00000000000d',
  'hash-d',
  'video/mp4',
  1,
  'attached'
);

insert into public.blocks (blocker_id, blocked_id) values
  ('f0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-00000000000a'),
  ('f0000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-00000000000d');

insert into public.reports (reporter_id, target_type, target_ref, reason)
values ('f0000000-0000-0000-0000-00000000000d', 'member', '3001', 'spam');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-00000000000d', true);

select is(
  pg_temp.sqlstate_for('select * from public.prepare_account_deletion(''f0000000-0000-0000-0000-00000000000d'')'),
  '42501',
  'authenticated users cannot call prepare_account_deletion'
);

select is(
  pg_temp.sqlstate_for('select public.complete_account_deletion(''f0000000-0000-0000-0000-00000000000d'')'),
  '42501',
  'authenticated users cannot call complete_account_deletion'
);

reset role;
set local role service_role;

select is(
  (select array_agg(persona_clip_asset_id)::uuid[] from public.prepare_account_deletion('f0000000-0000-0000-0000-00000000000d')),
  array['ac100000-0000-0000-0000-00000000000d']::uuid[],
  'prepare_account_deletion returns the caller''s live persona clip assets'
);

select is(
  (select count(*)::int from public.prepare_account_deletion('f0000000-0000-0000-0000-00000000000d')),
  1,
  'prepare_account_deletion can be retried'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where action = 'account.deletion_requested'
      and entity_type = 'profile'
      and entity_id = 'f0000000-0000-0000-0000-00000000000d'
      and reason_code = 'user_requested'
  ),
  1,
  'prepare writes account.deletion_requested exactly once'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where action = 'account.deleted'
      and entity_id = 'f0000000-0000-0000-0000-00000000000d'
  ),
  0,
  'account.deleted is not written while the user still exists'
);

select lives_ok(
  $sql$ select public.complete_account_deletion('f0000000-0000-0000-0000-00000000000d') $sql$,
  'complete_account_deletion does not raise while the user still exists'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where action = 'account.deleted'
      and entity_id = 'f0000000-0000-0000-0000-00000000000d'
  ),
  0,
  'complete_account_deletion appends nothing while the user still exists'
);

select is(
  (select applicant_statement from public.admission_applications where id = 'aa000000-0000-0000-0000-00000000000d'),
  null,
  'dossier statement is shredded during preparation'
);

reset role;

select lives_ok(
  $sql$ delete from auth.users where id = 'f0000000-0000-0000-0000-00000000000d' $sql$,
  'auth user with retained operational references can be deleted'
);

select is(
  (select count(*)::int from public.profiles where id = 'f0000000-0000-0000-0000-00000000000d'),
  0,
  'profile is deleted'
);

select is(
  (select count(*)::int from public.admission_applications where applicant_id = 'f0000000-0000-0000-0000-00000000000d'),
  0,
  'own admission applications are deleted'
);

select is(
  (select count(*)::int from public.persona_clip_assets where applicant_id = 'f0000000-0000-0000-0000-00000000000d'),
  0,
  'own persona clip asset rows are deleted'
);

select is(
  (select count(*)::int from public.board_posts where author_id = 'f0000000-0000-0000-0000-00000000000d'),
  0,
  'own board posts are deleted'
);

select is(
  (
    select count(*)::int from public.blocks
    where blocker_id = 'f0000000-0000-0000-0000-00000000000d'
       or blocked_id = 'f0000000-0000-0000-0000-00000000000d'
  ),
  0,
  'blocks in both directions are deleted'
);

select is(
  (select count(*)::int from public.reports where target_type = 'member' and target_ref = '3001' and reporter_id is null),
  1,
  'reports filed by the deleted user are retained with reporter de-identified'
);

select is(
  (select reviewer_id from public.admission_applications where id = 'aa000000-0000-0000-0000-0000000000ff'),
  null,
  'reviewer reference on other applications is cleared'
);

select is(
  (select actor_id from public.admission_events where idempotency_key = 'sc-event-d'),
  null,
  'admission event on other applications is retained with actor de-identified'
);

select is(
  (select opened_by from public.admission_votes where id = 'ab000000-0000-0000-0000-0000000000ff'),
  null,
  'vote opener is de-identified'
);

select is(
  (select count(*)::int from public.admission_vote_turnout where vote_id = 'ab000000-0000-0000-0000-0000000000ff'),
  1,
  'vote turnout is retained so tallies stay consistent'
);

select is(
  (
    select count(*)::int from public.audit_logs
    where action = 'account.deletion_requested'
      and entity_id = 'f0000000-0000-0000-0000-00000000000d'
  ),
  1,
  'account.deletion_requested is retained after the auth user is gone'
);

select is(
  (
    select count(*)::int from public.audit_logs
    where action = 'account.deleted'
      and entity_id = 'f0000000-0000-0000-0000-00000000000d'
  ),
  0,
  'deleting the auth user does not itself append account.deleted'
);

set local role service_role;

select is(
  (select count(*)::int from public.prepare_account_deletion('f0000000-0000-0000-0000-00000000000d')),
  0,
  'prepare_account_deletion is a no-op for an already deleted account'
);

select lives_ok(
  $sql$ select public.complete_account_deletion('f0000000-0000-0000-0000-00000000000d') $sql$,
  'complete_account_deletion appends account.deleted after the user is gone'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where action = 'account.deleted'
      and entity_type = 'profile'
      and entity_id = 'f0000000-0000-0000-0000-00000000000d'
      and reason_code = 'user_requested'
  ),
  1,
  'account.deleted is written only after the auth user is gone'
);

select lives_ok(
  $sql$ select public.complete_account_deletion('f0000000-0000-0000-0000-00000000000d') $sql$,
  'complete_account_deletion can be retried'
);

select is(
  (
    select count(*)::int from public.audit_logs
    where action = 'account.deleted'
      and entity_id = 'f0000000-0000-0000-0000-00000000000d'
  ),
  1,
  'complete_account_deletion does not append a second account.deleted row'
);

select lives_ok(
  $sql$ select public.complete_account_deletion('f0000000-0000-0000-0000-0000000000aa') $sql$,
  'complete_account_deletion does not raise for an id that never requested deletion'
);

select is(
  (
    select count(*)::int from public.audit_logs
    where action = 'account.deleted'
      and entity_id = 'f0000000-0000-0000-0000-0000000000aa'
  ),
  0,
  'complete_account_deletion appends nothing without a prior deletion request'
);

select ok(
  public.audit_hash_chain_verify(),
  'audit hash chain still verifies after report resolution and account deletion'
);

select * from finish();

rollback;

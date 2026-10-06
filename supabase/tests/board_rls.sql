create extension if not exists pgtap with schema extensions;

begin;

set search_path = public, extensions;

select plan(14);

create function pg_temp.create_board_user(
  p_id uuid,
  p_username text,
  p_member_number bigint default null,
  p_active boolean default false
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
    p_username || '@soulbound.internal',
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
    jsonb_build_object('username', p_username),
    now(),
    now()
  )
  on conflict (id) do nothing;

  update public.profiles
    set role = case when p_active then 'member' else 'applicant' end,
        membership_status = case when p_active then 'active' else 'none' end,
        member_number = p_member_number
  where id = p_id;

  if p_active then
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

select pg_temp.create_board_user(
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'board_member_one',
  1001,
  true
);
select pg_temp.create_board_user(
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'board_member_two',
  1002,
  true
);
select pg_temp.create_board_user(
  'e0000000-0000-0000-0000-000000000003'::uuid,
  'board_applicant',
  null,
  false
);

create temp table board_test_ids (
  key text primary key,
  id uuid not null
) on commit drop;

grant select, insert, update, delete on board_test_ids to service_role, authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-0000-0000-000000000001',
  true
);

with inserted as (
  insert into public.board_posts (author_id, body)
  values (
    'e0000000-0000-0000-0000-000000000001'::uuid,
    'board post from member one'
  )
  returning id
)
insert into board_test_ids (key, id)
select 'post', id from inserted;

with inserted as (
  insert into public.board_comments (post_id, author_id, body)
  values (
    (select id from board_test_ids where key = 'post'),
    'e0000000-0000-0000-0000-000000000001'::uuid,
    'comment from member one'
  )
  returning id
)
insert into board_test_ids (key, id)
select 'comment', id from inserted;

select is(
  (
    select count(*)::int
    from public.board_posts
  ),
  1,
  'active member can read board posts'
);

select is(
  (
    select count(*)::int
    from public.board_comments
  ),
  1,
  'active member can read board comments'
);

select ok(
  (
    select content_hash
    from public.board_posts
    where id = (select id from board_test_ids where key = 'post')
  ) is not null,
  'post trigger fills content_hash'
);

select ok(
  (
    select content_hash
    from public.board_comments
    where id = (select id from board_test_ids where key = 'comment')
  ) is not null,
  'comment trigger fills content_hash'
);

reset role;
set local role service_role;

select is(
  (
    select content_hash
    from public.board_posts
    where id = (select id from board_test_ids where key = 'post')
  ),
  (
    select public.board_content_hash(
      public.board_canonical_post_payload(author_id, body, created_at)
    )
    from public.board_posts
    where id = (select id from board_test_ids where key = 'post')
  ),
  'stored post content_hash matches canonical recomputation'
);

select is(
  (
    select content_hash
    from public.board_comments
    where id = (select id from board_test_ids where key = 'comment')
  ),
  (
    select public.board_content_hash(
      public.board_canonical_comment_payload(post_id, author_id, body, created_at)
    )
    from public.board_comments
    where id = (select id from board_test_ids where key = 'comment')
  ),
  'stored comment content_hash matches canonical recomputation'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-0000-0000-000000000003',
  true
);

select is(
  (
    select count(*)::int
    from public.board_posts
  ),
  0,
  'non-active viewer cannot read board posts'
);

select is(
  pg_temp.sqlstate_for(
    $sql$
      insert into public.board_posts (author_id, body)
      values (
        'e0000000-0000-0000-0000-000000000003'::uuid,
        'inactive applicant attempt'
      )
    $sql$
  ),
  '42501',
  'non-active viewer cannot insert board posts'
);

select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-0000-0000-000000000002',
  true
);

delete from public.board_posts
where id = (select id from board_test_ids where key = 'post');

select is(
  (
    select count(*)::int
    from public.board_posts
    where id = (select id from board_test_ids where key = 'post')
  ),
  1,
  'other active member cannot delete another member post'
);

delete from public.board_comments
where id = (select id from board_test_ids where key = 'comment');

select is(
  (
    select count(*)::int
    from public.board_comments
    where id = (select id from board_test_ids where key = 'comment')
  ),
  1,
  'other active member cannot delete another member comment'
);

select set_config(
  'request.jwt.claim.sub',
  'e0000000-0000-0000-0000-000000000001',
  true
);

delete from public.board_comments
where id = (select id from board_test_ids where key = 'comment');

select is(
  (
    select count(*)::int
    from public.board_comments
    where id = (select id from board_test_ids where key = 'comment')
  ),
  0,
  'author can delete own comment'
);

reset role;
set local role service_role;

delete from public.board_posts
where id = (select id from board_test_ids where key = 'post');

select is(
  (
    select count(*)::int
    from public.board_posts
    where id = (select id from board_test_ids where key = 'post')
  ),
  0,
  'service-role moderation can hard-delete any post'
);

select is(
  has_column_privilege(
    'authenticated',
    'public.board_posts',
    'author_id',
    'SELECT'
  ),
  false,
  'authenticated clients cannot select board post author uuid'
);

select is(
  has_column_privilege(
    'authenticated',
    'public.board_comments',
    'author_id',
    'SELECT'
  ),
  false,
  'authenticated clients cannot select board comment author uuid'
);

select * from finish();

rollback;

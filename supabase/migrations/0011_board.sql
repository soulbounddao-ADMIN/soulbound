create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  content_hash text not null,
  previous_hash text null,
  storage_provider text not null default 'supabase',
  storage_ref text null,
  deleted_at timestamptz null
);

create table public.board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now(),
  content_hash text not null,
  previous_hash text null,
  deleted_at timestamptz null
);

create index board_posts_created_at_id_idx
  on public.board_posts(created_at desc, id desc);

create index board_posts_author_id_idx
  on public.board_posts(author_id);

create index board_comments_post_id_created_at_id_idx
  on public.board_comments(post_id, created_at asc, id asc);

create index board_comments_author_id_idx
  on public.board_comments(author_id);

create or replace function public.board_utc_microseconds(p_value timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select to_char(
    p_value at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  );
$$;

create or replace function public.board_canonical_post_payload(
  p_author_id uuid,
  p_body text,
  p_created_at timestamptz
)
returns text
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', 'board_post',
    'author_id', p_author_id::text,
    'body_hex', encode(convert_to(p_body, 'UTF8'), 'hex'),
    'created_at', public.board_utc_microseconds(p_created_at)
  )::text;
$$;

create or replace function public.board_canonical_comment_payload(
  p_post_id uuid,
  p_author_id uuid,
  p_body text,
  p_created_at timestamptz
)
returns text
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', 'board_comment',
    'post_id', p_post_id::text,
    'author_id', p_author_id::text,
    'body_hex', encode(convert_to(p_body, 'UTF8'), 'hex'),
    'created_at', public.board_utc_microseconds(p_created_at)
  )::text;
$$;

create or replace function public.board_content_hash(p_payload text)
returns text
language sql
stable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_payload, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function public.set_board_post_content_hash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  new.storage_provider := 'supabase';
  new.previous_hash := null;
  new.storage_ref := null;
  new.deleted_at := null;
  new.content_hash := public.board_content_hash(
    public.board_canonical_post_payload(
      new.author_id,
      new.body,
      new.created_at
    )
  );

  return new;
end;
$$;

create or replace function public.set_board_comment_content_hash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  new.previous_hash := null;
  new.deleted_at := null;
  new.content_hash := public.board_content_hash(
    public.board_canonical_comment_payload(
      new.post_id,
      new.author_id,
      new.body,
      new.created_at
    )
  );

  return new;
end;
$$;

create trigger board_posts_content_hash_before_insert
before insert on public.board_posts
for each row execute function public.set_board_post_content_hash();

create trigger board_comments_content_hash_before_insert
before insert on public.board_comments
for each row execute function public.set_board_comment_content_hash();

alter table public.board_posts enable row level security;
alter table public.board_comments enable row level security;

grant all privileges on public.board_posts to service_role;
grant all privileges on public.board_comments to service_role;

revoke all privileges on public.board_posts from anon, authenticated;
revoke all privileges on public.board_comments from anon, authenticated;

grant select (
  id,
  body,
  created_at,
  content_hash,
  previous_hash,
  storage_provider,
  storage_ref,
  deleted_at
) on public.board_posts to authenticated;

grant insert (
  author_id,
  body
) on public.board_posts to authenticated;

grant insert on public.board_posts to authenticated;

grant delete on public.board_posts to authenticated;

grant select (
  id,
  post_id,
  body,
  created_at,
  content_hash,
  previous_hash,
  deleted_at
) on public.board_comments to authenticated;

grant insert (
  post_id,
  author_id,
  body
) on public.board_comments to authenticated;

grant insert on public.board_comments to authenticated;

grant delete on public.board_comments to authenticated;

create policy "board posts select active members"
  on public.board_posts
  for select
  to authenticated
  using (public.is_active_member(auth.uid()));

create policy "board posts insert active own"
  on public.board_posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_member(auth.uid())
  );

create policy "board posts delete own"
  on public.board_posts
  for delete
  to authenticated
  using (
    author_id = auth.uid()
    and public.is_active_member(auth.uid())
  );

create policy "board comments select active members"
  on public.board_comments
  for select
  to authenticated
  using (public.is_active_member(auth.uid()));

create policy "board comments insert active own"
  on public.board_comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_member(auth.uid())
  );

create policy "board comments delete own"
  on public.board_comments
  for delete
  to authenticated
  using (
    author_id = auth.uid()
    and public.is_active_member(auth.uid())
  );

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
    and profile.member_number is not null;
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
  order by comment.created_at asc, comment.id asc;
$$;

grant execute on function public.list_board_posts(integer, timestamptz, uuid)
  to authenticated;
grant execute on function public.get_board_post(uuid) to authenticated;
grant execute on function public.list_board_comments(uuid) to authenticated;

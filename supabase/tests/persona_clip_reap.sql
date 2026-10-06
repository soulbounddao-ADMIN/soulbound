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

insert into public.persona_clip_assets (
  id,
  applicant_id,
  storage_path,
  content_hash,
  mime_type,
  size_bytes,
  status,
  deletion_reason,
  delete_after
)
values
  (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000003',
    'reap-test/due-draft',
    'due-draft',
    'video/webm',
    1,
    'draft',
    null,
    now() - interval '1 minute'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000003',
    'reap-test/future-draft',
    'future-draft',
    'video/webm',
    1,
    'draft',
    null,
    now() + interval '1 hour'
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'reap-test/protected-attached',
    'protected-attached',
    'video/webm',
    1,
    'attached',
    null,
    now() - interval '1 minute'
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000003',
    'reap-test/due-reason',
    'due-reason',
    'video/webm',
    1,
    'attached',
    'policy_cleanup',
    now() - interval '1 minute'
  );

select is(
  pg_temp.sqlstate_for(
    $sql$
      insert into public.persona_clip_assets (
        id,
        applicant_id,
        storage_path,
        content_hash,
        mime_type,
        size_bytes,
        status
      )
      values (
        'd0000000-0000-0000-0000-000000000005',
        'a0000000-0000-0000-0000-000000000003',
        'reap-test/due-draft',
        'duplicate-path',
        'video/webm',
        1,
        'draft'
      )
    $sql$
  ),
  '23505',
  'storage_path uniqueness enforces one evidence row per object'
);

select is(
  (
    select count(*)::int
    from public.list_deletable_persona_clips(
      100,
      'd0000000-0000-0000-0000-000000000001'
    )
  ),
  1,
  'DB-time list includes a due draft'
);

select is(
  (
    select count(*)::int
    from public.list_deletable_persona_clips(
      100,
      'd0000000-0000-0000-0000-000000000002'
    )
  ),
  0,
  'DB-time list excludes a future draft'
);

select is(
  (
    select count(*)::int
    from public.list_deletable_persona_clips(
      100,
      'd0000000-0000-0000-0000-000000000003'
    )
  ),
  0,
  'exact predicate excludes attached clips with no deletion reason'
);

select is(
  public.mark_persona_clip_deleted(
    'd0000000-0000-0000-0000-000000000002'
  ),
  null::uuid,
  'mark refuses a future draft'
);

select is(
  public.mark_persona_clip_deleted(
    'd0000000-0000-0000-0000-000000000003'
  ),
  null::uuid,
  'mark refuses an attached clip with no deletion reason'
);

select is(
  public.mark_persona_clip_deleted(
    'd0000000-0000-0000-0000-000000000004'
  ),
  'd0000000-0000-0000-0000-000000000004'::uuid,
  'mark accepts a due row with an existing deletion reason'
);

select is(
  (
    select deletion_reason
    from public.persona_clip_assets
    where id = 'd0000000-0000-0000-0000-000000000004'
  ),
  'policy_cleanup',
  'DB-side coalesce preserves an existing deletion reason'
);

select ok(
  (
    select deleted_at between now() - interval '5 seconds'
      and now() + interval '5 seconds'
    from public.persona_clip_assets
    where id = 'd0000000-0000-0000-0000-000000000004'
  ),
  'deleted_at is stamped with DB time'
);

select is(
  public.mark_persona_clip_deleted(
    'd0000000-0000-0000-0000-000000000001'
  ),
  'd0000000-0000-0000-0000-000000000001'::uuid,
  'mark accepts a due draft'
);

select is(
  (
    select deletion_reason
    from public.persona_clip_assets
    where id = 'd0000000-0000-0000-0000-000000000001'
  ),
  'draft_abandoned',
  'DB-side coalesce records draft_abandoned for a null reason'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.list_deletable_persona_clips(integer,uuid)',
    'EXECUTE'
  ),
  'service_role can execute the reap list RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.mark_persona_clip_deleted(uuid)',
    'EXECUTE'
  ),
  'service_role can execute the reap mark RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.list_deletable_persona_clips(integer,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute the reap list RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.mark_persona_clip_deleted(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute the reap mark RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.list_deletable_persona_clips(integer,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute the reap list RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.mark_persona_clip_deleted(uuid)',
    'EXECUTE'
  ),
  'anon cannot execute the reap mark RPC'
);

select * from finish();

rollback;

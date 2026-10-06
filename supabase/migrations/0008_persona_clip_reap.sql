create unique index persona_clip_assets_storage_path_key
  on public.persona_clip_assets(storage_path);

create or replace function public.list_deletable_persona_clips(
  p_limit integer default 100,
  p_asset_id uuid default null
)
returns table (
  id uuid,
  storage_path text,
  status text,
  deletion_reason text,
  delete_after timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.storage_path,
    c.status,
    c.deletion_reason,
    c.delete_after
  from public.persona_clip_assets c
  where c.status <> 'deleted'
    and c.delete_after is not null
    and c.delete_after <= now()
    and (
      c.deletion_reason is not null
      or c.status = 'draft'
    )
    and (
      p_asset_id is null
      or c.id = p_asset_id
    )
  order by c.delete_after, c.id
  limit greatest(coalesce(p_limit, 100), 0);
$$;

revoke execute on function public.list_deletable_persona_clips(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.list_deletable_persona_clips(integer, uuid)
  to service_role;

create or replace function public.mark_persona_clip_deleted(
  p_asset_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset_id uuid;
begin
  update public.persona_clip_assets c
    set status = 'deleted',
        deleted_at = now(),
        deletion_reason = coalesce(c.deletion_reason, 'draft_abandoned')
  where c.id = p_asset_id
    and c.status <> 'deleted'
    and c.delete_after is not null
    and c.delete_after <= now()
    and (
      c.deletion_reason is not null
      or c.status = 'draft'
    )
  returning c.id into v_asset_id;

  return v_asset_id;
end;
$$;

revoke execute on function public.mark_persona_clip_deleted(uuid)
  from public, anon, authenticated;
grant execute on function public.mark_persona_clip_deleted(uuid)
  to service_role;

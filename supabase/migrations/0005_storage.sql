insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'persona-clips',
  'persona-clips',
  false,
  52428800,
  array['video/webm', 'video/mp4', 'audio/webm', 'audio/mp4']::text[]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "persona clips insert own path"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'persona-clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "persona clips select own path"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'persona-clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "persona clips delete own path"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'persona-clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

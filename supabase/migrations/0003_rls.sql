grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to service_role;

revoke all privileges on all tables in schema public from anon, authenticated;

create or replace function public.is_active_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.membership_status = 'active'
  );
$$;

revoke execute on function public.is_active_member(uuid) from public, anon;
grant execute on function public.is_active_member(uuid) to authenticated, service_role;

create or replace function public.is_application_owner(
  p_application_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admission_applications a
    where a.id = p_application_id
      and a.applicant_id = p_user_id
  );
$$;

revoke execute on function public.is_application_owner(uuid, uuid) from public, anon;
grant execute on function public.is_application_owner(uuid, uuid) to authenticated, service_role;

create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.direct_conversations c
    where c.id = p_conversation_id
      and p_user_id in (c.initiator_id, c.recipient_id)
  );
$$;

revoke execute on function public.is_conversation_participant(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.admission_applications enable row level security;
alter table public.admission_events enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_logs enable row level security;
alter table public.outbox_events enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.conversation_key_envelopes enable row level security;
alter table public.persona_clip_assets enable row level security;
alter table public.soul_balances enable row level security;
alter table public.soul_ledger_events enable row level security;
alter table public.evidence_files enable row level security;
alter table public.reports enable row level security;
alter table public.slash_cases enable row level security;
alter table public.decision_receipts enable row level security;
alter table public.emergency_actions enable row level security;
alter table public.user_intent_authorizations enable row level security;

grant select (
  id,
  handle,
  display_name,
  bio,
  avatar_url,
  membership_status,
  created_at,
  updated_at
) on public.profiles to authenticated;

grant update (
  handle,
  display_name,
  bio,
  avatar_url
) on public.profiles to authenticated;

create policy "profiles select own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "profiles select active public"
  on public.profiles
  for select
  to authenticated
  using (
    membership_status = 'active'
    and public.is_active_member(auth.uid())
  );

create policy "profiles update own safe columns"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select (
  id,
  applicant_id,
  status,
  applicant_statement,
  motivation,
  referral_code,
  reviewer_id,
  reviewed_at,
  applicant_notice,
  policy_version,
  policy_snapshot_hash,
  persona_clip_asset_id,
  persona_clip_hash,
  ledger_ticket_ref,
  ledger_tx_ref,
  created_at,
  updated_at
) on public.admission_applications to authenticated;

grant update (
  applicant_statement,
  motivation,
  referral_code
) on public.admission_applications to authenticated;

create policy "admission applications select own"
  on public.admission_applications
  for select
  to authenticated
  using (applicant_id = auth.uid());

create policy "admission applications update own draft safe columns"
  on public.admission_applications
  for update
  to authenticated
  using (applicant_id = auth.uid() and status = 'draft')
  with check (applicant_id = auth.uid() and status = 'draft');

grant select (
  id,
  user_id,
  status,
  tier,
  issued_at,
  expires_at,
  revoked_at
) on public.memberships to authenticated;

create policy "memberships select own"
  on public.memberships
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "memberships select active public"
  on public.memberships
  for select
  to authenticated
  using (
    status = 'active'
    and public.is_active_member(auth.uid())
  );

grant select, insert, delete on public.persona_clip_assets to authenticated;

create policy "persona clip assets insert own"
  on public.persona_clip_assets
  for insert
  to authenticated
  with check (
    applicant_id = auth.uid()
    and (
      application_id is null
      or public.is_application_owner(application_id, auth.uid())
    )
  );

create policy "persona clip assets select own"
  on public.persona_clip_assets
  for select
  to authenticated
  using (applicant_id = auth.uid());

create policy "persona clip assets delete own"
  on public.persona_clip_assets
  for delete
  to authenticated
  using (applicant_id = auth.uid());

grant select (
  id,
  initiator_id,
  recipient_id,
  status,
  created_at,
  updated_at
) on public.direct_conversations to authenticated;

create policy "direct conversations select participant"
  on public.direct_conversations
  for select
  to authenticated
  using (auth.uid() in (initiator_id, recipient_id));

grant select (
  id,
  conversation_id,
  sender_id,
  ciphertext,
  algo,
  created_at
) on public.direct_messages to authenticated;

create policy "direct messages select participant"
  on public.direct_messages
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()));

grant select (
  id,
  conversation_id,
  recipient_id,
  recipient_device_id,
  recipient_device_pubkey,
  wrapped_key,
  algo,
  key_epoch,
  created_at
) on public.conversation_key_envelopes to authenticated;

create policy "conversation key envelopes select own"
  on public.conversation_key_envelopes
  for select
  to authenticated
  using (recipient_id = auth.uid());

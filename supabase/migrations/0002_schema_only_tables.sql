create table public.direct_conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  initiator_id uuid references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired', 'blocked', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index direct_conversations_initiator_id_idx
  on public.direct_conversations(initiator_id);

create index direct_conversations_recipient_id_idx
  on public.direct_conversations(recipient_id);

create table public.direct_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  ciphertext bytea not null,
  algo text not null default 'x25519-xsalsa20-poly1305',
  created_at timestamptz not null default now()
);

create index direct_messages_conversation_id_created_at_idx
  on public.direct_messages(conversation_id, created_at);

create table public.conversation_key_envelopes (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  recipient_device_id uuid not null,
  recipient_device_pubkey text not null,
  wrapped_key bytea not null,
  algo text not null default 'x25519-xsalsa20-poly1305',
  key_epoch integer not null default 0,
  created_at timestamptz not null default now(),
  unique (conversation_id, recipient_id, recipient_device_id, key_epoch)
);

create index conversation_key_envelopes_recipient_id_idx
  on public.conversation_key_envelopes(recipient_id);

create table public.persona_clip_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.admission_applications(id) on delete set null,
  storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase', 'ipfs', 'filecoin', 'arweave')),
  storage_path text not null,
  content_hash text not null,
  mime_type text not null,
  size_bytes bigint not null,
  duration_seconds integer,
  status text not null default 'attached'
    check (status in ('draft', 'attached', 'deleted')),
  deletion_reason text
    check (
      deletion_reason is null
      or deletion_reason in (
        'draft_abandoned',
        'application_approved',
        'application_rejected',
        'application_withdrawn',
        'application_expired',
        'policy_cleanup'
      )
    ),
  delete_after timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index persona_clip_assets_applicant_id_idx
  on public.persona_clip_assets(applicant_id);

create index persona_clip_assets_application_id_idx
  on public.persona_clip_assets(application_id);

create index persona_clip_assets_delete_after_idx
  on public.persona_clip_assets(delete_after)
  where delete_after is not null and status != 'deleted';

alter table public.admission_applications
  add column persona_clip_asset_id uuid references public.persona_clip_assets(id),
  add column persona_clip_hash text;

create table public.soul_balances (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  available_amount numeric(38, 0) not null default 0,
  locked_amount numeric(38, 0) not null default 0,
  ledger_balance_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table public.soul_ledger_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  amount numeric(38, 0) not null default 0,
  ledger_tx_ref text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.evidence_files (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.admission_applications(id) on delete set null,
  storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase', 'ipfs', 'filecoin', 'arweave')),
  object_path text,
  content_hash text not null,
  mime_type text,
  size_bytes bigint,
  retention_policy text,
  ipfs_cid text,
  filecoin_deal_id text,
  arweave_tx_id text,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  subject_user_id uuid references public.profiles(id) on delete set null,
  reason_code text,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'resolved', 'dismissed')),
  evidence_file_id uuid references public.evidence_files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.slash_cases (
  id uuid primary key default extensions.gen_random_uuid(),
  subject_user_id uuid references public.profiles(id) on delete set null,
  state text not null default 'draft'
    check (state in ('draft', 'open', 'decided', 'appealed', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decision_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  case_id uuid references public.slash_cases(id) on delete cascade,
  decision_hash text not null,
  appeal_deadline timestamptz,
  created_at timestamptz not null default now()
);

create table public.emergency_actions (
  id uuid primary key default extensions.gen_random_uuid(),
  action_type text not null,
  reason_code text,
  review_required boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_intent_authorizations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null,
  payload_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

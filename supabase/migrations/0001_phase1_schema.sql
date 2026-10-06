create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  bio text,
  avatar_url text,
  membership_status text not null default 'none'
    check (membership_status in ('none', 'active', 'suspended', 'revoked')),
  role text not null default 'applicant'
    check (role in ('applicant', 'member', 'reviewer', 'admin')),
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admission_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'submitted',
        'under_review',
        'needs_more_info',
        'approved',
        'rejected',
        'withdrawn',
        'expired'
      )
    ),
  applicant_statement text,
  motivation text,
  referral_code text,
  reviewer_id uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_summary text,
  applicant_notice text,
  policy_version text not null,
  policy_snapshot_hash text,
  ledger_ticket_ref text,
  ledger_tx_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admission_applications_applicant_id_idx
  on public.admission_applications(applicant_id);

create index admission_applications_status_created_at_idx
  on public.admission_applications(status, created_at);

create unique index admission_applications_one_active_per_applicant_idx
  on public.admission_applications(applicant_id)
  where status in ('draft', 'submitted', 'under_review', 'needs_more_info');

create table public.admission_events (
  id uuid primary key default extensions.gen_random_uuid(),
  application_id uuid not null references public.admission_applications(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  from_status text,
  to_status text not null,
  reason_code text
    check (
      reason_code is null
      or reason_code in (
        'meets_phase1_policy',
        'insufficient_context',
        'mismatch_with_policy',
        'needs_identity_clarification',
        'duplicate_identity_suspected',
        'applicant_withdrew',
        'application_expired'
      )
    ),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index admission_events_application_id_created_at_idx
  on public.admission_events(application_id, created_at);

create table public.memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  tier text not null default 'basic'
    check (tier in ('basic', 'trusted', 'founding', 'admin')),
  source_application_id uuid references public.admission_applications(id),
  ledger_credential_ref text,
  ledger_tx_ref text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create unique index memberships_one_active_per_user_idx
  on public.memberships(user_id)
  where status = 'active';

create index memberships_user_id_idx
  on public.memberships(user_id);

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null
    check (
      action in (
        'application.submit',
        'application.review_started',
        'application.more_info_requested',
        'application.approved',
        'application.rejected',
        'membership.issued',
        'role.changed'
      )
    ),
  entity_type text not null,
  entity_id uuid,
  reason_code text
    check (
      reason_code is null
      or reason_code in (
        'meets_phase1_policy',
        'insufficient_context',
        'mismatch_with_policy',
        'needs_identity_clarification',
        'duplicate_identity_suspected',
        'applicant_withdrew',
        'application_expired'
      )
    ),
  metadata jsonb not null default '{}'::jsonb,
  hash text,
  previous_hash text,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_id_idx
  on public.audit_logs(entity_id);

create index audit_logs_created_at_id_idx
  on public.audit_logs(created_at, id);

create table public.outbox_events (
  id uuid primary key default extensions.gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  target text not null default 'internal'
    check (target in ('internal', 'external_ledger', 'icp', 'filecoin', 'arweave')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'dead_letter')),
  idempotency_key text not null unique,
  attempt_count integer not null default 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index outbox_events_claim_idx
  on public.outbox_events(status, created_at)
  where status in ('pending', 'processing');

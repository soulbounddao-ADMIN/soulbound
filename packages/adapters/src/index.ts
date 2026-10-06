export {
  createAnonSupabaseClient,
  createBrowserSupabaseClient,
  createServiceRoleSupabaseClient,
  createUserSupabaseClient,
} from "./supabase/clients";
export type { SupabaseAdapterClient } from "./supabase/clients";

export {
  mapAdmissionApplicationRow,
  mapApproveOutcomeRow,
  mapMembershipRow,
  mapOutboxEventRow,
} from "./supabase/mappers";
export {
  mapPostgresError,
  throwIfSupabaseError,
} from "./supabase/errors";

export {
  SupabaseAuthAdapter,
  makeSupabaseAuthAdapter,
} from "./supabase/supabase-auth-adapter";
export {
  SupabaseAdmissionRepository,
  makeServiceRoleAdmissionRepository,
  makeUserScopedAdmissionRepository,
} from "./supabase/supabase-admission-repository";
export {
  SupabaseMembershipRepository,
  makeSupabaseMembershipRepository,
} from "./supabase/supabase-membership-repository";
export {
  SupabaseMemberDirectoryRepository,
  makeUserScopedMemberDirectoryRepository,
} from "./supabase/supabase-member-directory-repository";
export type {
  ListActiveMembersInput,
  ListActiveMembersResult,
  MemberDirectoryEntry,
} from "./supabase/supabase-member-directory-repository";
export {
  SupabaseAuditLogRepository,
  makeSupabaseAuditLogRepository,
} from "./supabase/supabase-audit-log-repository";
export {
  SupabaseOutboxRepository,
  makeSupabaseOutboxRepository,
} from "./supabase/supabase-outbox-repository";
export {
  SupabaseStorageAdapter,
  makeSupabaseStorageAdapter,
} from "./supabase/supabase-storage-adapter";
export type {
  ClearSubmittedPersonaClipRetentionInput,
  CreatePersonaClipUploadUrlInput,
  MarkOwnDraftForDeletionInput,
  PersonaClipUploadContract,
  PersonaClipUploadUrl,
  PurgeOwnerPersonaClipsInput,
  PurgeOwnerPersonaClipsResult,
  ReapDeletablePersonaClipsInput,
  ReapDeletablePersonaClipsResult,
} from "./supabase/supabase-storage-adapter";
export {
  SupabaseAccountDeletionAdapter,
  makeSupabaseAccountDeletionAdapter,
} from "./supabase/supabase-account-deletion-adapter";
export type {
  AuthUserDeletionOutcome,
  PreparedAccountDeletion,
} from "./supabase/supabase-account-deletion-adapter";

export {
  NoopLedgerAdapter,
  makeNoopLedgerAdapter,
} from "./noop/noop-ledger-adapter";
export {
  NoopNotificationAdapter,
  makeNoopNotificationAdapter,
} from "./noop/noop-notification-adapter";

export { makeCoreContainer } from "./container";
export type { CoreContainerConfig } from "./container";

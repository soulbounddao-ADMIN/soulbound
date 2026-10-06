import {
  DefaultAdmissionService,
  DefaultMembershipService,
  featureFlags,
} from "@soulbound/core";
import type { CoreContainer } from "@soulbound/core";
import { createServiceRoleSupabaseClient } from "./supabase/clients";
import { makeServiceRoleAdmissionRepository } from "./supabase/supabase-admission-repository";
import { makeSupabaseMembershipRepository } from "./supabase/supabase-membership-repository";
import { makeSupabaseOutboxRepository } from "./supabase/supabase-outbox-repository";
import { makeNoopLedgerAdapter } from "./noop/noop-ledger-adapter";

export interface CoreContainerConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

export function makeCoreContainer(config: CoreContainerConfig): CoreContainer {
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });

  return {
    admissionService: new DefaultAdmissionService({
      admissionRepo: makeServiceRoleAdmissionRepository(serviceRoleClient),
      outboxRepo: makeSupabaseOutboxRepository(serviceRoleClient),
      ledger: makeNoopLedgerAdapter(),
      flags: featureFlags,
    }),
    membershipService: new DefaultMembershipService({
      membershipRepo: makeSupabaseMembershipRepository(serviceRoleClient),
    }),
  };
}

import type { AuthSession, UserRole } from "@soulbound/core";
import {
  createAnonSupabaseClient,
  createServiceRoleSupabaseClient,
  makeCoreContainer,
  makeSupabaseAuthAdapter,
} from ".";

declare const process: {
  readonly env: Record<string, string | undefined>;
};

interface IntegrationConfig {
  readonly url: string;
  readonly anonKey: string;
  readonly serviceRoleKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Start local Supabase and export SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY before running adapters integration tests.`,
    );
  }

  return value;
}

function readConfig(): IntegrationConfig {
  return {
    url: requireEnv("SUPABASE_URL"),
    anonKey: requireEnv("SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function signIn(
  config: IntegrationConfig,
  email: string,
  password: string,
): Promise<AuthSession> {
  const authAdapter = makeSupabaseAuthAdapter(
    createAnonSupabaseClient({
      url: config.url,
      anonKey: config.anonKey,
    }),
  );

  return authAdapter.signIn({ email, password });
}

async function createThrowawayUser(
  config: IntegrationConfig,
  role: Extract<UserRole, "applicant" | "reviewer">,
): Promise<{ readonly email: string; readonly password: string }> {
  const serviceRoleClient = createServiceRoleSupabaseClient({
    url: config.url,
    serviceRoleKey: config.serviceRoleKey,
  });
  const suffix = uniqueSuffix();
  const email = `task5-${role}-${suffix}@soulbound.local`;
  const password = `Task5-${suffix}!`;
  const username = `task5_${role}_${suffix.replace(/[^a-z0-9]/g, "")}`
    .slice(0, 24);

  const { data: created, error: createError } =
    await serviceRoleClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
      app_metadata: {},
    });

  if (createError) {
    throw createError;
  }

  const userId = created.user?.id;
  if (!userId) {
    throw new Error("Supabase admin createUser returned no user id.");
  }

  const { error: profileError } = await serviceRoleClient
    .from("profiles")
    .upsert(
      {
        id: userId,
        handle: `task5-${role}-${suffix}`,
        username,
        role,
        membership_status: role === "reviewer" ? "active" : "none",
        ...(role === "reviewer"
          ? { member_number: Date.now() * 1000 + Math.floor(Math.random() * 1000) }
          : {}),
      },
      { onConflict: "id" },
    );

  if (profileError) {
    throw profileError;
  }

  return { email, password };
}

describe("makeCoreContainer integration", () => {
  it("signs in seeded users and resolves roles from current_user_role", async () => {
    const config = readConfig();
    const seededUsers = [
      {
        email: "admin@soulbound.local",
        role: "admin",
      },
      {
        email: "reviewer@soulbound.local",
        role: "reviewer",
      },
      {
        email: "applicant@soulbound.local",
        role: "applicant",
      },
    ] as const;

    for (const seededUser of seededUsers) {
      const session = await signIn(config, seededUser.email, "password123");

      expect(session.role).toBe(seededUser.role);
    }
  });

  it("wires the reviewer approval path through live auth, services, and Supabase adapters", async () => {
    const config = readConfig();
    const container = makeCoreContainer({
      url: config.url,
      serviceRoleKey: config.serviceRoleKey,
    });
    const reviewerCredentials = await createThrowawayUser(config, "reviewer");
    const applicantCredentials = await createThrowawayUser(config, "applicant");

    const reviewerSession = await signIn(
      config,
      reviewerCredentials.email,
      reviewerCredentials.password,
    );
    expect(reviewerSession.role).toBe("reviewer");

    const applicantSession = await signIn(
      config,
      applicantCredentials.email,
      applicantCredentials.password,
    );
    expect(applicantSession.role).toBe("applicant");

    const submit = await container.admissionService.submitApplication({
      applicantId: applicantSession.userId,
      applicantStatement: "Task 5 integration applicant statement.",
      motivation: "Prove service composition without HTTP.",
      idempotencyKey: `task5-submit-${uniqueSuffix()}`,
    });
    expect(submit.ok).toBe(true);
    if (!submit.ok) {
      throw new Error(`submitApplication failed: ${submit.error.code}`);
    }

    const start = await container.admissionService.startReview({
      actor: {
        id: reviewerSession.userId,
        role: reviewerSession.role,
      },
      applicationId: submit.value.id,
      idempotencyKey: `task5-start-${uniqueSuffix()}`,
    });
    expect(start.ok).toBe(true);
    if (!start.ok) {
      throw new Error(`startReview failed: ${start.error.code}`);
    }

    const forbidden = await container.admissionService.approveApplication({
      actor: {
        id: applicantSession.userId,
        role: applicantSession.role,
      },
      applicationId: submit.value.id,
      reasonCode: "meets_phase1_policy",
      idempotencyKey: `task5-forbidden-${uniqueSuffix()}`,
    });
    expect(forbidden.ok).toBe(false);
    if (forbidden.ok) {
      throw new Error("applicant approval unexpectedly succeeded");
    }
    expect(forbidden.error.code).toBe("FORBIDDEN");

    const approve = await container.admissionService.approveApplication({
      actor: {
        id: reviewerSession.userId,
        role: reviewerSession.role,
      },
      applicationId: submit.value.id,
      reasonCode: "meets_phase1_policy",
      applicantNotice: "Approved by Task 5 integration test.",
      reviewSummary: "Task 5 reviewer path proved through live adapters.",
      idempotencyKey: `task5-approve-${uniqueSuffix()}`,
    });
    expect(approve.ok).toBe(true);
    if (!approve.ok) {
      throw new Error(`approveApplication failed: ${approve.error.code}`);
    }
    expect(approve.value.application.status).toBe("approved");
    expect(approve.value.membership.status).toBe("active");

    const membership = await container.membershipService.getMyMembership(
      applicantSession.userId,
    );
    expect(membership.ok).toBe(true);
    if (!membership.ok) {
      throw new Error(`getMyMembership failed: ${membership.error.code}`);
    }
    expect(membership.value?.status).toBe("active");
    expect(membership.value?.id).toBe(approve.value.membership.id);
  });
});

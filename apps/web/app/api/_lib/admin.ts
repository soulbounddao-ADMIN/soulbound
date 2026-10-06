import type {
  Actor,
  AdmissionApplication,
  AdmissionRepository,
  ReviewDecisionCommand,
} from "@soulbound/core";
import {
  createServiceRoleSupabaseClient,
  makeServiceRoleAdmissionRepository,
} from "@soulbound/adapters";
import { readWebEnv } from "./env";
import { jsonResponse } from "./http";
import type { ReviewDecisionBody } from "./schemas";

export interface AdminApplication extends AdmissionApplication {
  readonly applicantUsername: string | null;
  readonly reviewerUsername?: string | null;
}

export function requireReviewer(actor: Actor): Response | null {
  if (actor.role === "reviewer" || actor.role === "admin") {
    return null;
  }

  return jsonResponse({
    error: {
      code: "FORBIDDEN",
      message: "reviewer role required",
    },
  }, 403);
}

function serviceRoleClient() {
  const env = readWebEnv();
  return createServiceRoleSupabaseClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
  });
}

export function serviceRoleAdmissionRepo(): AdmissionRepository {
  return makeServiceRoleAdmissionRepository(serviceRoleClient());
}

async function profileUsername(
  client: ReturnType<typeof createServiceRoleSupabaseClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  return (data as { readonly username?: string | null } | null)?.username ?? null;
}

export async function enrichAdminApplicationUsernames(
  application: AdmissionApplication,
): Promise<AdminApplication> {
  const client = serviceRoleClient();
  const [applicantUsername, reviewerUsername] = await Promise.all([
    profileUsername(client, application.applicantId),
    application.reviewerId
      ? profileUsername(client, application.reviewerId)
      : Promise.resolve(null),
  ]);

  return {
    ...application,
    applicantUsername,
    ...(application.reviewerId ? { reviewerUsername } : {}),
  };
}

export async function enrichAdminQueueUsernames(
  applications: readonly AdmissionApplication[],
): Promise<readonly AdminApplication[]> {
  const client = serviceRoleClient();
  return await Promise.all(applications.map(async (application) => ({
    ...application,
    applicantUsername: await profileUsername(client, application.applicantId),
  })));
}

export function reviewDecisionOptionalProps(
  body: ReviewDecisionBody,
): Pick<ReviewDecisionCommand, "applicantNotice" | "reviewSummary"> {
  return {
    ...(body.applicantNotice !== undefined
      ? { applicantNotice: body.applicantNotice }
      : {}),
    ...(body.reviewSummary !== undefined
      ? { reviewSummary: body.reviewSummary }
      : {}),
  };
}

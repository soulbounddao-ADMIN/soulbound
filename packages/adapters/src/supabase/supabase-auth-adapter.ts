import type {
  AuthCredentials,
  AuthPort,
  AuthSession,
  UserRole,
} from "@soulbound/core";
import type { SupabaseAdapterClient } from "./clients";
import { dependencyFailure } from "@soulbound/core";
import { throwIfSupabaseError } from "./errors";

function sessionFromUser(userId: string, role: UserRole): AuthSession {
  return {
    userId,
    role,
  };
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "applicant"
    || value === "member"
    || value === "reviewer"
    || value === "admin"
  );
}

export class SupabaseAuthAdapter implements AuthPort {
  constructor(private readonly client: SupabaseAdapterClient) {}

  async signUp(input: AuthCredentials): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
    });

    throwIfSupabaseError(error);

    if (!data.user) {
      throw dependencyFailure("supabase signUp returned no user");
    }

    return sessionFromUser(
      data.user.id,
      "applicant",
    );
  }

  async signIn(input: AuthCredentials): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    throwIfSupabaseError(error);

    if (!data.user) {
      throw dependencyFailure("supabase signIn returned no user");
    }

    return sessionFromUser(
      data.user.id,
      await this.resolveCurrentUserRole(),
    );
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    throwIfSupabaseError(error);

    const userId = data.session?.user.id;
    if (!userId) {
      return null;
    }

    return sessionFromUser(
      userId,
      await this.resolveCurrentUserRole(),
    );
  }

  async getUserId(): Promise<string | null> {
    const { data, error } = await this.client.auth.getUser();
    throwIfSupabaseError(error);
    return data.user?.id ?? null;
  }

  private async resolveCurrentUserRole(): Promise<UserRole> {
    const { data, error } = await this.client.rpc("current_user_role");
    if (error) {
      return "applicant";
    }

    return isUserRole(data) ? data : "applicant";
  }
}

export function makeSupabaseAuthAdapter(
  client: SupabaseAdapterClient,
): AuthPort {
  return new SupabaseAuthAdapter(client);
}

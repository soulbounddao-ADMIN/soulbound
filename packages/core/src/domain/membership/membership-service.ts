/**
 * ⛔ CONTRACT-FROZEN signatures — owned by Cowork.
 * Cline implements the body in Task 2. To change, say "unfreeze contract".
 */
import type { Result } from "../../application/result";
import type { AppError } from "../../application/errors";
import type { MembershipRepository } from "../../ports/membership-repository";
import type { Membership } from "./types";
import { ok } from "../../application/result";

export interface MembershipServiceDeps {
  readonly membershipRepo: MembershipRepository;
}

export interface MembershipService {
  getMyMembership(userId: string): Promise<Result<Membership | null, AppError>>;
}

/**
 * Task 2 — service body implementation.
 */
export class DefaultMembershipService implements MembershipService {
  constructor(private readonly deps: MembershipServiceDeps) {}

  async getMyMembership(
    userId: string,
  ): Promise<Result<Membership | null, AppError>> {
    const membership = await this.deps.membershipRepo.findByUserId(userId);
    return ok(membership);
  }
}

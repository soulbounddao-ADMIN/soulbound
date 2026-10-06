import { makeUserScopedAdmissionRepository } from "@soulbound/adapters";
import { userClientFromRequest } from "./auth";

export function userScopedAdmissionRepo(request: Request) {
  const client = userClientFromRequest(request);
  if (!client) {
    return null;
  }

  return makeUserScopedAdmissionRepository(client);
}

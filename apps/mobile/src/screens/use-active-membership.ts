import type { Membership } from "@soulbound/core";
import { useCallback, useEffect, useState } from "react";
import { getMyMembership } from "../api/endpoints";
import { useAuth } from "../auth/auth-provider";
import { useSessionGuard } from "../lib/use-session-guard";

export type MembershipState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "inactive" }
  | { readonly kind: "active"; readonly membership: Membership };

export function useActiveMembership() {
  const { api } = useAuth();
  const guard = useSessionGuard();
  const [state, setState] = useState<MembershipState>({ kind: "loading" });

  const reload = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const result = await getMyMembership(api);
      if (await guard(result.status)) {
        return;
      }
      if (!result.ok) {
        setState({ kind: "error" });
        return;
      }
      setState(result.data?.status === "active"
        ? { kind: "active", membership: result.data }
        : { kind: "inactive" });
    } catch (error) {
      if (!(await guard(error))) {
        setState({ kind: "error" });
      }
    }
  }, [api, guard]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}

import { useCallback } from "react";
import { UnauthenticatedError } from "../api/client";
import { useAuth } from "../auth/auth-provider";

// Returns true when the error/status means the session is gone; the session is
// then cleared and the protected navigator sends the user back to login.
export function useSessionGuard() {
  const { expireSession } = useAuth();
  return useCallback(async (statusOrError: number | unknown): Promise<boolean> => {
    if (statusOrError === 401 || statusOrError instanceof UnauthenticatedError) {
      await expireSession();
      return true;
    }
    return false;
  }, [expireSession]);
}

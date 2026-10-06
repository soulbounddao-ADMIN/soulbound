const LAST_APPLICATION_ID_KEY = "soulbound:last-application-id";

export function rememberApplicationId(applicationId: string): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(LAST_APPLICATION_ID_KEY, applicationId);
  }
}

export function readRememberedApplicationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(LAST_APPLICATION_ID_KEY);
}

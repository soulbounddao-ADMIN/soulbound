// In-memory equivalent of the web sessionStorage "last application id".
let lastApplicationId: string | null = null;

export function rememberApplicationId(id: string): void {
  lastApplicationId = id;
}

export function readRememberedApplicationId(): string | null {
  return lastApplicationId;
}

export function forgetApplicationId(): void {
  lastApplicationId = null;
}

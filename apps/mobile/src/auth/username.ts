export const usernamePattern = /^[a-z0-9][a-z0-9_-]{2,23}$/;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return usernamePattern.test(normalizeUsername(username));
}

export function usernameToSyntheticEmail(username: string): string {
  const normalized = normalizeUsername(username);
  if (!usernamePattern.test(normalized)) {
    throw new Error("Invalid username");
  }
  return `${normalized}@soulbound.internal`;
}

export const MIN_PASSWORD_LENGTH = 6;

export const DEFAULT_PRIVACY_CONTACT_EMAIL = "soulbound.dao@gmail.com";

export function privacyContactEmail(
  raw: string | null | undefined = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL,
): string {
  const trimmed = raw?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : DEFAULT_PRIVACY_CONTACT_EMAIL;
}

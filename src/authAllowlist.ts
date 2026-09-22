/** The only email that may request a magic link. Do not add addresses here. */
export const ALLOWED_SYNC_EMAIL = "whman63@gmail.com";

export class NotInvitedError extends Error {
  constructor() {
    super("This email is not invited.");
    this.name = "NotInvitedError";
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAllowlistedEmail(email: string) {
  return normalizeEmail(email) === ALLOWED_SYNC_EMAIL;
}

/**
 * Rejects every other address before a magic link can be requested.
 * `send` is not called unless the address is on the allowlist.
 */
export async function requestMagicLink(email: string, send: (normalizedEmail: string) => Promise<void>) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Enter an email address.");
  if (!isAllowlistedEmail(normalized)) throw new NotInvitedError();
  await send(normalized);
}

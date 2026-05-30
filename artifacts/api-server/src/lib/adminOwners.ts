const DEFAULT_OWNER_EMAILS = [
  "kamyckijoseph@gmail.com",
  "michaelgang31@gmail.com",
] as const;

function normalizeEmailList(values: Array<string | undefined>) {
  const emails = values
    .flatMap(value => (value ?? "").split(","))
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_OWNER_EMAILS, ...emails]));
}

export const OWNER_EMAILS = normalizeEmailList([
  process.env.ADMIN_EMAIL,
  process.env.ADMIN_EMAILS,
]);

export function isOwnerEmail(email: string) {
  return OWNER_EMAILS.includes(email.trim().toLowerCase());
}

/** Preserve an already public date, but never keep a future schedule on publish-now. */
export function publicationDate(
  values: { status: string; scheduledAt: Date | null },
  before: { status: string; publishedAt: Date | null } | undefined,
  now: Date,
) {
  if (values.status === "scheduled") return values.scheduledAt;
  if (values.status !== "published") return null;
  if (before?.status === "published" && before.publishedAt && before.publishedAt <= now) return before.publishedAt;
  return now;
}

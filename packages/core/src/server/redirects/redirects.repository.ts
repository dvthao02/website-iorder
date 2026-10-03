import { asc, eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, redirects } from "@iorder/core/db/schema";
import type { RedirectInput } from "./redirects.contract";

export function listRedirects() { return getDb().select().from(redirects).orderBy(asc(redirects.sourcePath)); }
export async function findEnabledRedirect(sourcePath: string) {
  const [row] = await getDb().select().from(redirects).where(eq(redirects.sourcePath, sourcePath)).limit(1);
  return row?.isEnabled ? row : null;
}
export function saveRedirect(id: string | null, values: RedirectInput, userId: string) {
  return getDb().transaction(async (tx) => {
    const [before] = id ? await tx.select().from(redirects).where(eq(redirects.id, id)).for("update") : [];
    if (id && !before) return undefined;
    const [after] = id ? await tx.update(redirects).set({ ...values, updatedAt: new Date() }).where(eq(redirects.id, id)).returning() : await tx.insert(redirects).values(values).returning();
    await tx.insert(auditLogs).values({ userId, action: id ? "redirect.update" : "redirect.create", entityType: "redirect", entityId: after.id, beforeData: before ?? null, afterData: values });
    return after.id;
  });
}

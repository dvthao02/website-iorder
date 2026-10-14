import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, redirects } from "@iorder/core/db/schema";
import type { RedirectInput } from "./redirects.contract";
import { assertNoRedirectCycle } from "./redirect-cycle";

export function listRedirects() { return getDb().select().from(redirects).where(isNull(redirects.deletedAt)).orderBy(asc(redirects.sourcePath)); }
export async function findEnabledRedirect(sourcePath: string) {
  const [row] = await getDb().select().from(redirects).where(and(eq(redirects.sourcePath, sourcePath), eq(redirects.isEnabled, true), isNull(redirects.deletedAt))).limit(1);
  return row ?? null;
}
export function saveRedirect(id: string | null, values: RedirectInput, userId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`lock table ${redirects} in share row exclusive mode`);
    const [before] = id ? await tx.select().from(redirects).where(and(eq(redirects.id, id), isNull(redirects.deletedAt))).for("update") : [];
    if (id && !before) return undefined;
    const rows = await tx.select().from(redirects).where(isNull(redirects.deletedAt));
    assertNoRedirectCycle(rows, id, values);
    const [after] = id ? await tx.update(redirects).set({ ...values, updatedAt: new Date() }).where(and(eq(redirects.id, id), isNull(redirects.deletedAt))).returning() : await tx.insert(redirects).values(values).returning();
    await tx.insert(auditLogs).values({ userId, action: id ? "redirect.update" : "redirect.create", entityType: "redirect", entityId: after.id, beforeData: before ?? null, afterData: values });
    return after.id;
  });
}
export function deleteRedirect(id: string, userId: string, database = getDb()) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`lock table ${redirects} in share row exclusive mode`);
    const [before] = await tx.select().from(redirects).where(and(eq(redirects.id, id), isNull(redirects.deletedAt))).for("update");
    if (!before) return undefined;
    const [deleted] = await tx.update(redirects).set({ deletedAt: new Date(), updatedAt: new Date(), isEnabled: false }).where(and(eq(redirects.id, id), isNull(redirects.deletedAt))).returning({ id: redirects.id });
    if (!deleted) return undefined;
    await tx.insert(auditLogs).values({ userId, action: "redirect.delete", entityType: "redirect", entityId: deleted.id, beforeData: before });
    return deleted.id;
  });
}

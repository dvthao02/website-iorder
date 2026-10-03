import { eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, siteProfile } from "@iorder/core/db/schema";
import type { ProfileInput } from "./profile.contract";

export async function findSiteProfile() {
  const [row] = await getDb().select().from(siteProfile).where(eq(siteProfile.profileKey, "default")).limit(1);
  return row;
}

export function saveSiteProfile(input: ProfileInput, userId: string) {
  return getDb().transaction(async tx => {
    const [saved] = await tx.insert(siteProfile).values({ ...input, profileKey: "default" })
      .onConflictDoUpdate({ target: siteProfile.profileKey, set: { ...input, updatedAt: new Date() } }).returning();
    await tx.insert(auditLogs).values({ userId, action: "profile.update", entityType: "site_profile", entityId: saved.id, afterData: input });
    return saved;
  });
}

import { eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, siteProfile } from "@iorder/core/db/schema";
import type { ProfileInput } from "./profile.contract";
import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";

export async function findSiteProfile() {
  const [row] = await getDb().select().from(siteProfile).where(eq(siteProfile.profileKey, "default")).limit(1);
  return row;
}

export function saveSiteProfile(input: ProfileInput, userId: string, expectedVersion?: number) {
  return getDb().transaction(async tx => {
    const [before] = await tx.select({ version: siteProfile.version }).from(siteProfile).where(eq(siteProfile.profileKey, "default")).for("update");
    // expectedVersion undefined: seed/hệ thống ghi, bỏ qua kiểm tra; CMS luôn gửi.
    if (expectedVersion !== undefined) assertContentVersion(before?.version ?? 0, expectedVersion);
    const version = (before?.version ?? 0) + 1;
    // Lần lưu đầu chưa có dòng để khóa: điều kiện version ở nhánh ON CONFLICT chặn ghi đè đồng thời.
    const [saved] = await tx.insert(siteProfile).values({ ...input, profileKey: "default", version })
      .onConflictDoUpdate({ target: siteProfile.profileKey, set: { ...input, version, updatedAt: new Date() }, setWhere: eq(siteProfile.version, version - 1) }).returning();
    if (!saved) throw new ContentVersionConflictError();
    await tx.insert(auditLogs).values({ userId, action: "profile.update", entityType: "site_profile", entityId: saved.id, afterData: input });
    return saved;
  });
}

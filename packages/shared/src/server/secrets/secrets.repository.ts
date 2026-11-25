import { eq } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, secureSettings, users } from "@iorder/shared/db/schema";

import { findActivePasswordHash } from "../auth/auth.repository";
import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";
import type { SecretsRepository } from "./secrets.service";
import { shownFullName } from "../users/hidden-users";

// Nhật ký hoạt động chỉ ghi tên khóa và đã đặt/chưa đặt, không bao giờ ghi giá trị hay gợi ý.
export const secretsRepository: SecretsRepository = {
  async list() {
    const rows = await getDb().select({ key: secureSettings.key, hint: secureSettings.hint, version: secureSettings.version, updatedAt: secureSettings.updatedAt, updatedByName: shownFullName<string | null>() })
      .from(secureSettings).leftJoin(users, eq(users.id, secureSettings.updatedBy));
    return rows;
  },

  async findPayload(key) {
    const [row] = await getDb().select({ payload: secureSettings.payload }).from(secureSettings).where(eq(secureSettings.key, key)).limit(1);
    return row?.payload;
  },

  async upsert({ key, payload, hint, userId, expectedVersion }) {
    await getDb().transaction(async (tx) => {
      const [before] = await tx.select({ version: secureSettings.version }).from(secureSettings).where(eq(secureSettings.key, key)).for("update");
      // expectedVersion undefined: lần đặt đầu tiên hoặc hệ thống ghi; CMS luôn gửi version đang thấy.
      if (expectedVersion !== undefined) assertContentVersion(before?.version ?? 0, expectedVersion);
      const version = (before?.version ?? 0) + 1;
      // Lần lưu đầu chưa có dòng để khóa: điều kiện version ở nhánh ON CONFLICT chặn ghi đè đồng thời.
      const [after] = await tx.insert(secureSettings).values({ key, payload, hint, updatedBy: userId, version })
        .onConflictDoUpdate({ target: secureSettings.key, set: { payload, hint, updatedBy: userId, version, updatedAt: new Date() }, setWhere: eq(secureSettings.version, version - 1) })
        .returning({ id: secureSettings.id });
      if (!after) throw new ContentVersionConflictError();
      await tx.insert(auditLogs).values({ userId, action: "secret.set", entityType: "secure_setting", entityId: after.id, beforeData: { key, configured: Boolean(before) }, afterData: { key, configured: true } });
    });
  },

  async remove({ key, userId }) {
    return getDb().transaction(async (tx) => {
      const [removed] = await tx.delete(secureSettings).where(eq(secureSettings.key, key)).returning({ id: secureSettings.id });
      if (!removed) return false;
      await tx.insert(auditLogs).values({ userId, action: "secret.clear", entityType: "secure_setting", entityId: removed.id, beforeData: { key, configured: true }, afterData: { key, configured: false } });
      return true;
    });
  },

  passwordHash: (userId) => findActivePasswordHash(userId),

  async recordFailedReauth({ userId, key }) {
    await getDb().insert(auditLogs).values({ userId, action: "secret.reauth_failed", entityType: "secure_setting", afterData: { key } });
  },

  // Chỉ ghi "ai đã tạo khóa chủ", không có gì về nội dung khóa.
  async recordMasterKeyCreated({ userId }) {
    await getDb().insert(auditLogs).values({ userId, action: "secret.master_key_created", entityType: "secure_setting", afterData: { key: "master_key" } });
  },
};

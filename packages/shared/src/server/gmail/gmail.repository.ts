import { eq } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, siteSettings } from "@iorder/shared/db/schema";

import { parseStoredSetting } from "../settings/stored-setting";
import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";
import { defaultGmailSettings, gmailConnectionSchema, gmailSettingsSchema, type GmailConnection, type GmailSettings } from "./gmail.contract";

// Hai khóa site_settings, tách riêng vì khác chủ ghi: `gmail_notifications` do Super Admin sửa (có version, 409 khi hai người sửa cùng lúc),
// `gmail_connection` do máy chủ ghi (kết nối, lần gửi gần nhất, lỗi) và đổi mỗi lần gửi thư nên không có version để không gây xung đột giả.
const settingsKey = "gmail_notifications";
const connectionKey = "gmail_connection";

export type ConnectionPatch = Partial<Pick<GmailConnection, "status" | "lastSentAt" | "lastError" | "lastErrorAt">>;

export type GmailRepository = {
  readSettings(): Promise<{ settings: GmailSettings; version: number }>;
  writeSettings(values: GmailSettings, userId: string, expectedVersion: number): Promise<number>;
  readConnection(): Promise<GmailConnection | null>;
  saveConnection(connection: GmailConnection, userId: string): Promise<void>;
  patchConnection(patch: ConnectionPatch): Promise<void>;
  removeConnection(userId: string): Promise<void>;
  recordTestSend(userId: string, recipients: number): Promise<void>;
};

export const gmailRepository: GmailRepository = {
  async readSettings() {
    const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, settingsKey)).limit(1);
    return { settings: row ? parseStoredSetting(gmailSettingsSchema, row.value, settingsKey, defaultGmailSettings) ?? defaultGmailSettings : defaultGmailSettings, version: row?.version ?? 0 };
  },

  async writeSettings(values, userId, expectedVersion) {
    return getDb().transaction(async (tx) => {
      const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, settingsKey)).for("update");
      assertContentVersion(before?.version ?? 0, expectedVersion);
      const version = (before?.version ?? 0) + 1;
      const description = "Gmail báo liên hệ mới: bật/tắt và danh sách CC";
      // Lần lưu đầu chưa có dòng để khóa: điều kiện version ở nhánh ON CONFLICT chặn ghi đè đồng thời.
      const [after] = await tx.insert(siteSettings).values({ key: settingsKey, value: values, description, updatedBy: userId, version })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: values, description, updatedBy: userId, version, updatedAt: new Date() }, setWhere: eq(siteSettings.version, version - 1) }).returning();
      if (!after) throw new ContentVersionConflictError();
      await tx.insert(auditLogs).values({ userId, action: "gmail.settings_update", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: values });
      return after.version;
    });
  },

  async readConnection() {
    const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, connectionKey)).limit(1);
    return row ? parseStoredSetting(gmailConnectionSchema, row.value, connectionKey) : null;
  },

  async saveConnection(connection, userId) {
    await getDb().transaction(async (tx) => {
      const description = "Kết nối Gmail đang dùng để gửi thư báo liên hệ mới (không chứa token)";
      const [row] = await tx.insert(siteSettings).values({ key: connectionKey, value: connection, description, updatedBy: userId })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: connection, updatedBy: userId, updatedAt: new Date() } }).returning({ id: siteSettings.id });
      await tx.insert(auditLogs).values({ userId, action: "gmail.connect", entityType: "site_setting", entityId: row?.id ?? null, afterData: { email: connection.email } });
    });
  },

  async patchConnection(patch) {
    await getDb().transaction(async (tx) => {
      const [row] = await tx.select().from(siteSettings).where(eq(siteSettings.key, connectionKey)).for("update");
      const current = row ? parseStoredSetting(gmailConnectionSchema, row.value, connectionKey) : null;
      if (!row || !current) return;
      await tx.update(siteSettings).set({ value: { ...current, ...patch }, updatedAt: new Date() }).where(eq(siteSettings.key, connectionKey));
    });
  },

  async removeConnection(userId) {
    await getDb().transaction(async (tx) => {
      const [row] = await tx.delete(siteSettings).where(eq(siteSettings.key, connectionKey)).returning();
      const email = row ? parseStoredSetting(gmailConnectionSchema, row.value, connectionKey)?.email : undefined;
      await tx.insert(auditLogs).values({ userId, action: "gmail.disconnect", entityType: "site_setting", entityId: row?.id ?? null, beforeData: email ? { email } : null });
    });
  },

  async recordTestSend(userId, recipients) {
    await getDb().insert(auditLogs).values({ userId, action: "gmail.test_send", entityType: "site_setting", afterData: { recipients } });
  },
};

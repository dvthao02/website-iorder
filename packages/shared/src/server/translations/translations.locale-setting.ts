import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, siteSettings } from "@iorder/shared/db/schema";
import { parseStoredSetting } from "../settings/stored-setting";
import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";
import { defaultEnabledLocales, sortLocaleCodes, translationLocaleCodes, type TranslationLocale } from "./locales";

// Các ngôn ngữ người vận hành đã thêm ở CMS › Đa ngôn ngữ (danh mục ngôn ngữ có thể thêm nằm ở locales.ts). Không có dòng nào thì dùng `defaultEnabledLocales`.
const settingKey = "translation_locales";

export const translationLocaleSettingSchema = z.object({
  locales: z.array(z.enum(translationLocaleCodes as [TranslationLocale, ...TranslationLocale[]])).max(translationLocaleCodes.length),
});

/** Danh sách ngôn ngữ đã thêm (theo thứ tự danh mục, không trùng) cùng version của cấu hình để CMS gửi lại khi lưu. */
export async function getTranslationLocaleSetting(): Promise<{ codes: TranslationLocale[]; version: number }> {
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, settingKey)).limit(1);
  if (!row) return { codes: [...defaultEnabledLocales], version: 0 };
  const parsed = parseStoredSetting(translationLocaleSettingSchema, row.value, settingKey, { locales: [...defaultEnabledLocales] });
  return { codes: sortLocaleCodes(parsed?.locales ?? defaultEnabledLocales), version: row.version };
}

export async function saveTranslationLocaleSetting(codes: readonly TranslationLocale[], userId: string, expectedVersion: number) {
  const locales = sortLocaleCodes(codes);
  const value = { locales };
  const description = "Ngôn ngữ đã thêm cho bản dịch website";
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, settingKey)).for("update");
    assertContentVersion(before?.version ?? 0, expectedVersion);
    const version = (before?.version ?? 0) + 1;
    // Lần lưu đầu chưa có dòng để khóa: điều kiện version ở nhánh ON CONFLICT chặn ghi đè đồng thời.
    const [after] = await tx.insert(siteSettings).values({ key: settingKey, value, description, updatedBy: userId, version })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value, description, updatedBy: userId, version, updatedAt: new Date() }, setWhere: eq(siteSettings.version, version - 1) }).returning();
    if (!after) throw new ContentVersionConflictError();
    await tx.insert(auditLogs).values({ userId, action: "translations.locales", entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? { locales: [...defaultEnabledLocales] }, afterData: value });
    return { codes: locales, version: after.version };
  });
}

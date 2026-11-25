import { eq, sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, contentTranslations } from "@iorder/shared/db/schema";

export type StoredTranslation = { sourceKey: string; sourceText: string; value: string };

/** Mọi bản dịch của một ngôn ngữ (vài nghìn dòng chữ ngắn). */
export async function listTranslations(locale: string): Promise<StoredTranslation[]> {
  return getDb().select({ sourceKey: contentTranslations.sourceKey, sourceText: contentTranslations.sourceText, value: contentTranslations.value })
    .from(contentTranslations).where(eq(contentTranslations.locale, locale));
}

/** Ngôn ngữ nào đã có ít nhất một bản dịch (website chỉ hiện nút đổi ngôn ngữ cho những ngôn ngữ này). */
export async function listLocalesWithTranslations(): Promise<string[]> {
  const rows = await getDb().select({ locale: contentTranslations.locale }).from(contentTranslations).groupBy(contentTranslations.locale);
  return rows.map((row) => row.locale);
}

// Ghi theo lô; một transaction cùng dòng nhật ký để số liệu trong nhật ký đúng với dữ liệu đã lưu. Chỉ ghi các dòng kế hoạch nhập đã quyết định ghi
// (thêm mới, hoặc sửa khi người dùng bật ghi đè, hoặc thay bản dịch của câu gốc đã đổi) nên luôn ghi đè khi trùng khóa.
const batchSize = 500;

export async function saveTranslations(options: {
  locale: string;
  rows: StoredTranslation[];
  userId: string;
  summary: { created: number; updated: number };
}) {
  const { locale, rows, userId, summary } = options;
  await getDb().transaction(async (tx) => {
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize).map((row) => ({ locale, sourceKey: row.sourceKey, sourceText: row.sourceText, value: row.value }));
      await tx.insert(contentTranslations).values(batch).onConflictDoUpdate({
        target: [contentTranslations.locale, contentTranslations.sourceKey],
        set: { sourceText: sql`excluded.source_text`, value: sql`excluded.value`, updatedAt: sql`now()` },
      });
    }
    await tx.insert(auditLogs).values({ userId, action: "translations.import", entityType: "translation", afterData: { locale, ...summary } });
  });
}

/** Xóa toàn bộ bản dịch của một ngôn ngữ (chỉ dùng trong kiểm thử và dọn dữ liệu thử). */
export async function deleteLocaleTranslations(locale: string) {
  await getDb().delete(contentTranslations).where(eq(contentTranslations.locale, locale));
}

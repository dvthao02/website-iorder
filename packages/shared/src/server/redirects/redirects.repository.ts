import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@iorder/shared/db/client";
import { auditLogs, redirects } from "@iorder/shared/db/schema";
import type { RedirectInput } from "./redirects.contract";
import { assertNoRedirectCycle } from "./redirect-cycle";
import { assertContentVersion } from "../shared/content-version";

export function listRedirects() { return getDb().select().from(redirects).where(isNull(redirects.deletedAt)).orderBy(asc(redirects.sourcePath)); }
export async function findEnabledRedirect(sourcePath: string) {
  const [row] = await getDb().select().from(redirects).where(and(eq(redirects.sourcePath, sourcePath), eq(redirects.isEnabled, true), isNull(redirects.deletedAt))).limit(1);
  return row ?? null;
}
export function saveRedirect(id: string | null, values: RedirectInput, userId: string, database = getDb(), options: { expectedVersion?: number } = {}) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`lock table ${redirects} in share row exclusive mode`);
    const [before] = id ? await tx.select().from(redirects).where(and(eq(redirects.id, id), isNull(redirects.deletedAt))).for("update") : [];
    if (id && !before) return undefined;
    if (before && options.expectedVersion !== undefined) assertContentVersion(before.version, options.expectedVersion);
    const rows = await tx.select().from(redirects).where(isNull(redirects.deletedAt));
    assertNoRedirectCycle(rows, id, values);
    const [after] = id ? await tx.update(redirects).set({ ...values, version: (before?.version ?? 0) + 1, updatedAt: new Date() }).where(and(eq(redirects.id, id), isNull(redirects.deletedAt))).returning() : await tx.insert(redirects).values(values).returning();
    await tx.insert(auditLogs).values({ userId, action: id ? "redirect.update" : "redirect.create", entityType: "redirect", entityId: after.id, beforeData: before ?? null, afterData: values });
    return after.id;
  });
}
type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// Nội dung đã xuất bản đổi đường dẫn: chạy trong transaction lưu nội dung để URL cũ không bao giờ 404.
// - Chuyển hướng đang chiếm URL mới bị gỡ (ví dụ đổi slug quay lại tên cũ), nếu không trang mới sẽ bị đẩy đi nơi khác.
// - Chuyển hướng đang trỏ tới URL cũ được trỏ thẳng sang URL mới, không tạo chuỗi nhiều bước.
// - URL cũ chuyển 301 sang URL mới (cập nhật dòng có sẵn nếu đã có).
export async function redirectMovedContent(tx: DbTransaction, move: { from: string; to: string }, userId: string) {
  await releaseRedirectSource(tx, move.to, userId, "Nội dung đã chuyển về đường dẫn này.");
  // Chỉ đọc các dòng liên quan tới URL cũ, không quét cả bảng trong transaction lưu nội dung.
  const rows = await tx.select().from(redirects).where(and(isNull(redirects.deletedAt), or(eq(redirects.sourcePath, move.from), eq(redirects.destinationPath, move.from))));
  const now = new Date();
  for (const row of rows) {
    if (row.destinationPath === move.from && row.sourcePath !== move.from) {
      const afterData = { sourcePath: row.sourcePath, destinationPath: move.to, statusCode: row.statusCode, isEnabled: row.isEnabled };
      await tx.update(redirects).set({ destinationPath: move.to, version: row.version + 1, updatedAt: now }).where(eq(redirects.id, row.id));
      await tx.insert(auditLogs).values({ userId, action: "redirect.update", entityType: "redirect", entityId: row.id, beforeData: row, afterData });
    }
  }
  const values = { sourcePath: move.from, destinationPath: move.to, statusCode: 301, isEnabled: true };
  const existing = rows.find((row) => row.sourcePath === move.from);
  const [saved] = existing
    ? await tx.update(redirects).set({ destinationPath: move.to, isEnabled: true, version: existing.version + 1, updatedAt: now }).where(eq(redirects.id, existing.id)).returning({ id: redirects.id })
    : await tx.insert(redirects).values(values).returning({ id: redirects.id });
  await tx.insert(auditLogs).values({ userId, action: existing ? "redirect.update" : "redirect.create", entityType: "redirect", entityId: saved.id, beforeData: existing ?? null, afterData: { ...values, reason: "Tự tạo khi đổi đường dẫn nội dung đã xuất bản." } });
}

// Nội dung xuất bản (hoặc hẹn giờ) tại một đường dẫn: gỡ chuyển hướng đang lấy đường dẫn đó làm nguồn,
// vì website xử lý chuyển hướng trước khi hiện trang nên chuyển hướng sẽ che mất nội dung.
export async function releaseRedirectSource(tx: DbTransaction, path: string, userId: string, reason = "Nội dung đã xuất bản tại đường dẫn này.") {
  await tx.execute(sql`lock table ${redirects} in share row exclusive mode`);
  const rows = await tx.select().from(redirects).where(and(eq(redirects.sourcePath, path), isNull(redirects.deletedAt)));
  const now = new Date();
  for (const row of rows) {
    await tx.update(redirects).set({ deletedAt: now, updatedAt: now, isEnabled: false }).where(eq(redirects.id, row.id));
    await tx.insert(auditLogs).values({ userId, action: "redirect.delete", entityType: "redirect", entityId: row.id, beforeData: row, afterData: { reason } });
  }
}

export type ContentPathChange = { moved: { from: string; to: string } | null; claimed: string | null };

// Một chỗ cho mọi lần lưu nội dung: đổi đường dẫn thì chuyển hướng URL cũ, còn không thì chỉ giải phóng URL đang dùng.
export async function applyContentPathChange(tx: DbTransaction, change: ContentPathChange | null | undefined, userId: string) {
  if (change?.moved) await redirectMovedContent(tx, change.moved, userId);
  else if (change?.claimed) await releaseRedirectSource(tx, change.claimed, userId);
}

export function deleteRedirect(id: string, userId: string, database = getDb(), options: { expectedVersion?: number } = {}) {
  return database.transaction(async (tx) => {
    await tx.execute(sql`lock table ${redirects} in share row exclusive mode`);
    const [before] = await tx.select().from(redirects).where(and(eq(redirects.id, id), isNull(redirects.deletedAt))).for("update");
    if (!before) return undefined;
    if (options.expectedVersion !== undefined) assertContentVersion(before.version, options.expectedVersion);
    const [deleted] = await tx.update(redirects).set({ deletedAt: new Date(), updatedAt: new Date(), isEnabled: false }).where(and(eq(redirects.id, id), isNull(redirects.deletedAt))).returning({ id: redirects.id });
    if (!deleted) return undefined;
    await tx.insert(auditLogs).values({ userId, action: "redirect.delete", entityType: "redirect", entityId: deleted.id, beforeData: before });
    return deleted.id;
  });
}

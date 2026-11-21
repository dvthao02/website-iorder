import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, mediaAssets, postAuthors, posts } from "@iorder/shared/db/schema";
import { assertContentVersion } from "../shared/content-version";
import { liveContentCondition } from "../shared/live-content";
import type { AuthorInput } from "./authors.contract";

/** Sửa tác giả đang bật trang công khai mà không có quyền xuất bản. */
export class AuthorLiveEditForbiddenError extends Error {
  constructor() {
    super("Bạn không có quyền sửa tác giả đang hiển thị trên website.");
    this.name = "AuthorLiveEditForbiddenError";
  }
}

// Số bài còn dùng tác giả (chưa xóa): để chặn xóa và hiện trong danh sách.
const usedByPosts = sql<number>`(select count(*)::int from ${posts} where ${posts.authorProfileId} = ${postAuthors.id} and ${posts.deletedAt} is null)`;

export function listAdminAuthors() {
  return getDb()
    .select({ author: postAuthors, avatarKey: mediaAssets.storageKey, postCount: usedByPosts })
    .from(postAuthors)
    .leftJoin(mediaAssets, and(eq(postAuthors.avatarMediaId, mediaAssets.id), isNull(mediaAssets.deletedAt)))
    .orderBy(asc(postAuthors.name));
}

export async function findAuthorById(id: string) {
  const [row] = await getDb()
    .select({ author: postAuthors, avatarKey: mediaAssets.storageKey, avatarAlt: mediaAssets.altText })
    .from(postAuthors)
    .leftJoin(mediaAssets, and(eq(postAuthors.avatarMediaId, mediaAssets.id), isNull(mediaAssets.deletedAt)))
    .where(eq(postAuthors.id, id))
    .limit(1);
  return row;
}

export async function authorExists(id: string) {
  const [row] = await getDb().select({ id: postAuthors.id }).from(postAuthors).where(eq(postAuthors.id, id)).limit(1);
  return Boolean(row);
}

export function saveAuthor(id: string | null, values: AuthorInput, userId: string, options: { expectedVersion?: number; onlyIfHidden?: boolean } = {}) {
  return getDb().transaction(async (tx) => {
    const [current] = id ? await tx.select().from(postAuthors).where(eq(postAuthors.id, id)).for("update") : [];
    if (id && !current) return undefined;
    if (current && options.expectedVersion !== undefined) assertContentVersion(current.version, options.expectedVersion);
    // Kiểm trong cùng giao dịch với việc ghi, để người bật trang song song không lọt qua.
    if (current && options.onlyIfHidden && current.isEnabled) throw new AuthorLiveEditForbiddenError();
    const [row] = current
      ? await tx.update(postAuthors).set({ ...values, version: current.version + 1, updatedAt: new Date() }).where(eq(postAuthors.id, current.id)).returning()
      : await tx.insert(postAuthors).values(values).returning();
    if (!row) return undefined;
    await tx.insert(auditLogs).values({ userId, action: current ? "author.update" : "author.create", entityType: "author", entityId: row.id, beforeData: current ?? null, afterData: values });
    return row.id;
  });
}

export type AuthorDeleteResult = { id: string } | { blockedBy: "posts"; postCount: number } | undefined;

export function deleteAuthor(id: string, userId: string): Promise<AuthorDeleteResult> {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(postAuthors).where(eq(postAuthors.id, id)).for("update");
    if (!before) return undefined;
    const [usage] = await tx.select({ postCount: usedByPosts }).from(postAuthors).where(eq(postAuthors.id, id));
    if (usage && usage.postCount > 0) return { blockedBy: "posts", postCount: usage.postCount };
    const [deleted] = await tx.delete(postAuthors).where(eq(postAuthors.id, id)).returning({ id: postAuthors.id });
    if (!deleted) return undefined;
    await tx.insert(auditLogs).values({ userId, action: "author.delete", entityType: "author", entityId: deleted.id, beforeData: before });
    return deleted;
  });
}

// ----- Công khai -----

/** Tác giả đang bật trang riêng, theo slug (không có hoặc chưa bật thì undefined). */
export async function findEnabledAuthorBySlug(slug: string) {
  const [row] = await getDb()
    .select({ author: postAuthors, avatarKey: mediaAssets.storageKey, avatarAlt: mediaAssets.altText })
    .from(postAuthors)
    .leftJoin(mediaAssets, and(eq(postAuthors.avatarMediaId, mediaAssets.id), isNull(mediaAssets.deletedAt)))
    .where(and(eq(postAuthors.slug, slug), eq(postAuthors.isEnabled, true)))
    .limit(1);
  return row;
}

/** Tác giả đang bật trang riêng và có ít nhất một bài đang hiển thị (cho sitemap), mới cập nhật gần nhất lên trước. */
export async function listPublishedAuthorSummaries(now = new Date()) {
  const liveCount = sql<number>`(select count(*)::int from ${posts} where ${posts.authorProfileId} = ${postAuthors.id} and ${posts.deletedAt} is null and ${liveContentCondition(posts, now)})`;
  const rows = await getDb()
    .select({ slug: postAuthors.slug, name: postAuthors.name, updatedAt: postAuthors.updatedAt, postCount: liveCount })
    .from(postAuthors)
    .where(eq(postAuthors.isEnabled, true))
    .orderBy(desc(postAuthors.updatedAt));
  return rows.filter((row) => row.postCount > 0);
}

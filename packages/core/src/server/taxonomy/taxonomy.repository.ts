import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, categories, postCategories, postTags, tags } from "@iorder/core/db/schema";
import type { CategoryInput, TagInput } from "./taxonomy.contract";
import { assertCategoryParent } from "./category-tree-policy";

export function listCategories() { return getDb().select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)); }
export function listTags() { return getDb().select().from(tags).orderBy(asc(tags.name)); }
export async function findCategoryBySlug(slug: string) { const [row] = await getDb().select().from(categories).where(eq(categories.slug, slug)).limit(1); return row; }
export async function findTagBySlug(slug: string) { const [row] = await getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1); return row; }
export function saveCategory(id: string | null, values: CategoryInput, userId: string, database = getDb()) {
  return database.transaction(async tx => {
    // Serialize tree changes before reading: row locks alone cannot prevent A→B/B→A.
    // Ordinary SELECT remains available while this short transaction holds the lock.
    await tx.execute(sql`lock table ${categories} in share row exclusive mode`);
    const nodes = await tx.select({ id: categories.id, parentId: categories.parentId }).from(categories);
    if (id && !nodes.some(node => node.id === id)) return undefined;
    assertCategoryParent(nodes, id, values.parentId);
    const [row] = id
      ? await tx.update(categories).set({ ...values, updatedAt: new Date() }).where(eq(categories.id, id)).returning()
      : await tx.insert(categories).values(values).returning();
    if (!row) return undefined;
    await tx.insert(auditLogs).values({ userId, action: id ? "category.update" : "category.create", entityType: "category", entityId: row.id, afterData: values });
    return row.id;
  });
}
export function saveTag(id: string | null, values: TagInput, userId: string) { return getDb().transaction(async tx => { const [row] = id ? await tx.update(tags).set({ ...values, updatedAt: new Date() }).where(eq(tags.id, id)).returning() : await tx.insert(tags).values(values).returning(); if (!row) return undefined; await tx.insert(auditLogs).values({ userId, action: id ? "tag.update" : "tag.create", entityType: "tag", entityId: row.id, afterData: values }); return row.id; }); }

export type TaxonomyDeleteResult = { id: string } | { blockedBy: "children" | "posts" } | undefined;

export function deleteCategory(id: string, userId: string): Promise<TaxonomyDeleteResult> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`lock table ${categories} in share row exclusive mode`);
    const [before] = await tx.select().from(categories).where(eq(categories.id, id)).for("update");
    if (!before) return undefined;

    const [child] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.parentId, id)).limit(1).for("update");
    if (child) return { blockedBy: "children" };

    const [post] = await tx.select({ id: postCategories.postId }).from(postCategories).where(eq(postCategories.categoryId, id)).limit(1);
    if (post) return { blockedBy: "posts" };

    const [deleted] = await tx.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
    if (!deleted) return undefined;
    await tx.insert(auditLogs).values({ userId, action: "category.delete", entityType: "category", entityId: deleted.id, beforeData: before });
    return deleted;
  });
}

export function deleteTag(id: string, userId: string): Promise<TaxonomyDeleteResult> {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(tags).where(eq(tags.id, id)).for("update");
    if (!before) return undefined;

    const [post] = await tx.select({ id: postTags.postId }).from(postTags).where(eq(postTags.tagId, id)).limit(1);
    if (post) return { blockedBy: "posts" };

    const [deleted] = await tx.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
    if (!deleted) return undefined;
    await tx.insert(auditLogs).values({ userId, action: "tag.delete", entityType: "tag", entityId: deleted.id, beforeData: before });
    return deleted;
  });
}

import { asc, eq } from "drizzle-orm";
import { getDb } from "@iorder/core/db/client";
import { auditLogs, categories, tags } from "@iorder/core/db/schema";
import type { CategoryInput, TagInput } from "./taxonomy.contract";

export function listCategories() { return getDb().select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)); }
export function listTags() { return getDb().select().from(tags).orderBy(asc(tags.name)); }
export async function findCategoryBySlug(slug: string) { const [row] = await getDb().select().from(categories).where(eq(categories.slug, slug)).limit(1); return row; }
export async function findTagBySlug(slug: string) { const [row] = await getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1); return row; }
export function saveCategory(id: string | null, values: CategoryInput, userId: string) { return getDb().transaction(async tx => { const [row] = id ? await tx.update(categories).set({ ...values, updatedAt: new Date() }).where(eq(categories.id, id)).returning() : await tx.insert(categories).values(values).returning(); if (!row) return undefined; await tx.insert(auditLogs).values({ userId, action: id ? "category.update" : "category.create", entityType: "category", entityId: row.id, afterData: values }); return row.id; }); }
export function saveTag(id: string | null, values: TagInput, userId: string) { return getDb().transaction(async tx => { const [row] = id ? await tx.update(tags).set({ ...values, updatedAt: new Date() }).where(eq(tags.id, id)).returning() : await tx.insert(tags).values(values).returning(); if (!row) return undefined; await tx.insert(auditLogs).values({ userId, action: id ? "tag.update" : "tag.create", entityType: "tag", entityId: row.id, afterData: values }); return row.id; }); }

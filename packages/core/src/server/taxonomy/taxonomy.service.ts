import { z } from "zod";
import { categoryInputSchema, tagInputSchema } from "./taxonomy.contract";
import { findCategoryBySlug, findTagBySlug, listCategories, listTags, saveCategory, saveTag } from "./taxonomy.repository";

function isDescendant(categories: Awaited<ReturnType<typeof listCategories>>, ancestorId: string, candidateParentId: string) {
  const byId = new Map(categories.map(category => [category.id, category]));
  const visited = new Set<string>();
  let currentId: string | null = candidateParentId;
  while (currentId) {
    if (currentId === ancestorId || visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = byId.get(currentId)?.parentId ?? null;
  }
  return false;
}

export async function getTaxonomy() { const [categories, tags] = await Promise.all([listCategories(), listTags()]); return { categories, tags }; }
export async function writeTaxonomy(kind: "categories" | "tags", id: string | null, input: unknown, userId: string) {
  if (kind === "categories") { const values = categoryInputSchema.parse(input); const categories = await listCategories(); if (values.parentId && (values.parentId === id || !categories.some(category => category.id === values.parentId))) throw new z.ZodError([{ code: "custom", path: ["parentId"], message: "Chuyên mục cha không hợp lệ." }]); if (id && values.parentId && isDescendant(categories, id, values.parentId)) throw new z.ZodError([{ code: "custom", path: ["parentId"], message: "Không thể chọn chuyên mục con làm chuyên mục cha." }]); return saveCategory(id, values, userId); }
  return saveTag(id, tagInputSchema.parse(input), userId);
}
export async function ensureTaxonomyIds(categoryIds: string[], tagIds: string[]) { const { categories, tags } = await getTaxonomy(); if (categoryIds.some(id => !categories.some(category => category.id === id)) || tagIds.some(id => !tags.some(tag => tag.id === id))) throw new z.ZodError([{ code: "custom", path: ["taxonomy"], message: "Chuyên mục hoặc thẻ không tồn tại." }]); }
export { findCategoryBySlug, findTagBySlug };

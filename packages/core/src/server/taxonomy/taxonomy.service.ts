import { z } from "zod";

import { categoryInputSchema, tagInputSchema } from "./taxonomy.contract";
import { assertCategoryParent } from "./category-tree-policy";
import { hasDatabaseErrorCode } from "../shared/database-error";
import { deleteCategory, deleteTag, findCategoryBySlug, findTagBySlug, listCategories, listTags, saveCategory, saveTag } from "./taxonomy.repository";

export class TaxonomyInUseError extends Error {
  constructor(blockedBy: "children" | "posts") {
    super(blockedBy === "children"
      ? "Không thể xóa chuyên mục đang có chuyên mục con. Hãy chuyển hoặc xóa các mục con trước."
      : "Không thể xóa phân loại đang được gắn với bài viết. Hãy gỡ liên kết trước.");
  }
}

type TaxonomyRepository = {
  deleteCategory: typeof deleteCategory;
  deleteTag: typeof deleteTag;
  findCategoryBySlug: typeof findCategoryBySlug;
  findTagBySlug: typeof findTagBySlug;
  listCategories: typeof listCategories;
  listTags: typeof listTags;
  saveCategory: typeof saveCategory;
  saveTag: typeof saveTag;
};

export function createTaxonomyService(repository: TaxonomyRepository) {
  async function getTaxonomy() {
    const [categories, tags] = await Promise.all([repository.listCategories(), repository.listTags()]);
    return { categories, tags };
  }

  async function writeTaxonomy(kind: "categories" | "tags", id: string | null, input: unknown, userId: string) {
    if (kind === "categories") {
      const values = categoryInputSchema.parse(input);
      const categories = await repository.listCategories();
      assertCategoryParent(categories, id, values.parentId);
      return repository.saveCategory(id, values, userId);
    }
    return repository.saveTag(id, tagInputSchema.parse(input), userId);
  }

  async function ensureTaxonomyIds(categoryIds: string[], tagIds: string[]) {
    const { categories, tags } = await getTaxonomy();
    if (categoryIds.some(id => !categories.some(category => category.id === id)) || tagIds.some(id => !tags.some(tag => tag.id === id))) throw new z.ZodError([{ code: "custom", path: ["taxonomy"], message: "Chuyên mục hoặc thẻ không tồn tại." }]);
  }

  async function deleteAdminTaxonomy(kind: "categories" | "tags", id: string, userId: string) {
    if (!z.string().uuid().safeParse(id).success) return undefined;
    try {
      const result = kind === "categories" ? await repository.deleteCategory(id, userId) : await repository.deleteTag(id, userId);
      if (result && "blockedBy" in result) throw new TaxonomyInUseError(result.blockedBy);
      return result?.id;
    } catch (error) {
      if (hasDatabaseErrorCode(error, "23503")) throw new TaxonomyInUseError("posts");
      throw error;
    }
  }

  return { deleteAdminTaxonomy, ensureTaxonomyIds, getTaxonomy, writeTaxonomy };
}

const taxonomyService = createTaxonomyService({ deleteCategory, deleteTag, findCategoryBySlug, findTagBySlug, listCategories, listTags, saveCategory, saveTag });

export const deleteAdminTaxonomy = taxonomyService.deleteAdminTaxonomy;
export const ensureTaxonomyIds = taxonomyService.ensureTaxonomyIds;
export const getTaxonomy = taxonomyService.getTaxonomy;
export const writeTaxonomy = taxonomyService.writeTaxonomy;
export { findCategoryBySlug, findTagBySlug };

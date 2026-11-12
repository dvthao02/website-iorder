import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { hasDatabaseErrorCode } from "../shared/database-error";

import { createTaxonomyService, TaxonomyInUseError } from "./taxonomy.service";

const taxonomyId = "11111111-1111-4111-8111-111111111111";
const editorId = "22222222-2222-4222-8222-222222222222";

function createRepository(deleteCategoryResult: { id: string } | { blockedBy: "children" | "posts" } | undefined = { id: taxonomyId }) {
  let categoryDeletes = 0;
  const repository = {
    async deleteCategory() { categoryDeletes += 1; return deleteCategoryResult; },
    async deleteTag() { return deleteCategoryResult; },
    async findCategoryBySlug() { return undefined; },
    async findTagBySlug() { return undefined; },
    async listCategories() { return []; },
    async listTags() { return []; },
    async saveCategory() { return taxonomyId; },
    async saveTag() { return taxonomyId; },
  } as unknown as Parameters<typeof createTaxonomyService>[0];
  return { categoryDeletes: () => categoryDeletes, repository };
}

test("không xóa chuyên mục có chuyên mục con", async () => {
  const fake = createRepository({ blockedBy: "children" });
  const service = createTaxonomyService(fake.repository);

  await assert.rejects(service.deleteAdminTaxonomy("categories", taxonomyId, editorId), TaxonomyInUseError);
  await assert.rejects(service.deleteAdminTaxonomy("categories", taxonomyId, editorId), /chuyên mục con/);
});

test("không xóa thẻ hoặc chuyên mục đang gắn bài viết", async () => {
  const fake = createRepository({ blockedBy: "posts" });
  const service = createTaxonomyService(fake.repository);

  await assert.rejects(service.deleteAdminTaxonomy("tags", taxonomyId, editorId), /gắn với bài viết/);
});

test("chuyển lỗi khóa ngoại đồng thời thành thông báo nghiệp vụ", async () => {
  const fake = createRepository();
  fake.repository.deleteCategory = async () => { throw { code: "23503" }; };
  const service = createTaxonomyService(fake.repository);

  await assert.rejects(service.deleteAdminTaxonomy("categories", taxonomyId, editorId), TaxonomyInUseError);
});

test("không gọi repository khi mã phân loại không hợp lệ", async () => {
  const fake = createRepository();
  const service = createTaxonomyService(fake.repository);

  assert.equal(await service.deleteAdminTaxonomy("categories", "not-a-uuid", editorId), undefined);
  assert.equal(fake.categoryDeletes(), 0);
});

test("lỗi khóa ngoại được Drizzle bọc vẫn chuyển thành lỗi nghiệp vụ", async () => {
  const fake = createRepository();
  fake.repository.deleteTag = async () => {
    throw new DrizzleQueryError("delete fixture", [], Object.assign(new Error("fixture"), { code: "23503" }));
  };
  await assert.rejects(createTaxonomyService(fake.repository).deleteAdminTaxonomy("tags", taxonomyId, editorId), TaxonomyInUseError);
});

test("lỗi DB không liên quan được giữ nguyên, không chuyển nhầm thành đang sử dụng", async () => {
  const fake = createRepository();
  const failure = new DrizzleQueryError("delete fixture", [], Object.assign(new Error("fixture"), { code: "08006" }));
  fake.repository.deleteCategory = async () => { throw failure; };
  await assert.rejects(createTaxonomyService(fake.repository).deleteAdminTaxonomy("categories", taxonomyId, editorId), error => error === failure);
});

test("nhận diện mã DB xử lý cause lồng nhau, vòng lặp và giá trị không phải lỗi", () => {
  assert.equal(hasDatabaseErrorCode({ cause: { cause: { code: "23503" } } }, "23503"), true);
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  for (const value of [cyclic, null, undefined, "23503", { message: "23503" }]) {
    assert.equal(hasDatabaseErrorCode(value, "23503"), false);
  }
});

const childId = "33333333-3333-4333-8333-333333333333";
const grandchildId = "44444444-4444-4444-8444-444444444444";
const categoryInput = { name: "Chuyên mục", slug: "chuyen-muc", description: null, sortOrder: 0, parentId: null };

function treeService(nodes: { id: string; parentId: string | null }[]) {
  const fake = createRepository();
  let saves = 0;
  fake.repository.listCategories = (async () => nodes) as unknown as typeof fake.repository.listCategories;
  fake.repository.saveCategory = async () => { saves += 1; return taxonomyId; };
  return { service: createTaxonomyService(fake.repository), saves: () => saves };
}

test("từ chối cha là chính mình hoặc không tồn tại trước khi ghi", async () => {
  const fixture = treeService([{ id: taxonomyId, parentId: null }]);
  for (const parentId of [taxonomyId, childId]) {
    await assert.rejects(fixture.service.writeTaxonomy("categories", taxonomyId, { ...categoryInput, parentId }, editorId), z.ZodError);
  }
  assert.equal(fixture.saves(), 0);
});

test("từ chối chọn con hoặc cháu làm cha", async () => {
  const fixture = treeService([
    { id: taxonomyId, parentId: null },
    { id: childId, parentId: taxonomyId },
    { id: grandchildId, parentId: childId },
  ]);
  for (const parentId of [childId, grandchildId]) {
    await assert.rejects(fixture.service.writeTaxonomy("categories", taxonomyId, { ...categoryInput, parentId }, editorId), /chuyên mục con/);
  }
  assert.equal(fixture.saves(), 0);
});

test("từ chối gắn vào nhánh đã có vòng lặp và không lặp vô hạn", async () => {
  const fixture = treeService([
    { id: taxonomyId, parentId: null },
    { id: childId, parentId: grandchildId },
    { id: grandchildId, parentId: childId },
  ]);
  await assert.rejects(fixture.service.writeTaxonomy("categories", taxonomyId, { ...categoryInput, parentId: childId }, editorId), z.ZodError);
  assert.equal(fixture.saves(), 0);
});

test("cho phép cha hợp lệ và tách chuyên mục về gốc", async () => {
  const fixture = treeService([{ id: taxonomyId, parentId: childId }, { id: childId, parentId: null }]);
  for (const parentId of [childId, null]) {
    assert.equal(await fixture.service.writeTaxonomy("categories", taxonomyId, { ...categoryInput, parentId }, editorId), taxonomyId);
  }
  assert.equal(fixture.saves(), 2);
});

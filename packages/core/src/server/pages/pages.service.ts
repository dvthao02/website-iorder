import { adminPageSchema, getFixedWebsitePage, pageBlockInputSchema, pageInputSchema, publicPageSchema, type AdminPage } from "./pages.contract";
import type { AdminListPage, AdminListQuery } from "@iorder/core/server/shared/admin-list.contract";
import { deleteArchivedPage, findAdminPageById, findPageBySlug, listAdminPages, listAdminPagesPage, listPublishedPageSummaries, listPublishedPages, writePage } from "./pages.repository";

export class FixedWebsitePageBindingError extends Error {}

function serialize(row: NonNullable<Awaited<ReturnType<typeof findPageBySlug>>>) {
  return { ...row, blocks: row.blocks.map(block => pageBlockInputSchema.parse(block)) };
}
export async function getPublishedPage(slug: string) {
  const page = await findPageBySlug(slug, true);
  if (!page) return undefined;
  const { title, template, seoTitle, seoDescription, canonicalUrl, blocks } = serialize(page);
  return publicPageSchema.parse({ title, slug: page.slug, template, seoTitle, seoDescription, canonicalUrl, blocks: blocks.filter(block => block.isEnabled) });
}
export async function getPublishedPages() {
  return adminPageSchema.array().parse((await listPublishedPages()).map(page => serialize(page as NonNullable<Awaited<ReturnType<typeof findPageBySlug>>>)));
}
export async function getAdminPages() {
  return adminPageSchema.array().parse((await listAdminPages()).map(page => serialize(page as NonNullable<Awaited<ReturnType<typeof findPageBySlug>>>)));
}
export async function getAdminPagesPage(query: AdminListQuery & { status?: "draft" | "review" | "scheduled" | "published" | "archived" }): Promise<AdminListPage<AdminPage>> {
  const result = await listAdminPagesPage(query);
  return { ...result, items: adminPageSchema.array().parse(result.items.map(page => serialize(page as NonNullable<Awaited<ReturnType<typeof findPageBySlug>>>))) };
}
export async function getAdminPageById(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return undefined;
  const page = await findAdminPageById(id);
  return page ? adminPageSchema.parse(serialize(page as NonNullable<Awaited<ReturnType<typeof findPageBySlug>>>)) : undefined;
}
export async function getAdminPageBySlug(slug: string) {
  const page = await findPageBySlug(slug, false);
  return page ? adminPageSchema.parse(serialize(page)) : undefined;
}
// Trang hệ thống có tồn tại (kể cả chưa xuất bản) không: phân biệt "đã ẩn" với "chưa tạo".
export async function systemPageExists(slug: string) {
  if (!getFixedWebsitePage(slug)) return false;
  return Boolean(await findPageBySlug(slug, false));
}
export async function getPublishedPageSummaries() { return listPublishedPageSummaries(); }
export async function saveAdminPage(
  id: string | null,
  input: unknown,
  editorId: string,
  options: { allowFixedPageCreation?: boolean; expectedVersion?: number } = {},
) {
  const values = pageInputSchema.parse(input);
  const existing = id ? await findAdminPageById(id) : undefined;
  const fixedPage = existing ? getFixedWebsitePage(existing.slug) : undefined;

  if (id && !existing) return undefined;
  if (!id && getFixedWebsitePage(values.slug) && !options.allowFixedPageCreation) {
    throw new FixedWebsitePageBindingError("Trang hệ thống đã tồn tại và không thể tạo lại từ CMS.");
  }
  // Trang thường không được chiếm slug của trang hệ thống (route sẽ đọc nhầm nội dung, backfill bỏ qua).
  if (existing && !fixedPage && getFixedWebsitePage(values.slug)) {
    throw new FixedWebsitePageBindingError("Slug này dành cho trang hệ thống. Vui lòng chọn slug khác.");
  }
  if (fixedPage && (values.slug !== fixedPage.slug || values.template !== fixedPage.template)) {
    throw new FixedWebsitePageBindingError("Đường dẫn và template của trang hệ thống thuộc cấu trúc code, không thể thay đổi từ CMS.");
  }

  const pageId = await writePage(id, values, editorId, options.expectedVersion ?? existing?.draftVersion);
  if (!pageId) return undefined;
  const page = await findPageBySlug(values.slug, false);
  return page ? adminPageSchema.parse(serialize(page)) : undefined;
}

export async function deleteArchivedAdminPage(id: string, editorId: string, expectedVersion?: number) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return undefined;
  const existing = await findAdminPageById(id);
  if (!existing) return undefined;
  if (getFixedWebsitePage(existing.slug)) {
    throw new FixedWebsitePageBindingError("Trang hệ thống không thể bị xóa từ CMS.");
  }
  return deleteArchivedPage(id, editorId, undefined, { expectedVersion });
}

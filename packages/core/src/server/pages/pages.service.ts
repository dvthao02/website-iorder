import { adminPageSchema, getFixedWebsitePage, pageBlockInputSchema, pageInputSchema } from "./pages.contract";
import { findPageBySlug, listAdminPages, listPublishedPageSummaries, writePage } from "./pages.repository";

export class FixedWebsitePageBindingError extends Error {}

function serialize(row: NonNullable<Awaited<ReturnType<typeof findPageBySlug>>>) {
  return { ...row, blocks: row.blocks.map(block => pageBlockInputSchema.parse(block)) };
}
export async function getPublishedPage(slug: string) {
  const page = await findPageBySlug(slug, true);
  return page ? adminPageSchema.parse(serialize(page)) : undefined;
}
export async function getAdminPages() {
  return adminPageSchema.array().parse((await listAdminPages()).map(page => serialize(page as NonNullable<Awaited<ReturnType<typeof findPageBySlug>>>)));
}
export async function getPublishedPageSummaries() { return listPublishedPageSummaries(); }
export async function saveAdminPage(
  id: string | null,
  input: unknown,
  editorId: string,
  options: { allowFixedPageCreation?: boolean } = {},
) {
  const values = pageInputSchema.parse(input);
  const existing = id ? (await listAdminPages()).find(page => page.id === id) : undefined;
  const fixedPage = existing ? getFixedWebsitePage(existing.slug) : undefined;

  if (id && !existing) return undefined;
  if (!id && getFixedWebsitePage(values.slug) && !options.allowFixedPageCreation) {
    throw new FixedWebsitePageBindingError("Trang hệ thống đã tồn tại và không thể tạo lại từ CMS.");
  }
  if (fixedPage && (values.slug !== fixedPage.slug || values.template !== fixedPage.template)) {
    throw new FixedWebsitePageBindingError("Đường dẫn và template của trang hệ thống thuộc cấu trúc code, không thể thay đổi từ CMS.");
  }

  const pageId = await writePage(id, values, editorId);
  if (!pageId) return undefined;
  const page = await findPageBySlug(values.slug, false);
  return page ? adminPageSchema.parse(serialize(page)) : undefined;
}

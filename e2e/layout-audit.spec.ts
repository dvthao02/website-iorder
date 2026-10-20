import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Rà bố cục toàn bộ màn CMS trên desktop: một vùng cuộn duy nhất, nằm gọn dưới thanh đã ghim
// (và trên thanh lưu ở màn soạn thảo), không khe trống, không tràn ngang.
const listRoutes = [
  "/admin", "/admin/analytics", "/admin/pages", "/admin/tin-tuc", "/admin/tai-nguyen", "/admin/media",
  "/admin/san-pham", "/admin/giai-phap", "/admin/dich-vu", "/admin/thiet-bi", "/admin/thiet-bi/nhom",
  "/admin/menu", "/admin/phan-loai-bai-viet", "/admin/seo", "/admin/seo/kiem-tra-xuat-ban", "/admin/chuyen-huong",
  "/admin/lien-ket-ngoai", "/admin/thong-tin-doanh-nghiep", "/admin/doi-tac", "/admin/khach-hang-tiem-nang",
  "/admin/tai-khoan", "/admin/phan-quyen", "/admin/nhat-ky", "/admin/cau-hinh", "/admin/giao-dien-cms",
];
const editorRoutes = ["/admin/tin-tuc/moi", "/admin/tai-nguyen/huong-dan/moi", "/admin/pages/new", "/admin/san-pham/moi", "/admin/dich-vu/moi", "/admin/thiet-bi/moi"];

type Layout = {
  documentOverflow: number; mainOverflow: number; horizontalOverflow: number;
  pageBarBottom: number | null; scrollTop: number | null;
  headerBottom: number | null; bodyTop: number | null; bodyBottom: number | null; actionsTop: number | null;
};

function measure(): Layout {
  const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
  const main = document.querySelector(".admin-shell__main")!;
  const scroll = document.querySelector(".admin-shell__scroll");
  const editorBody = box(".admin-editor-detail-page .admin-detail-panel__body");
  const scroller = editorBody ? document.querySelector(".admin-editor-detail-page .admin-detail-panel__body")! : scroll;
  return {
    documentOverflow: document.scrollingElement!.scrollHeight - innerHeight,
    mainOverflow: main.scrollHeight - main.clientHeight,
    horizontalOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
    pageBarBottom: box(".admin-page-bar")?.bottom ?? null,
    scrollTop: scroll?.getBoundingClientRect().top ?? null,
    headerBottom: box(".admin-detail-panel__header")?.bottom ?? null,
    bodyTop: editorBody?.top ?? null,
    bodyBottom: editorBody?.bottom ?? null,
    actionsTop: box(".admin-editor-actions--fixed")?.top ?? null,
  };
}

test.describe("Bố cục CMS trên desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await loginAsAdmin(page);
  });

  test("Màn danh sách: một vùng cuộn, bắt đầu ngay dưới thanh tiêu đề trang", async ({ page }) => {
    const problems: string[] = [];
    for (const route of listRoutes) {
      await page.goto(route);
      await page.locator(".admin-shell__scroll").waitFor();
      await page.waitForLoadState("networkidle");
      const layout = await page.evaluate(measure);
      if (layout.documentOverflow > 0) problems.push(`${route}: trang trình duyệt cuộn thêm ${layout.documentOverflow}px`);
      if (layout.mainOverflow > 1) problems.push(`${route}: khung ngoài tự cuộn (${layout.mainOverflow}px)`);
      if (layout.horizontalOverflow > 1) problems.push(`${route}: tràn ngang ${layout.horizontalOverflow}px`);
      if (layout.pageBarBottom !== null && layout.scrollTop !== null && Math.abs(layout.scrollTop - layout.pageBarBottom) > 1) problems.push(`${route}: vùng cuộn lệch thanh tiêu đề ${layout.scrollTop - layout.pageBarBottom}px`);
      await page.screenshot({ path: `test-results/layout${route.replaceAll("/", "_")}.png` });
    }
    expect(problems).toEqual([]);
  });

  test("Màn soạn thảo: thân cuộn nằm khít giữa thanh tiêu đề và thanh lưu", async ({ page }) => {
    const problems: string[] = [];
    for (const route of editorRoutes) {
      await page.goto(route);
      await page.locator(".admin-detail-panel__body").waitFor();
      await page.waitForLoadState("networkidle");
      const layout = await page.evaluate(measure);
      if (layout.documentOverflow > 0) problems.push(`${route}: trang trình duyệt cuộn thêm ${layout.documentOverflow}px`);
      if (layout.mainOverflow > 1) problems.push(`${route}: khung ngoài tự cuộn (${layout.mainOverflow}px)`);
      if (layout.horizontalOverflow > 1) problems.push(`${route}: tràn ngang ${layout.horizontalOverflow}px`);
      if (layout.headerBottom === null || layout.bodyTop === null || Math.abs(layout.bodyTop - layout.headerBottom) > 1) problems.push(`${route}: thân không bắt đầu ngay dưới tiêu đề (${layout.bodyTop} / ${layout.headerBottom})`);
      if (layout.actionsTop !== null && (layout.bodyBottom === null || Math.abs(layout.bodyBottom - layout.actionsTop) > 1)) problems.push(`${route}: khe giữa thân và thanh lưu ${layout.actionsTop - (layout.bodyBottom ?? 0)}px`);
      await page.screenshot({ path: `test-results/layout${route.replaceAll("/", "_")}.png` });
    }
    expect(problems).toEqual([]);
  });
});

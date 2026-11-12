import { expect, test, type Page } from "@playwright/test";
import { startCmsUxBackend, uxDownload, uxHomePage } from "./fixtures/cms-ux-backend";

// Chạy riêng với CMS dev trỏ BACKEND_URL=http://127.0.0.1:3102, E2E_CMS_URL=http://127.0.0.1:3101.
// Chặn nhầm môi trường trước khi khởi động fixture; không cần tài khoản hay dữ liệu người dùng.
test.describe("UX CMS với Backend mô phỏng", () => {
  test.setTimeout(120_000);
  test.skip(process.env.E2E_CMS_UX_FIXTURE !== "1", "Chỉ chạy khi bật Backend mô phỏng.");
  let stop: (() => Promise<void>) | undefined;
  const hydrationErrors = new WeakMap<Page, string[]>();
  test.beforeAll(async () => {
    if (process.env.E2E_CMS_URL !== "http://127.0.0.1:3101") throw new Error("Audit UX phải dùng CMS riêng tại 127.0.0.1:3101.");
    stop = await startCmsUxBackend();
  });
  test.afterAll(async () => { await stop?.(); });
  test.beforeEach(async ({ page, request }) => {
    const errors: string[] = [];
    hydrationErrors.set(page, errors);
    page.on("console", (message) => { if (/hydrated|hydration/i.test(message.text())) errors.push(message.text()); });
    const response = await request.get("/api/v1/admin/session");
    expect(response.headers()["x-iorder-ux-fixture"], "CMS phải trỏ tới Backend mô phỏng trước khi chạy audit.").toBe("1");
  });
  test.afterEach(async ({ page }) => { expect(hydrationErrors.get(page)).toEqual([]); });

  for (const width of [390, 1024, 1440]) test(`Trang chủ chọn một thành phần để sửa, không lặp mục lục ở ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/homepage");
    const editor = page.locator(".admin-blocks--split");
    await expect(editor.locator(".admin-blocks__navigation > h3")).toHaveText("Thành phần (8)");
    await expect(page.getByRole("heading", { name: "Bố cục trang", exact: true })).toHaveCount(0);
    const nav = editor.locator(".admin-blocks__navigation");
    await nav.getByRole("button", { name: /Logo đối tác, khách hàng/ }).click();
    const detail = page.getByRole("region", { name: "Chỉnh sửa thành phần" });
    await expect(detail.getByRole("textbox", { name: "Tiêu đề", exact: true })).toHaveValue("Đối tác và khách hàng đồng hành cùng iOrder");
    await expect(detail.getByRole("textbox", { name: "Mô tả", exact: true })).toHaveValue("Cùng phát triển với doanh nghiệp");
    await expect(editor.locator(".admin-block__body")).toHaveCount(1);
    if (width >= 1024) {
      const left = await nav.boundingBox(); const right = await detail.boundingBox();
      expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
      expect(Math.abs(left!.y - right!.y)).toBeLessThan(2);
    }
    await page.screenshot({ animations: "disabled", path: `test-results/cms-home-simple-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("Trang chủ gửi đủ dữ liệu của thành phần đang sửa khi lưu", async ({ page }) => {
    let values: typeof uxHomePage | undefined;
    await page.route("**/api/v1/admin/pages", async route => {
      const body = route.request().postDataJSON();
      expect(body.expectedVersion).toBe(uxHomePage.draftVersion);
      values = { ...uxHomePage, ...body.values, draftVersion: uxHomePage.draftVersion + 1 };
      await route.fulfill({ json: { page: values } });
    });
    await page.goto("/admin/homepage");
    await page.locator(".admin-blocks__navigation").getByRole("button", { name: /Logo đối tác, khách hàng/ }).click();
    const detail = page.getByRole("region", { name: "Chỉnh sửa thành phần" });
    await detail.getByRole("textbox", { name: "Tiêu đề", exact: true }).fill("Đối tác triển khai toàn quốc");
    await detail.getByRole("textbox", { name: "Mô tả", exact: true }).fill("Đồng hành từ triển khai đến vận hành");
    await detail.getByRole("combobox", { name: "Nhóm hiển thị", exact: true }).selectOption("partner");
    await detail.getByRole("spinbutton", { name: "Số lượng hiển thị", exact: true }).fill("12");
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lưu thay đổi", exact: true })).toBeDisabled();
    expect(values?.blocks).toHaveLength(8);
    expect(values?.blocks[1].data).toMatchObject({ title: "Đối tác triển khai toàn quốc", description: "Đồng hành từ triển khai đến vận hành", kind: "partner", limit: 12 });
    for (let index = 0; index < uxHomePage.blocks.length; index++) if (index !== 1) expect(values?.blocks[index]).toEqual(uxHomePage.blocks[index]);
  });

  test("Trang chủ giữ bản nhập khi đổi thành phần, đổi thứ tự và nhân bản", async ({ page }) => {
    await page.goto("/admin/homepage");
    const nav = page.locator(".admin-blocks__navigation");
    const detail = page.getByRole("region", { name: "Chỉnh sửa thành phần" });
    await nav.getByRole("button", { name: /Logo đối tác, khách hàng/ }).click();
    await detail.getByRole("textbox", { name: "Mô tả", exact: true }).fill("Nội dung đang sửa vẫn còn");
    await nav.locator(".admin-block__toggle").nth(2).click();
    await nav.getByRole("button", { name: /Logo đối tác, khách hàng/ }).click();
    await expect(detail.getByRole("textbox", { name: "Mô tả", exact: true })).toHaveValue("Nội dung đang sửa vẫn còn");
    await detail.getByRole("button", { name: "Đưa Logo đối tác, khách hàng xuống", exact: true }).click();
    await expect(nav.locator(".admin-block__toggle").nth(2)).toHaveAttribute("aria-current", "true");
    await detail.getByRole("button", { name: "Nhân bản Logo đối tác, khách hàng", exact: true }).click();
    await expect(nav.locator(".admin-block")).toHaveCount(9);
    await expect(nav.locator(".admin-block__toggle").nth(3)).toHaveAttribute("aria-current", "true");
    await expect(detail.getByRole("textbox", { name: "Mô tả", exact: true })).toHaveValue("Nội dung đang sửa vẫn còn");
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(nav.locator(".admin-block")).toHaveCount(8);
  });

  test("Nội dung lưu từ CMS xuất hiện trên trang chủ dùng renderer website thật", async ({ page }) => {
    test.skip(process.env.E2E_CMS_UX_WEB !== "1", "Cần publish-web riêng trỏ tới Backend mô phỏng.");
    expect(process.env.E2E_WEB_URL).toBe("http://127.0.0.1:3100");
    const original = structuredClone(uxHomePage);
    await page.route("**/api/v1/admin/pages", async route => {
      const body = route.request().postDataJSON();
      Object.assign(uxHomePage, body.values, { draftVersion: uxHomePage.draftVersion + 1 });
      await route.fulfill({ json: { page: uxHomePage } });
    });
    try {
      await page.goto("/admin/homepage");
      await page.locator(".admin-blocks__navigation").getByRole("button", { name: /Logo đối tác, khách hàng/ }).click();
      const detail = page.getByRole("region", { name: "Chỉnh sửa thành phần" });
      await detail.getByRole("textbox", { name: "Tiêu đề", exact: true }).fill("Đối tác triển khai toàn quốc");
      await detail.getByRole("textbox", { name: "Mô tả", exact: true }).fill("Đồng hành từ triển khai đến vận hành");
      await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
      await expect(page.getByRole("button", { name: "Lưu thay đổi", exact: true })).toBeDisabled();
      await page.goto("http://127.0.0.1:3100/", { timeout: 120_000 });
      await expect(page.getByRole("heading", { name: "Đối tác triển khai toàn quốc", exact: true })).toBeVisible();
      await expect(page.getByText("Đồng hành từ triển khai đến vận hành", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Đối tác kiểm chứng", exact: true })).toHaveAttribute("href", "https://example.com");
      await expect(page.getByRole("heading", { name: "Phần mềm và thiết bị cho doanh nghiệp", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Cần tư vấn triển khai?", exact: true })).toBeVisible();
      for (const heading of ["Một đối tác cho phần mềm và thiết bị", "Phần mềm quản lý bán hàng iOrder", "Vì sao doanh nghiệp chọn iOrder", "Thiết bị và hạ tầng đồng bộ", "Tin tức và chia sẻ từ iOrder"]) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.getByText("Theo dõi đơn hàng và doanh thu", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /Máy in hóa đơn/ })).toHaveAttribute("href", "/thiet-bi");
      await page.getByRole("heading", { name: "Đối tác triển khai toàn quốc", exact: true }).locator("xpath=ancestor::section[1]").screenshot({ animations: "disabled", path: "test-results/home-partners-from-cms.png" });
      await page.screenshot({ animations: "disabled", path: "test-results/home-content-from-cms.png", fullPage: true });
    } finally { Object.assign(uxHomePage, original); }
  });

  test("Tệp cài đặt chỉ rõ lỗi, chặn hiển thị thiếu tệp và giữ bản nhập khi API lỗi", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let attempts = 0;
    await page.route("**/api/v1/admin/support-downloads", async route => {
      if (route.request().method() === "GET") return route.continue();
      attempts++;
      await route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT", message: "Tệp đã được cập nhật ở phiên khác." } } });
    });
    await page.goto("/admin/resources?create=1");
    const panel = page.getByRole("dialog", { name: "Thêm tệp cài đặt", exact: true });
    const title = panel.getByRole("textbox", { name: "Tên hiển thị", exact: true });
    await title.fill(" ");
    await title.press("Control+s");
    await expect(panel.locator(".admin-form-errors")).toBeFocused();
    await panel.locator(".admin-form-errors a").click();
    await expect(title).toBeFocused();
    await title.fill("Tệp mới");
    await panel.getByRole("checkbox", { name: "Hiển thị công khai trên website" }).check();
    await panel.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(panel.locator(".admin-form-errors")).toContainText("Chọn tệp PDF hoặc ZIP");
    expect(attempts).toBe(0);
    await panel.getByRole("checkbox", { name: "Hiển thị công khai trên website" }).uncheck();
    await panel.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(panel.locator(".admin-notice--error")).toHaveText("Tệp đã được cập nhật ở phiên khác.");
    await expect(title).toHaveValue("Tệp mới");
    await page.screenshot({ animations: "disabled", path: "test-results/cms-ux-download-390.png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(panel.locator(".admin-notice--error")).toHaveCount(0);
  });

  test("Tệp cài đặt kiểm tra phản hồi và giữ phiên bản bản nhập qua refresh danh sách", async ({ page }) => {
    const requests: Array<{ values: { title: string }; expectedVersion?: number }> = [];
    let attempt = 0;
    await page.route("**/api/v1/admin/support-downloads**", async route => {
      if (route.request().method() === "GET") return route.continue();
      const body = route.request().postDataJSON();
      requests.push(body);
      attempt++;
      const download = { ...uxDownload, ...body.values, title: body.values.title.trim(), draftVersion: (body.expectedVersion ?? 0) + 1 };
      if (attempt === 1) return route.fulfill({ json: { download: { ...download, draftVersion: undefined } } });
      await route.fulfill({ json: { download } });
    });
    await page.goto(`/admin/resources?edit=${uxDownload.id}`);
    const panel = page.getByRole("dialog", { name: `Tệp cài đặt: ${uxDownload.title}` });
    const title = panel.getByRole("textbox", { name: "Tên hiển thị", exact: true });
    await title.fill("  Bản sửa một  ");
    await panel.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(panel.locator(".admin-notice--error")).toContainText("Phản hồi lưu tệp cài đặt không hợp lệ");
    await expect(title).toHaveValue("  Bản sửa một  ");
    await page.getByRole("dialog").getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Tên hiển thị", exact: true })).toHaveValue("Bản sửa một");
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
    await page.getByRole("textbox", { name: "Tên hiển thị", exact: true }).fill("Bản sửa hai");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
    expect(requests.map(body => body.expectedVersion)).toEqual([1, 1, 2]);
  });

  test("Tệp mới tải lên còn được chọn khi tự lưu thất bại và có thể lưu lại", async ({ page }) => {
    const asset = { id: "10000000-0000-4000-8000-000000000010", originalName: "huong-dan.pdf", mimeType: "application/pdf", fileSize: 10, url: "/media/ux.pdf", version: 0, altText: null, caption: null };
    let attempts = 0;
    await page.route("**/api/v1/admin/media", async route => route.request().method() === "POST" ? route.fulfill({ json: { asset } }) : route.continue());
    await page.route(`**/api/v1/admin/media/${asset.id}`, route => route.fulfill({ json: { asset } }));
    await page.route(`**/api/v1/admin/media/${asset.id}/usage`, route => route.fulfill({ json: { items: [], total: 0, canDelete: true } }));
    await page.route("**/api/v1/admin/support-downloads", async route => {
      if (route.request().method() === "GET") return route.continue();
      const body = route.request().postDataJSON();
      expect(body.values.fileMediaId).toBe(asset.id);
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Tạm thời chưa lưu được tệp cài đặt." } } });
      await route.fulfill({ json: { download: { ...uxDownload, ...body.values, originalName: asset.originalName, mimeType: asset.mimeType, downloadUrl: asset.url } } });
    });
    await page.goto("/admin/resources?create=1");
    await page.getByLabel("Chọn tệp cho Tệp tải xuống", { exact: true }).setInputFiles({ name: asset.originalName, mimeType: asset.mimeType, buffer: Buffer.from("%PDF-test") });
    await expect(page.getByRole("textbox", { name: "Tên hiển thị", exact: true })).toHaveValue("huong dan");
    await expect(page.locator("#support-download-editor > .admin-notice--error")).toHaveText("Tạm thời chưa lưu được tệp cài đặt.");
    await expect(page.getByRole("button", { name: "Bỏ tệp", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
    await expect(page.locator("#support-download-editor > .admin-notice--error")).toHaveCount(0);
    await expect(page.locator(".media-picker__error")).toHaveCount(0);
    expect(attempts).toBe(2);
  });

  test("Tệp cài đặt khóa form chỉ xem và khóa xuất bản khi thiếu quyền", async ({ context, page }) => {
    await context.addCookies([{ name: "ux-view-only", value: "1", url: "http://127.0.0.1:3101" }]);
    await page.goto(`/admin/resources?edit=${uxDownload.id}`);
    await expect(page.getByRole("textbox", { name: "Tên hiển thị", exact: true })).toBeDisabled();
    await expect(page.getByText("Bạn chỉ có quyền xem tệp cài đặt này.")).toBeVisible();
    await context.clearCookies();
    await context.addCookies([{ name: "ux-download-editor", value: "1", url: "http://127.0.0.1:3101" }]);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Tên hiển thị", exact: true })).toBeEnabled();
    await expect(page.getByRole("checkbox", { name: "Hiển thị công khai trên website" })).toBeDisabled();
    await context.addCookies([{ name: "ux-download-published", value: "1", url: "http://127.0.0.1:3101" }]);
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Tên hiển thị", exact: true })).toBeDisabled();
    await expect(page.getByText("Tệp đang hiển thị trên website. Bạn cần quyền xuất bản tệp cài đặt để sửa mục này.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Nhóm thiết bị tự tạo đường dẫn, chỉ rõ lỗi và giữ bản nhập khi xung đột", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/v1/admin/equipment", route => route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT", message: "Nhóm đã thay đổi. Hãy tải lại trước khi lưu." } } }));
    await page.goto("/admin/equipment/groups?create=1");
    const name = page.getByRole("textbox", { name: "Tên nhóm", exact: true });
    const slug = page.getByRole("textbox", { name: "Đường dẫn", exact: true });
    await name.fill("Máy bán hàng");
    await expect(slug).toHaveValue("may-ban-hang");
    await slug.fill("đường dẫn sai");
    await name.fill("Máy bán hàng mới");
    await expect(slug).toHaveValue("đường dẫn sai");
    await page.getByRole("button", { name: "Lưu nhóm thiết bị", exact: true }).click();
    await expect(page.locator(".admin-form-errors")).toBeFocused();
    await page.locator(".admin-form-errors a").click();
    await expect(slug).toBeFocused();
    await slug.fill("may-ban-hang-moi");
    await page.getByRole("button", { name: "Lưu nhóm thiết bị", exact: true }).click();
    await expect(page.locator(".admin-detail-panel__content > .admin-notice").getByText("Nhóm đã thay đổi. Hãy tải lại trước khi lưu.")).toBeVisible();
    await expect(name).toHaveValue("Máy bán hàng mới");
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await name.fill("Nhóm mới");
    await expect(slug).toHaveValue("nhom-moi");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("Nhóm thiết bị lưu tiếp dùng id vừa tạo và đúng phiên bản", async ({ page }) => {
    const requests: Array<{ id: string | null; expectedVersion?: number }> = [];
    const id = "10000000-0000-4000-8000-000000000008";
    await page.route("**/api/v1/admin/equipment", async route => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: { id } });
    });
    await page.goto("/admin/equipment/groups?create=1");
    const name = page.getByRole("textbox", { name: "Tên nhóm", exact: true });
    const save = page.getByRole("button", { name: "Lưu nhóm thiết bị", exact: true });
    await name.fill("Nhóm đầu tiên");
    await save.click();
    await expect(save).toBeDisabled();
    await expect(page).toHaveURL(new RegExp(`edit=${id}`));
    await name.fill("Nhóm sửa lần một");
    await save.click();
    await expect(save).toBeDisabled();
    await name.fill("Nhóm sửa lần hai");
    await save.click();
    await expect(save).toBeDisabled();
    expect(requests.map(item => ({ id: item.id, expectedVersion: item.expectedVersion }))).toEqual([
      { id: null, expectedVersion: undefined }, { id, expectedVersion: 0 }, { id, expectedVersion: 1 },
    ]);
    await expect(page.getByRole("textbox", { name: "Đường dẫn", exact: true })).toHaveValue("nhom-dau-tien");
  });

  test("Nhóm thiết bị chỉ xem khóa trường nhập và giải thích quyền", async ({ context, page }) => {
    await context.addCookies([{ name: "ux-view-only", value: "1", url: "http://127.0.0.1:3101" }]);
    await page.goto("/admin/equipment/groups?create=1");
    await expect(page.getByText("Bạn chỉ có quyền xem nhóm thiết bị này.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Tên nhóm", exact: true })).toBeDisabled();
  });

  test("Editor trang giữ lỗi lưu trên form dù bản nhập vẫn chưa lưu", async ({ page }) => {
    await page.route("**/api/v1/admin/pages", route => route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT", message: "Trang đã thay đổi từ phiên làm việc khác." } } }));
    await page.goto("/admin/pages/new");
    const title = page.getByRole("textbox", { name: "Tên trang", exact: true });
    await title.fill("Trang cần lưu");
    await title.press("Control+s");
    const notice = page.locator(".admin-detail-panel__content > .admin-notice--error");
    await expect(notice).toHaveText("Trang đã thay đổi từ phiên làm việc khác.");
    await expect(title).toHaveValue("Trang cần lưu");
    // Đóng toast để xác nhận lỗi không phụ thuộc thông báo tạm thời.
    await page.locator(".admin-toast-stack").getByRole("button", { name: "Đóng thông báo", exact: true }).click();
    await expect(notice).toBeVisible();
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(notice).toHaveCount(0);
  });

  test("Tìm kiếm tách lỗi, thử lại và mở kết quả bằng bàn phím", async ({ page }) => {
    let attempt = 0;
    await page.route("**/api/v1/admin/tim-kiem?*", async (route) => {
      attempt++;
      if (attempt === 1) return route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Tạm lỗi" } } });
      return route.fulfill({ json: { items: [{ id: "redirects", label: "Chuyển hướng URL", type: "Điều hướng CMS", slug: "/admin/redirects", href: "/admin/redirects" }] } });
    });
    await page.goto("/admin/users");
    const input = page.getByRole("combobox", { name: "Tìm nội dung CMS" });
    await input.fill("chuyển hướng");
    await expect(page.getByText("Đang tìm kiếm…", { exact: true })).toBeVisible();
    await expect(page.getByText("Không tải được kết quả. Vui lòng thử lại.")).toBeVisible();
    await expect(page.getByText(/Không có nội dung khớp/)).toHaveCount(0);
    await page.getByRole("button", { name: "Thử lại tìm kiếm" }).click();
    const option = page.getByRole("option", { name: /Chuyển hướng URL/ });
    await expect(option).toBeVisible();
    await expect(input).toBeFocused();
    await input.press("ArrowDown");
    await expect(option).toHaveAttribute("aria-selected", "true");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/admin\/redirects$/, { timeout: 60_000 });
  });

  test("Tìm kiếm không dùng phản hồi cũ cho từ khóa mới; từ khóa rỗng và Escape đóng kết quả", async ({ page }) => {
    await page.route("**/api/v1/admin/tim-kiem?*", async (route) => {
      const keyword = new URL(route.request().url()).searchParams.get("q");
      if (keyword === "từ cũ") await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({ json: { items: keyword === "từ cũ" ? [{ id: "old", label: "Kết quả cũ", type: "Trang", slug: "/cu", href: "/admin/pages" }] : [] } }).catch(() => undefined);
    });
    await page.goto("/admin/users");
    const input = page.getByRole("combobox", { name: "Tìm nội dung CMS" });
    await input.fill("từ cũ");
    await page.waitForRequest("**/api/v1/admin/tim-kiem?*");
    await input.fill("từ mới");
    await expect(page.getByText(/Không có nội dung khớp/)).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.getByRole("listbox", { name: "Kết quả tìm kiếm CMS" }).getByRole("option")).toHaveCount(0);
    await input.fill("từ mới ");
    await expect(page.getByText(/Không có nội dung khớp/)).toBeVisible();
    await input.press("Escape");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(input).toBeFocused();
    await input.fill("");
    await expect(page.getByRole("listbox", { name: "Kết quả tìm kiếm CMS" })).toHaveCount(0);
  });

  test("Cài đặt bảng giữ focus, đổi thứ tự bằng bàn phím và lưu qua tải lại", async ({ page }) => {
    await page.goto("/admin/redirects");
    await expect(page.getByRole("checkbox", { name: "Chọn /duong-dan-cu", exact: true })).toBeVisible();
    const trigger = page.getByRole("button", { name: "Cài đặt cột", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Cài đặt bảng" });
    const close = dialog.getByRole("button", { name: "Đóng cài đặt bảng" });
    await expect(close).toBeFocused();
    await close.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Lưu", exact: true })).toBeFocused();
    const move = dialog.getByRole("button", { name: "Đưa cột Đường dẫn cũ xuống", exact: true });
    await move.focus(); await move.press("Enter");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(trigger).toBeFocused();
    await expect(page.locator("thead th").nth(1)).toContainText("Đích đến");
    await page.reload();
    await expect(page.locator("thead th").nth(1)).toContainText("Đích đến");
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    const resize = page.getByRole("button", { name: "Thay đổi độ rộng cột Đường dẫn cũ", exact: true });
    await resize.focus(); await resize.press("ArrowRight");
    await trigger.click();
    await expect(dialog.getByRole("spinbutton", { name: "Độ rộng cột Đường dẫn cũ", exact: true })).toHaveValue("260");
  });

  test("Form tài khoản chỉ rõ lỗi, liên kết đến trường và giữ bản nhập khi API lỗi", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo tài khoản CMS" });
    await dialog.getByLabel("Tên đăng nhập", { exact: true }).fill("a");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    const errors = dialog.locator(".admin-form-errors");
    await expect(errors).toBeFocused();
    await expect(dialog.getByLabel("Tên đăng nhập", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await errors.getByRole("link", { name: /^Họ và tên:/ }).click();
    await expect(dialog.getByLabel("Họ và tên", { exact: true })).toBeFocused();
    await dialog.getByLabel("Tên đăng nhập", { exact: true }).fill("kiem-tra-ux");
    await dialog.getByLabel("Họ và tên", { exact: true }).fill("Người dùng kiểm tra");
    await dialog.getByLabel("Mật khẩu ban đầu", { exact: true }).fill("MatKhauThuNghiem123");
    await page.route("**/api/v1/admin/users", (route) => route.fulfill({ status: 500, json: { error: { code: "UNAVAILABLE", message: "Không lưu được tài khoản thử nghiệm." } } }));
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dialog.getByText("Không lưu được tài khoản thử nghiệm.", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Họ và tên", { exact: true })).toHaveValue("Người dùng kiểm tra");
  });

  test("Chuyển hướng tự trỏ chính nó báo lỗi đích, lỗi 409 giữ dữ liệu", async ({ page }) => {
    await page.goto("/admin/redirects");
    await page.getByRole("button", { name: "Tạo chuyển hướng", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Tạo chuyển hướng" });
    await dialog.getByLabel("Đường dẫn cũ", { exact: true }).fill("/thu-ux");
    await dialog.getByLabel("Đường dẫn mới", { exact: true }).fill("/thu-ux");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dialog.getByLabel("Đường dẫn mới", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await dialog.getByLabel("Đường dẫn mới", { exact: true }).fill("/dich-moi");
    await page.route("**/api/v1/admin/redirects", (route) => route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT", message: "Phiên bản đã thay đổi." } } }));
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dialog.getByText("Phiên bản đã thay đổi.", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Đường dẫn mới", { exact: true })).toHaveValue("/dich-moi");
    await expect(page.getByText("Nội dung vừa được người khác cập nhật.", { exact: true })).toBeVisible();
  });

  test("Danh sách rỗng phân biệt bộ lọc và có đường khôi phục", async ({ page }) => {
    await page.goto("/admin/partners?query=khong-co");
    await expect(page.getByText("Không có nội dung khớp bộ lọc", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
    await expect(page.getByText("Chưa có đối tác hoặc khách hàng", { exact: true })).toBeVisible();
    await page.goto("/admin/media?query=khong-co");
    await expect(page.getByText("Không có kết quả", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
    await expect(page.getByText("Thư viện chưa có tệp", { exact: true })).toBeVisible();
  });

  test("Vai trò có lỗi tại trường, lỗi API và bỏ thay đổi", async ({ page }) => {
    await page.goto("/admin/users?tab=roles");
    await page.getByRole("button", { name: "Tạo vai trò", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Tạo vai trò", exact: true });
    await panel.getByLabel("Tên vai trò", { exact: true }).fill("a");
    await panel.getByRole("button", { name: "Lưu vai trò", exact: true }).click();
    await expect(panel.locator(".admin-form-errors")).toBeFocused();
    await expect(panel.getByLabel("Tên vai trò", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await panel.getByLabel("Tên vai trò", { exact: true }).fill("Nhóm kiểm tra");
    await page.route("**/api/v1/admin/roles", (route) => route.fulfill({ status: 500, json: { error: { code: "UNAVAILABLE", message: "Không lưu được vai trò thử nghiệm." } } }));
    await panel.getByRole("button", { name: "Lưu vai trò", exact: true }).click();
    await expect(panel.getByText("Không lưu được vai trò thử nghiệm.", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(panel.getByLabel("Tên vai trò", { exact: true })).toHaveValue("");
    await expect(panel.locator(".admin-form-errors")).toHaveCount(0);
    await expect(panel.getByText("Không lưu được vai trò thử nghiệm.", { exact: true })).toHaveCount(0);
  });

  test("Chuyên mục tự tạo đường dẫn, giữ đường dẫn sửa tay và gửi đúng version khi lưu liên tiếp", async ({ page }) => {
    const writes: Array<{ id: string | null; expectedVersion?: number; values: { name: string; slug: string } }> = [];
    await page.route("**/api/v1/admin/taxonomy", async (route) => {
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: { id: "10000000-0000-4000-8000-000000000009" } });
    });
    await page.goto("/admin/taxonomy");
    await page.getByRole("button", { name: "Thêm chuyên mục", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Biên tập chuyên mục" });
    await panel.getByLabel("Tên chuyên mục", { exact: true }).fill("Quản lý bán hàng");
    await expect(panel.getByLabel("Đường dẫn", { exact: true })).toHaveValue("quan-ly-ban-hang");
    await panel.getByLabel("Đường dẫn", { exact: true }).fill("duong-dan-rieng");
    await panel.getByLabel("Tên chuyên mục", { exact: true }).fill("Tên khác");
    await expect(panel.getByLabel("Đường dẫn", { exact: true })).toHaveValue("duong-dan-rieng");
    await panel.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await panel.getByLabel("Tên chuyên mục", { exact: true }).fill("Tên khác");
    await expect(panel.getByLabel("Đường dẫn", { exact: true })).toHaveValue("ten-khac");
    await panel.getByLabel("Đường dẫn", { exact: true }).fill("/sai");
    await panel.getByRole("button", { name: "Lưu phân loại", exact: true }).click();
    await expect(panel.locator(".admin-form-errors")).toBeFocused();
    expect(writes).toHaveLength(0);
    await panel.getByLabel("Đường dẫn", { exact: true }).fill("duong-dan-rieng");
    await panel.getByRole("button", { name: "Lưu phân loại", exact: true }).click();
    await expect(panel.getByText("Không có thay đổi chưa lưu.", { exact: true })).toBeVisible();
    await panel.getByLabel("Tên chuyên mục", { exact: true }).fill("Tên cập nhật");
    await panel.getByRole("button", { name: "Lưu phân loại", exact: true }).click();
    await expect(panel.getByText("Không có thay đổi chưa lưu.", { exact: true })).toBeVisible();
    expect(writes).toHaveLength(2);
    expect(writes[0].id).toBeNull();
    expect(writes[0].expectedVersion).toBeUndefined();
    expect(writes[1].expectedVersion).toBe(0);
    expect(writes[1].values.slug).toBe("duong-dan-rieng");
  });

  for (const kind of ["partners", "testimonials"] as const) test(`Lỗi form ${kind === "partners" ? "Đối tác" : "Đánh giá"} liên kết đúng trường và giữ dữ liệu khi 409`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/admin/partners?kind=${kind}`);
    await page.getByRole("button", { name: kind === "partners" ? "Thêm đối tác" : "Thêm đánh giá", exact: true }).first().click();
    const panel = page.getByRole("dialog", { name: kind === "partners" ? "Biên tập đối tác" : "Biên tập đánh giá khách hàng" });
    const name = panel.getByLabel(kind === "partners" ? "Tên đối tác" : "Họ tên khách hàng", { exact: true });
    await name.fill("Người kiểm tra UX");
    const field = panel.getByLabel(kind === "partners" ? "Website" : "Nhận xét", { exact: true });
    await field.fill(kind === "partners" ? "sai-url" : "   ");
    await panel.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(panel.locator(".admin-form-errors")).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    expect(await panel.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await panel.locator(".admin-side-panel__content").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: "disabled", path: `test-results/cms-ux-${kind}-390.png` });
    await field.fill(kind === "partners" ? "https://example.com" : "Nhận xét dùng để kiểm thử giao diện.");
    await page.route("**/api/v1/admin/supporting", (route) => route.fulfill({ status: 409, json: { error: { code: "VERSION_CONFLICT", message: "Nội dung thử nghiệm vừa thay đổi." } } }));
    await panel.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(panel.getByText("Nội dung thử nghiệm vừa thay đổi.", { exact: true })).toBeVisible();
    await expect(name).toHaveValue("Người kiểm tra UX");
  });

  const settingsCases = [
    { route: "/admin/company-profile", api: "profile", field: "Email hỗ trợ", value: "ux@example.com", name: "Lưu thông tin doanh nghiệp", key: "profile", version: 2 },
    { route: "/admin/external-links", api: "external-links", field: "Facebook", value: "https://example.com/ux", name: "Lưu liên kết ngoài", key: "links", version: 3 },
    { route: "/admin/seo", api: "publishing-config", field: "Địa chỉ website chính thức", value: "https://example.com", name: "Lưu thay đổi", key: "config", version: 4 },
  ];
  for (const entry of settingsCases) test(`Cài đặt ${entry.api}: lỗi tại trường, phản hồi sai và lưu đúng phiên bản`, async ({ page }) => {
    const writes: Array<{ values: Record<string, unknown>; expectedVersion: number }> = [];
    await page.route(`**/api/v1/admin/${entry.api}`, async (route) => {
      const body = route.request().postDataJSON(); writes.push(body);
      if (writes.length === 1) return route.fulfill({ json: { [entry.key]: body.values } });
      return route.fulfill({ json: { [entry.key]: body.values, version: 7 } });
    });
    await page.goto(entry.route);
    const input = page.getByLabel(entry.field, { exact: true });
    if (entry.api === "profile") await page.getByLabel("Tên doanh nghiệp", { exact: true }).fill("  iOrder thử nghiệm  ");
    await input.fill("sai");
    const save = page.getByRole("button", { name: entry.name, exact: true });
    await save.click();
    await expect(page.locator(".admin-form-errors")).toBeFocused();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    expect(writes).toHaveLength(0);
    await input.fill(entry.value);
    await save.click();
    await expect(page.getByText(/Phản hồi lưu .*không hợp lệ/).first()).toBeVisible();
    await expect(input).toHaveValue(entry.value);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();
    await expect(page.getByText("Không có thay đổi chưa lưu.", { exact: true })).toBeVisible();
    if (entry.api === "profile") await expect(page.getByLabel("Tên doanh nghiệp", { exact: true })).toHaveValue("iOrder thử nghiệm");
    expect(writes[1].expectedVersion).toBe(entry.version);
    const nextValue = entry.api === "profile" ? "ux-moi@example.com" : entry.value + "-moi";
    await input.fill(nextValue);
    await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(input).toHaveValue(entry.value);
    await input.fill(nextValue);
    await save.click();
    await expect(page.getByText("Không có thay đổi chưa lưu.", { exact: true })).toBeVisible();
    expect(writes[2].expectedVersion).toBe(7);
  });

  for (const entry of settingsCases) test(`Chỉ xem: ${entry.api} khóa ô nhập và giải thích quyền`, async ({ context, page }) => {
    await context.addCookies([{ name: "ux-view-only", value: "1", url: "http://127.0.0.1:3101" }]);
    await page.goto(entry.route);
    await expect(page.getByText("Bạn chỉ có quyền xem cấu hình. Cần quyền sửa cài đặt để thay đổi.", { exact: true })).toBeVisible();
    await expect(page.getByLabel(entry.field, { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: entry.name, exact: true })).toBeDisabled();
  });

  test("Chỉ xem: Vai trò, Chuyên mục và Đối tác không cho chỉnh sửa", async ({ context, page }) => {
    await context.addCookies([{ name: "ux-view-only", value: "1", url: "http://127.0.0.1:3101" }]);
    await page.goto("/admin/users?tab=roles");
    await expect(page.getByRole("button", { name: "Tạo vai trò", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /Biên tập viên/ }).click();
    const rolePanel = page.getByRole("dialog", { name: "Xem vai trò", exact: true });
    await expect(rolePanel.getByLabel("Tên vai trò", { exact: true })).toHaveAttribute("readonly", "");
    await expect(rolePanel.getByRole("button", { name: "Lưu vai trò", exact: true })).toHaveCount(0);
    await page.goto("/admin/taxonomy");
    await expect(page.getByRole("button", { name: "Thêm chuyên mục", exact: true })).toHaveCount(0);
    await page.getByText("Chuyên mục có sẵn", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Biên tập chuyên mục" }).getByLabel("Tên chuyên mục", { exact: true })).toBeDisabled();
    await page.goto("/admin/partners");
    await page.getByText("Đối tác có sẵn", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Biên tập đối tác" }).getByLabel("Tên đối tác", { exact: true })).toBeDisabled();
  });

  for (const width of [390, 768, 1440]) test(`Form cài đặt, Vai trò và Phân loại rõ lỗi, không tràn ở ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const entry of settingsCases) {
      await page.goto(entry.route);
      await page.getByLabel(entry.field, { exact: true }).fill("sai");
      await page.getByRole("button", { name: entry.name, exact: true }).click();
      await expect(page.locator(".admin-form-errors")).toBeFocused();
      expect(await page.locator(".admin-shell__scroll").evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ animations: "disabled", path: `test-results/cms-ux-${entry.api}-${width}.png` });
      await page.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    }
    await page.goto("/admin/users?tab=roles");
    await page.getByRole("button", { name: "Tạo vai trò", exact: true }).click();
    const rolePanel = page.getByRole("dialog", { name: "Tạo vai trò", exact: true });
    await rolePanel.getByLabel("Tên vai trò", { exact: true }).fill("a");
    await rolePanel.getByRole("button", { name: "Lưu vai trò", exact: true }).click();
    await expect(rolePanel.locator(".admin-form-errors")).toBeFocused();
    expect(await rolePanel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await rolePanel.locator(".admin-side-panel__content").evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const panelBounds = (await rolePanel.boundingBox())!;
    const inputBounds = (await rolePanel.getByLabel("Tên vai trò", { exact: true }).boundingBox())!;
    expect(inputBounds.x + inputBounds.width).toBeLessThanOrEqual(panelBounds.x + panelBounds.width - 8);
    await page.screenshot({ animations: "disabled", path: `test-results/cms-ux-roles-${width}.png` });
    await rolePanel.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await page.goto("/admin/taxonomy");
    await page.getByRole("button", { name: "Thêm chuyên mục", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Biên tập chuyên mục" });
    await panel.getByLabel("Tên chuyên mục", { exact: true }).fill("Mục mới");
    await panel.getByLabel("Đường dẫn", { exact: true }).fill("/sai");
    await panel.getByRole("button", { name: "Lưu phân loại", exact: true }).click();
    await expect(panel.locator(".admin-form-errors")).toBeFocused();
    expect(await panel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await panel.locator(".admin-side-panel__content").evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: "disabled", path: `test-results/cms-ux-taxonomy-${width}.png` });
  });

  for (const width of [390, 768, 1440]) test(`Form lỗi và cài đặt bảng nằm gọn ở ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/redirects");
    await page.getByRole("button", { name: "Cài đặt cột", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Cài đặt bảng" });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: "disabled", path: `test-results/cms-ux-table-${width}.png` });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Tạo chuyển hướng", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Tạo chuyển hướng" });
    await expect(panel.getByText("Quy tắc đường dẫn và mã chuyển hướng", { exact: true })).toBeVisible();
    await expect(panel.locator(".admin-form-help")).not.toHaveAttribute("open");
    await panel.getByLabel("Đường dẫn cũ", { exact: true }).fill("sai");
    await panel.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(panel.locator(".admin-form-errors")).toBeFocused();
    expect(await panel.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ animations: "disabled", path: `test-results/cms-ux-form-${width}.png` });
  });
});

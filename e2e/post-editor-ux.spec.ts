import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Màn soạn bài 2 cột: viết ngay ở màn đầu, thiết lập luôn nhìn thấy, nút lưu nói rõ hành động.
// Chỉ mở và thao tác trên form, không lưu dữ liệu.
test("Soạn bài: tiêu đề và nội dung ở màn đầu, đường dẫn tự tạo, nút lưu đổi theo trạng thái", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  await page.goto("/admin/tin-tuc/moi");

  const title = page.getByLabel("Tiêu đề", { exact: true });
  const editor = page.locator(".admin-rte__content .tiptap");
  // Trình soạn thảo nằm trong màn hình đầu tiên, không phải cuộn mới thấy.
  expect((await editor.boundingBox())!.y).toBeLessThan(500);
  // Cột thiết lập nằm bên phải phần viết.
  const side = page.getByRole("complementary", { name: "Thiết lập bài viết" });
  expect((await side.boundingBox())!.x).toBeGreaterThan((await editor.boundingBox())!.x + 400);
  // Hai cột cân nhau: cột thiết lập không dài hơn cột viết (không để lại mảng trống khi cuộn).
  const mainHeight = (await page.locator(".admin-post-editor__main").boundingBox())!.height;
  expect((await side.boundingBox())!.height).toBeLessThanOrEqual(mainHeight + 24);

  // Ctrl+S gửi form: chưa có tiêu đề thì trình duyệt chặn và đưa con trỏ về ô Tiêu đề (không lưu gì).
  await editor.click();
  await page.keyboard.press("Control+s");
  await expect(title).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/tin-tuc\/moi$/);

  await title.fill("Bài thử bố cục mới");
  await expect(page.locator(".admin-post-editor__path")).toHaveText("/tin-tuc/bai-thu-bo-cuc-moi");
  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  await expect(page.getByLabel("Đường dẫn (slug)")).toHaveValue("bai-thu-bo-cuc-moi");
  await page.getByRole("button", { name: "Xong", exact: true }).click();

  await expect(page.getByRole("button", { name: "Lưu nháp", exact: true })).toBeVisible();
  await side.getByRole("radio", { name: /^Đăng ngay/ }).check();
  await expect(page.getByRole("button", { name: "Xuất bản", exact: true })).toBeVisible();
  // Nhắc những thứ nên có trước khi đăng; bấm "Tóm tắt" đưa con trỏ tới đúng ô.
  const prepublish = side.getByRole("note");
  await expect(prepublish.getByRole("button")).toHaveText(["Ảnh bìa", "Tóm tắt", "Chuyên mục", /Nội dung dài hơn/]);
  await prepublish.getByRole("button", { name: "Tóm tắt" }).click();
  await expect(page.locator("#post-excerpt")).toBeFocused();
  // Tóm tắt lấy từ đoạn đầu bài.
  await page.locator(".admin-rte__content .tiptap").click();
  await page.keyboard.type("Đoạn mở đầu dùng làm tóm tắt cho bài viết.");
  await page.getByRole("button", { name: "Lấy từ đoạn đầu bài" }).click();
  await expect(page.locator("#post-excerpt")).toHaveValue("Đoạn mở đầu dùng làm tóm tắt cho bài viết.");
  await expect(prepublish.getByRole("button", { name: "Tóm tắt" })).toHaveCount(0);
  await side.getByRole("radio", { name: /^Hẹn giờ đăng/ }).check();
  await expect(page.getByRole("button", { name: "Lên lịch đăng", exact: true })).toBeVisible();
  await expect(side.getByLabel("Thời điểm đăng")).toBeVisible();

  // SEO thu gọn, có điểm tóm tắt; mở ra mới thấy chi tiết.
  const seo = page.locator("details").filter({ hasText: "Google & chia sẻ mạng xã hội" });
  await expect(seo.getByText(/SEO \d+\/\d+ đạt/)).toBeVisible();
  await expect(page.getByLabel("Tiêu đề SEO")).toBeHidden();
  await seo.locator("summary").click();
  await expect(page.getByLabel("Tiêu đề SEO")).toBeVisible();
  await expect(side.getByRole("heading", { name: "Ảnh bìa" })).toBeVisible();
  await page.screenshot({ path: "test-results/post-editor-new.png" });
});

test("Bài đã đăng: hiện trạng thái đang lưu và nút 'Cập nhật bài đã đăng'", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  const list = await (await page.request.get("/api/admin/posts?status=published&excludeType=guide&view=summary&pageSize=5")).json() as { result: { items: Array<{ id: string }> } };
  test.skip(!list.result.items.length, "Cần một bài đã xuất bản");
  await page.goto(`/admin/tin-tuc/${list.result.items[0].id}`);
  const side = page.getByRole("complementary", { name: "Thiết lập bài viết" });
  await expect(side.getByText("Đang hiển thị trên website")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cập nhật bài đã đăng" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Đã lưu" })).toBeVisible();
  await page.screenshot({ path: "test-results/post-editor-existing.png" });
});

test("Lưu nháp rồi mở lại: định dạng, bảng, danh sách, ảnh giữ nguyên; lưu lại không làm đổi nội dung", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  const origin = baseURL!;
  const stamp = Date.now();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  let postId: string | undefined;
  try {
    await page.goto("/admin/tin-tuc/moi");
    await page.getByLabel("Tiêu đề", { exact: true }).fill(`Kiểm tra lưu mở lại ${stamp}`);
    const editor = page.locator(".admin-rte__content .tiptap");
    // Đủ loại định dạng từ các mẫu bài: tiêu đề, đậm, danh sách, trích dẫn, bảng.
    for (const template of ["Hướng dẫn từng bước", "Tin tức", "Câu chuyện khách hàng", "Khuyến mãi"]) {
      await page.getByText("Mẫu bài", { exact: true }).click();
      await page.locator(".admin-rte__menu-item").filter({ hasText: template }).click();
    }
    await expect(editor.locator("table")).toHaveCount(2);
    await expect(editor.locator("blockquote")).toHaveCount(1);
    // Ảnh rộng 50%, chữ bao quanh bên trái.
    await editor.locator("p").last().click();
    await page.locator('.admin-rte input[type="file"][accept^="image/"]').first().setInputFiles({ name: `e2e-luu-mo-${stamp}.png`, mimeType: "image/png", buffer: png });
    const frame = editor.locator(".admin-rte-image");
    await frame.hover();
    await frame.getByRole("button", { name: "Chữ bao quanh, ảnh bên trái" }).click();
    await expect(frame).toHaveAttribute("data-width", "50");

    await page.getByRole("button", { name: "Lưu nháp", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/tin-tuc\/[0-9a-f-]{36}$/);
    postId = page.url().split("/").pop();
    const first = await (await page.request.get(`/api/admin/posts/${postId}`)).json() as { post: { content: unknown; draftVersion: number } };

    // Mở lại: không bị coi là có thay đổi, nội dung hiển thị đủ.
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "Đã lưu · Bản nháp" })).toBeVisible();
    await expect(editor.locator("table")).toHaveCount(2);
    await expect(editor.locator(".admin-rte-image")).toHaveAttribute("data-align", "left");
    await expect(editor.locator(".admin-rte-image")).toHaveAttribute("data-width", "50");

    // Lưu lại ngay (Ctrl+S) không làm đổi nội dung đã lưu.
    await editor.locator("p").first().click();
    await page.keyboard.press("Control+s");
    await expect(page.locator(".admin-toast").filter({ hasText: "Đã lưu bản nháp." })).toBeVisible();
    await expect.poll(async () => ((await (await page.request.get(`/api/admin/posts/${postId}`)).json()) as { post: { draftVersion: number } }).post.draftVersion).toBe(first.post.draftVersion + 1);
    const second = await (await page.request.get(`/api/admin/posts/${postId}`)).json() as { post: { content: unknown } };
    expect(second.post.content).toEqual(first.post.content);

    // Lịch sử phiên bản tự tải khi mở: mỗi phiên bản một dòng dễ đọc, bản hiện tại có nhãn "Đang dùng", không hiện dữ liệu thô.
    await page.reload();
    const history = page.locator("details").filter({ hasText: "Lịch sử phiên bản" });
    await history.locator("summary").click();
    const items = history.locator(".admin-revisions__item");
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText(`Phiên bản ${first.post.draftVersion + 1}`);
    await expect(items.first()).toContainText(`Kiểm tra lưu mở lại ${stamp}`);
    await expect(items.first().getByText("Đang dùng")).toBeVisible();
    await expect(items.nth(1).getByRole("button", { name: "Khôi phục" })).toBeEnabled();
    await expect(history.locator("pre")).toHaveCount(0);
  } finally {
    if (postId) {
      const current = await (await page.request.get(`/api/admin/posts/${postId}`)).json() as { post?: { draftVersion: number } };
      if (current.post) {
        const archived = await (await page.request.patch(`/api/admin/posts/${postId}`, { headers: { origin }, data: { action: "archive", expectedVersion: current.post.draftVersion } })).json() as { post?: { draftVersion: number } };
        await page.request.delete(`/api/admin/posts/${postId}`, { headers: { origin }, data: { expectedVersion: archived.post?.draftVersion ?? current.post.draftVersion + 1 } });
      }
    }
    const media = await (await page.request.get(`/api/admin/media?query=${encodeURIComponent(`e2e-luu-mo-${stamp}`)}`)).json() as { assets: Array<{ id: string }> };
    for (const asset of media.assets) await page.request.delete(`/api/admin/media/${asset.id}`, { headers: { origin } });
  }
});

test("Soạn bài trên máy tính bảng và điện thoại: không tràn ngang, nút lưu luôn trong tầm tay", async ({ page }) => {
  await loginAsAdmin(page);
  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin/tin-tuc/moi");
    await page.locator(".admin-rte__content .tiptap").waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `tràn ngang ở ${viewport.width}px`).toBeLessThanOrEqual(0);
    const save = page.getByRole("button", { name: "Lưu nháp", exact: true });
    await expect(save).toBeInViewport();
    await expect(page.getByLabel("Tiêu đề", { exact: true })).toBeInViewport();
    // Thanh lưu gọn một dòng (trạng thái + nút), không chiếm nhiều màn hình nhỏ.
    expect((await page.locator(".admin-editor-actions--fixed").boundingBox())!.height).toBeLessThanOrEqual(64);
    await page.screenshot({ path: `test-results/post-editor-${viewport.width}.png`, fullPage: true });
  }
});

test("Ảnh bìa: kéo thả để tải lên, chọn lại bằng lưới ảnh trong thư viện, xem trước đúng tỉ lệ chia sẻ", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await loginAsAdmin(page);
  const stamp = Date.now();
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const name = `e2e-anh-bia-${stamp}.png`;
  try {
    await page.goto("/admin/tin-tuc/moi");
    const cover = page.locator("#post-cover");
    await expect(cover.getByRole("heading", { name: "Ảnh bìa" })).toBeVisible();

    // Kéo thả một tệp ảnh vào khung tải lên.
    const dataTransfer = await page.evaluateHandle(({ base64, fileName }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], fileName, { type: "image/png" }));
      return transfer;
    }, { base64: pngBase64, fileName: name });
    const dropzone = cover.locator(".media-picker__upload");
    await dropzone.dispatchEvent("dragover", { dataTransfer });
    await expect(dropzone).toContainText("Thả tệp để tải lên");
    await dropzone.dispatchEvent("drop", { dataTransfer });
    const preview = cover.locator(".media-picker__preview img");
    await expect(preview).toBeVisible();
    // Khung xem trước theo tỉ lệ ảnh chia sẻ 1200×630.
    const box = (await preview.boundingBox())!;
    expect(Math.abs(box.width / box.height - 1200 / 630)).toBeLessThan(0.05);

    // Bỏ ảnh rồi chọn lại từ lưới ảnh thư viện (nhìn ảnh mà chọn, không phải danh sách tên).
    await cover.getByRole("button", { name: "Bỏ ảnh" }).click();
    await expect(preview).toHaveCount(0);
    await cover.getByRole("button", { name: "Chọn từ thư viện" }).click();
    await cover.getByLabel("Tìm ảnh").fill(`e2e-anh-bia-${stamp}`);
    const option = cover.getByRole("option", { name });
    await option.click();
    await expect(preview).toBeVisible();
    await expect(cover.getByRole("listbox", { name: "Ảnh trong thư viện" })).toHaveCount(0);

    await page.getByRole("radio", { name: /^Đăng ngay/ }).check();
    await expect(page.getByRole("note").getByRole("button", { name: "Ảnh bìa" })).toHaveCount(0);
    await cover.screenshot({ path: "test-results/post-cover.png" });
  } finally {
    const media = await (await page.request.get(`/api/admin/media?query=${encodeURIComponent(`e2e-anh-bia-${stamp}`)}`)).json() as { assets: Array<{ id: string }> };
    for (const asset of media.assets) await page.request.delete(`/api/admin/media/${asset.id}`, { headers: { origin: baseURL! } });
  }
});

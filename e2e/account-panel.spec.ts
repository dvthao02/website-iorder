import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./helpers";

// Chỉ đọc: không bấm "Lưu hồ sơ" hay "Đổi mật khẩu", không đổi dữ liệu của tài khoản đang đăng nhập.
test("Tài khoản của tôi là panel trượt từ phải: không rời trang, đổi tab không mất chữ, đóng khi chưa lưu thì hỏi", async ({ page }) => {
  await loginAsAdmin(page);
  const panel = page.getByRole("dialog", { name: "Tài khoản của tôi" });
  const openFromMenu = async (item: "Thông tin cá nhân" | "Đổi mật khẩu") => {
    await page.locator('summary[aria-label="Mở menu tài khoản"]').click();
    await page.getByRole("button", { name: item, exact: true }).click();
  };

  await openFromMenu("Thông tin cá nhân");
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await expect(panel.getByRole("tab", { name: "Hồ sơ", selected: true })).toBeVisible();

  // Thanh nút nằm sát đáy panel dù form ngắn.
  const saveBox = await panel.getByRole("button", { name: "Lưu hồ sơ" }).boundingBox();
  const panelBox = await panel.boundingBox();
  expect(panelBox!.y + panelBox!.height - (saveBox!.y + saveBox!.height)).toBeLessThan(24);

  // Ảnh đại diện (nếu tài khoản có ảnh): rê chuột xem nhanh, bấm mở hộp xem lớn; Esc chỉ đóng hộp xem ảnh, panel còn.
  const avatar = panel.getByRole("button", { name: "Xem ảnh đại diện" });
  if (await avatar.count()) {
    await avatar.hover();
    await expect(page.locator(".admin-image-lightbox--peek")).toBeVisible();
    await avatar.click();
    // Hộp xem ảnh đặt tên theo họ tên đang hiển thị.
    const viewer = page.getByRole("dialog", { name: await panel.getByLabel("Họ và tên").inputValue() });
    await expect(viewer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(panel).toBeVisible();
  }

  // Sửa họ tên rồi sang tab Mật khẩu và quay lại: chữ đang nhập vẫn còn.
  const fullName = panel.getByLabel("Họ và tên");
  const original = await fullName.inputValue();
  await fullName.fill(`${original} tạm`);
  await panel.getByRole("tab", { name: "Mật khẩu" }).click();
  await expect(panel.getByLabel("Mật khẩu hiện tại", { exact: true })).toBeVisible();
  await expect(fullName).toBeHidden();
  await panel.getByRole("tab", { name: "Hồ sơ" }).click();
  await expect(fullName).toHaveValue(`${original} tạm`);
  await expect(panel.getByText("Có thay đổi chưa lưu.")).toBeVisible();

  // Esc khi còn thay đổi: hỏi xác nhận; "Ở lại" giữ panel, "Đóng và bỏ thay đổi" đóng panel mà không lưu.
  const confirm = page.getByRole("alertdialog", { name: "Đóng khi chưa lưu?" });
  await page.keyboard.press("Escape");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Ở lại" }).click();
  await expect(confirm).toBeHidden();
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await confirm.getByRole("button", { name: "Đóng và bỏ thay đổi" }).click();
  await expect(panel).toBeHidden();

  // Mở lại: thấy giá trị đã lưu (không phải chữ tạm). Không có thay đổi thì đóng thẳng, không hỏi.
  await openFromMenu("Đổi mật khẩu");
  await expect(panel.getByRole("tab", { name: "Mật khẩu", selected: true })).toBeVisible();
  await panel.getByRole("tab", { name: "Hồ sơ" }).click();
  await expect(fullName).toHaveValue(original);
  await panel.getByRole("button", { name: "Đóng tài khoản" }).click();
  await expect(panel).toBeHidden();
  await expect(confirm).toBeHidden();
});

test("Đường dẫn cũ /admin/my-account vẫn mở panel đúng tab rồi về /admin", async ({ page }) => {
  await loginAsAdmin(page);
  const panel = page.getByRole("dialog", { name: "Tài khoản của tôi" });

  await page.goto("/admin/my-account/password");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Mật khẩu", selected: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/?$/);

  await page.goto("/admin/my-account");
  await expect(panel.getByRole("tab", { name: "Hồ sơ", selected: true })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/?$/);
});

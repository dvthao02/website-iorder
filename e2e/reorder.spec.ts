import { expect, test, type Locator } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

// Kéo thả không lưu: chỉ kiểm tra thứ tự trong form, không ghi vào dữ liệu.
async function dragAfter(handle: Locator, target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error("Không đo được vị trí đích");
  await handle.dragTo(target, { targetPosition: { x: box.width / 2, y: box.height - 4 } });
}

test("Kéo thả đổi thứ tự khối của trang", async ({ page }) => {
  await loginAsAdmin(page);
  const pages = await (await page.request.get("/api/admin/pages?query=home&pageSize=25")).json() as { result: { items: Array<{ id: string; slug: string }> } };
  const home = pages.result.items.find((item) => item.slug === "home");
  test.skip(!home, "Cần trang chủ có sẵn khối");
  await page.goto(`/admin/pages/${home!.id}`);
  const names = page.locator(".admin-block__toggle > strong");
  await expect(names.nth(2)).toBeVisible();
  const before = await names.allTextContents();
  // Khối 2 kéo xuống sau khối 3.
  await dragAfter(page.locator(".admin-block").nth(1).locator("[data-drag-handle]"), page.locator(".admin-block").nth(2));
  await expect.poll(() => names.allTextContents()).toEqual([before[0], before[2], before[1], ...before.slice(3)]);
});

test("Kéo thả đổi thứ tự mục menu cùng cấp", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/menu");
  const rows = page.locator(".admin-sortable-row");
  const titles = page.locator(".admin-sortable-row strong");
  await expect(rows.first()).toBeVisible();
  const before = await titles.allTextContents();
  const topLevel = await rows.evaluateAll((items) => items.map((item, index) => item.querySelector("svg.lucide-corner-down-right") ? -1 : index).filter((index) => index >= 0));
  test.skip(topLevel.length < 2, "Cần ít nhất hai mục cấp 1");
  const [first, second] = topLevel;
  await dragAfter(rows.nth(first).locator("[data-drag-handle]"), rows.nth(second));
  // Sau khi thả: mục được kéo nằm sau mục đích (so theo vị trí mới của cả hai).
  await expect.poll(async () => { const after = await titles.allTextContents(); return after.indexOf(before[first]) > after.indexOf(before[second]); }).toBe(true);
  await expect(page.getByRole("tab", { name: /chưa lưu/ })).toBeVisible();
});

import { expect, test } from "@playwright/test";

import { adminCredentials, loginAsAdmin } from "./helpers";

// Optimistic concurrency cho màn cấu hình: hai phiên cùng sửa thì phiên lưu sau với
// phiên bản cũ nhận 409, dữ liệu không bị ghi đè âm thầm. Dữ liệu được trả lại như cũ.
test("Liên kết ngoài: lưu với phiên bản cũ bị từ chối 409", async ({ request, baseURL }) => {
  const headers = { origin: baseURL!, "content-type": "application/json" };
  expect((await request.post("/api/admin/session", { headers, data: adminCredentials() })).status()).toBe(200);

  const initial = await (await request.get("/api/admin/external-links")).json() as { links: Record<string, string | null> | null; version: number };
  const original = initial.links ?? { appLogin: null, trial: null, facebook: null, zalo: null, youtube: null, appStore: null, googlePlay: null };
  const changed = { ...original, youtube: `https://www.youtube.com/@iorder-kiem-thu-${Date.now()}` };

  const first = await request.put("/api/admin/external-links", { headers, data: { values: changed, expectedVersion: initial.version } });
  expect(first.status()).toBe(200);
  const firstBody = await first.json() as { version: number };
  expect(firstBody.version).toBe(initial.version + 1);

  try {
    const stale = await request.put("/api/admin/external-links", { headers, data: { values: original, expectedVersion: initial.version } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe("VERSION_CONFLICT");
    const current = await (await request.get("/api/admin/external-links")).json() as { links: typeof changed };
    expect(current.links.youtube).toBe(changed.youtube);
  } finally {
    expect((await request.put("/api/admin/external-links", { headers, data: { values: original, expectedVersion: firstBody.version } })).status()).toBe(200);
  }
});

test("Màn Liên kết ngoài lưu được hai lần liên tiếp (CMS cập nhật phiên bản sau mỗi lần lưu)", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/lien-ket-ngoai");
  const youtube = page.getByLabel("YouTube");
  const original = await youtube.inputValue();
  const save = page.getByRole("button", { name: /^Lưu/ });
  try {
    for (const suffix of ["a", "b"]) {
      await youtube.fill(`https://www.youtube.com/@iorder-kiem-thu-${suffix}`);
      await save.click();
      await expect(page.getByText("Đã cập nhật liên kết ngoài trên website.").first()).toBeVisible();
      await expect(page.getByText("Không có thay đổi chưa lưu.")).toBeVisible();
    }
  } finally {
    await page.reload();
    if (await youtube.inputValue() !== original) {
      await youtube.fill(original);
      await save.click();
      await expect(page.getByText("Đã cập nhật liên kết ngoài trên website.").first()).toBeVisible();
    }
  }
});

test("Thẻ vừa tạo lưu tiếp ngay được (không thiếu hoặc lệch phiên bản), rồi xóa", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/phan-loai-bai-viet");
  await page.getByRole("tab", { name: /^Thẻ/ }).click();
  await page.getByRole("button", { name: "Thêm thẻ" }).first().click();
  const suffix = Date.now().toString(36);
  await page.getByLabel("Tên thẻ").fill(`Thẻ kiểm thử ${suffix}`);
  await page.getByLabel("Slug").fill(`the-kiem-thu-${suffix}`);
  const save = page.getByRole("button", { name: "Lưu phân loại" });
  await save.click();
  await expect(page.getByText("Đã tạo thẻ.").first()).toBeVisible();
  try {
    // Lưu liên tiếp ngay sau khi tạo, không chờ danh sách làm mới.
    for (const round of ["a", "b"]) {
      await page.getByLabel("Tên thẻ").fill(`Thẻ kiểm thử ${suffix} ${round}`);
      await save.click();
      await expect(page.getByText("Đã lưu thay đổi.").first()).toBeVisible();
    }
  } finally {
    await page.getByRole("button", { name: "Xóa thẻ" }).click();
    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(page.getByText(`Thẻ kiểm thử ${suffix}`)).toHaveCount(0);
  }
});

test("Lưu khi người khác vừa cập nhật: hiện thanh xung đột và tải được bản mới nhất", async ({ page, request, baseURL }) => {
  const headers = { origin: baseURL!, "content-type": "application/json" };
  expect((await request.post("/api/admin/session", { headers, data: adminCredentials() })).status()).toBe(200);
  await loginAsAdmin(page);
  await page.goto("/admin/lien-ket-ngoai");
  const youtube = page.getByLabel("YouTube");
  const original = await youtube.inputValue();
  const remote = `https://www.youtube.com/@iorder-phien-khac-${Date.now()}`;

  const current = await (await request.get("/api/admin/external-links")).json() as { links: Record<string, string | null>; version: number };
  expect((await request.put("/api/admin/external-links", { headers, data: { values: { ...current.links, youtube: remote }, expectedVersion: current.version } })).status()).toBe(200);
  try {
    await youtube.fill("https://www.youtube.com/@iorder-phien-cu");
    await page.getByRole("button", { name: /^Lưu/ }).click();
    const banner = page.getByRole("alert").filter({ hasText: "Nội dung vừa được người khác cập nhật" });
    await expect(banner).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await banner.getByRole("button", { name: "Tải bản mới nhất" }).click();
    await expect(page.getByLabel("YouTube")).toHaveValue(remote);
    await expect(banner).toBeHidden();
  } finally {
    const latest = await (await request.get("/api/admin/external-links")).json() as { links: Record<string, string | null>; version: number };
    expect((await request.put("/api/admin/external-links", { headers, data: { values: { ...latest.links, youtube: original || null }, expectedVersion: latest.version } })).status()).toBe(200);
  }
});

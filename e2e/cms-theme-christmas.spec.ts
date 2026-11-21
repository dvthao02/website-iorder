import { expect, test } from "@playwright/test";

import { startCmsUxBackend } from "./fixtures/cms-ux-backend";

// Chạy riêng với CMS trỏ BACKEND_URL=http://127.0.0.1:3102, E2E_CMS_URL=http://127.0.0.1:3101 và E2E_CMS_UX_FIXTURE=1 (xem cms-ux.spec.ts).
// Backend mô phỏng: không cần tài khoản hay dữ liệu người dùng, không đọc .env, DB hay S3.
test.describe("Theme Giáng sinh trong Giao diện CMS", () => {
  test.setTimeout(90_000);
  test.skip(process.env.E2E_CMS_UX_FIXTURE !== "1", "Chỉ chạy khi bật Backend mô phỏng.");
  let stop: (() => Promise<void>) | undefined;
  test.beforeAll(async () => {
    if (process.env.E2E_CMS_URL !== "http://127.0.0.1:3101") throw new Error("Phải dùng CMS riêng tại 127.0.0.1:3101.");
    stop = await startCmsUxBackend();
  });
  test.afterAll(async () => { await stop?.(); });

  test("chọn Giáng sinh: đổi bảng màu, thêm dây đèn và mũ, ghi cookie cho trang đăng nhập; chọn bảng màu khác thì trở lại", async ({ page, context, baseURL }) => {
    await page.goto("/admin/appearance");
    const christmas = page.getByRole("button", { name: /Giáng sinh/ });
    await expect(christmas).toHaveAttribute("aria-pressed", "false");
    await christmas.click();
    await expect(christmas).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-cms-theme", "christmas");

    // Bảng màu đổi (xanh thông); khung CMS có mũ ông già Noel, vài cây thông và bông tuyết ở thanh trên, lớp tuyết rơi; KHÔNG có đèn nhấp nháy.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--cms-primary").trim())).toBe("#17724a");
    expect(await page.locator(".admin-brand").evaluate((element) => getComputedStyle(element, "::after").content)).not.toBe("none");
    await expect(page.locator(".admin-topbar__festive")).toBeVisible();
    expect(await page.locator(".admin-festive__pine:visible").count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator(".admin-festive__flake:visible").count()).toBeGreaterThanOrEqual(1);
    // Dây kim tuyến (ảnh SVG) ở mép trên thanh trên; hai nhóm đèn chớp NHẸ xen kẽ (không bật tắt dứt khoát).
    const tinsel = page.locator(".admin-topbar .xmas-tinsel--cms");
    await expect(tinsel).toBeAttached();
    const style = await tinsel.evaluate((element) => {
      const before = getComputedStyle(element, "::before");
      const after = getComputedStyle(element, "::after");
      return { image: getComputedStyle(element).backgroundImage, lightsA: before.backgroundImage, lightsB: after.backgroundImage, nameA: before.animationName, durationA: before.animationDuration, delayB: after.animationDelay };
    });
    expect(style.image).toContain("xmas-garland.svg");
    expect(style.lightsA).toContain("xmas-garland-lights-a.svg");
    expect(style.lightsB).toContain("xmas-garland-lights-b.svg");
    expect(style.nameA).toBe("xmas-light-twinkle");
    expect(style.durationA).toBe("3.8s");
    expect(style.delayB).toBe("-1.9s");
    // Lấy mẫu độ mờ một lớp đèn trong hơn một chu kỳ: có đổi (đang chớp) nhưng không bao giờ xuống dưới ~30% (chớp nhẹ).
    const samples: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      samples.push(await tinsel.evaluate((element) => Number(getComputedStyle(element, "::before").opacity)));
      await page.waitForTimeout(420);
    }
    expect(Math.max(...samples) - Math.min(...samples), samples.join(", ")).toBeGreaterThan(0.25);
    expect(Math.min(...samples), samples.join(", ")).toBeGreaterThanOrEqual(0.3);
    expect(await page.locator(".admin-festive__bulb").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("xmas-light-twinkle");
    // Chuông treo đung đưa như con lắc (xoay quanh điểm treo, biên độ nhỏ) ở hai bên cụm cây thông.
    const bells = page.locator(".admin-festive__bell:visible");
    expect(await bells.count()).toBeGreaterThanOrEqual(2);
    expect(await bells.first().evaluate((element) => getComputedStyle(element).animationName)).toBe("xmas-bell-swing");
    const angles: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      angles.push(await bells.first().evaluate((element) => { const matrix = new DOMMatrix(getComputedStyle(element).transform); return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI; }));
      await page.waitForTimeout(330);
    }
    expect(Math.max(...angles) - Math.min(...angles), angles.join(", ")).toBeGreaterThan(6);
    expect(Math.max(...angles.map(Math.abs)), angles.join(", ")).toBeLessThanOrEqual(10);
    // Thanh trên không còn pseudo-element trang trí nào (dây là phần tử riêng).
    expect(await page.locator(".admin-topbar").evaluate((element) => ["::before", "::after"].map((pseudo) => getComputedStyle(element, pseudo).content))).toEqual(["none", "none"]);
    for (const file of ["xmas-garland.svg", "xmas-garland-lights-a.svg", "xmas-garland-lights-b.svg"]) {
      const asset = await page.request.get("/brand/" + file);
      expect(asset.status(), file).toBe(200);
      expect(asset.headers()["content-type"], file).toContain("image/svg");
    }
    await expect(page.locator("canvas[data-cms-snow]")).toHaveCount(1);
    // Lớp tuyết không chặn chuột (cả trang vẫn bấm được) và có hạt được vẽ.
    await expect.poll(() => page.locator("canvas[data-cms-snow]").evaluate((canvas: HTMLCanvasElement) => {
      if (!canvas.width || !canvas.height) return false;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < data.length; index += 4) if (data[index] > 0) return true;
      return false;
    })).toBe(true);
    expect(await page.locator("canvas[data-cms-snow]").evaluate((canvas) => getComputedStyle(canvas).pointerEvents)).toBe("none");

    // Cookie cho trang đăng nhập (dựng ở server) và localStorage cho CMS.
    const cookie = (await context.cookies(baseURL!)).find((item) => item.name === "iorder-cms-color-theme");
    expect(cookie?.value).toBe("christmas");
    expect(await page.evaluate(() => window.localStorage.getItem("iorder-cms-color-theme"))).toBe("christmas");

    // Trang đăng nhập theo lựa chọn đó.
    const login = await context.newPage();
    await login.goto("/admin/login");
    await expect(login.locator(".xmas")).toHaveCount(1);
    await login.close();

    // Chọn bảng màu khác: trang trí biến mất, cookie đổi, trang đăng nhập về giao diện thường (kể cả trong mùa Giáng sinh).
    await page.getByRole("button", { name: /^iOrder Blue/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-cms-theme", "iorder");
    await expect(page.locator(".admin-topbar__festive")).toHaveCount(0);
    await expect(page.locator("canvas[data-cms-snow]")).toHaveCount(0);
    await expect(page.locator(".xmas-tinsel--cms")).toHaveCount(0);
    expect((await context.cookies(baseURL!)).find((item) => item.name === "iorder-cms-color-theme")?.value).toBe("iorder");
    const loginAgain = await context.newPage();
    await loginAgain.goto("/admin/login");
    await expect(loginAgain.getByRole("heading", { name: "Đăng nhập CMS", level: 1 })).toBeVisible();
    await expect(loginAgain.locator(".xmas")).toHaveCount(0);
    await loginAgain.close();
  });

  test("trình duyệt đã chọn bảng màu từ trước thì cookie được ghi bù khi mở CMS", async ({ page, context, baseURL }) => {
    await page.addInitScript(() => window.localStorage.setItem("iorder-cms-color-theme", "teal-mist"));
    await page.goto("/admin/appearance");
    await expect(page.locator("html")).toHaveAttribute("data-cms-theme", "teal-mist");
    await expect.poll(async () => (await context.cookies(baseURL!)).find((item) => item.name === "iorder-cms-color-theme")?.value).toBe("teal-mist");
  });

  test("giảm chuyển động: bông tuyết đứng yên và không có tuyết rơi", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.addInitScript(() => window.localStorage.setItem("iorder-cms-color-theme", "christmas"));
    await page.goto("/admin/appearance");
    await expect(page.locator("html")).toHaveAttribute("data-cms-theme", "christmas");
    await expect(page.locator(".admin-topbar__festive")).toBeVisible();
    expect(await page.locator(".admin-festive__flake").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    expect(await page.locator(".admin-festive__bulb").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    expect(await page.locator(".admin-festive__bell").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    expect(await page.locator(".xmas-tinsel--cms").evaluate((element) => ["::before", "::after"].map((pseudo) => getComputedStyle(element, pseudo).animationName))).toEqual(["none", "none"]);
    await page.waitForTimeout(500);
    const drawn = await page.locator("canvas[data-cms-snow]").evaluate((canvas: HTMLCanvasElement) => {
      if (!canvas.width || !canvas.height) return false;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < data.length; index += 4) if (data[index] > 0) return true;
      return false;
    });
    expect(drawn).toBe(false);
    await context.close();
  });
});

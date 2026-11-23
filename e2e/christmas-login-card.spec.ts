import { expect, test } from "@playwright/test";

test.describe("Thẻ đăng nhập Giáng sinh", () => {
  for (const width of [390, 768, 1440, 1920]) {
    test(`giữ cảnh cũ và form vừa màn hình ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/admin/login?theme=christmas");
      const scene = page.locator(".xmas");
      const card = scene.locator(".xmas__card");
      await expect(scene).toHaveAttribute("data-ready", "true");
      await expect(scene.locator(".xmas__santa")).toHaveCount(1);
      await expect(scene.locator(".xmas__snow")).toHaveCount(1);
      await expect(scene.locator(".xmas__tree--l1")).toBeVisible();
      await expect(card.getByRole("heading", { name: "Đăng nhập CMS" })).toBeVisible();
      await expect(card.getByLabel("Tên đăng nhập")).toBeVisible();
      await expect(card.getByLabel("Mật khẩu", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const box = await card.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await card.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
    });
  }

  for (const width of [768, 1440, 1920]) {
    test(`Nhà thờ Đức Bà: hai tháp đối xứng hai bên thẻ, không che form ở ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/admin/login?theme=christmas");
      const scene = page.locator(".xmas");
      await expect(scene).toHaveAttribute("data-ready", "true");
      const left = scene.locator(".xmas__tower--l");
      const right = scene.locator(".xmas__tower--r");
      await expect(left).toBeVisible();
      await expect(right).toBeVisible();
      await expect(scene.locator(".xmas__nave")).toBeVisible();
      // Đèn chỉ gắn trên hai tháp (34 bóng mỗi tháp); mặt tiền nằm sau kính mờ nên không có đèn.
      expect(await scene.locator(".xmas__tower .xmas-lamp").count()).toBeGreaterThan(60);
      expect(await scene.locator(".xmas__nave .xmas-lamp").count()).toBe(0);
      const [leftBox, rightBox, cardBox, naveBox] = await Promise.all([left.boundingBox(), right.boundingBox(), scene.locator(".xmas__card").boundingBox(), scene.locator(".xmas__nave").boundingBox()]);
      // Thẻ nằm đúng tâm màn hình (từng lệch 18px vì hộp bao co theo nội dung).
      expect(Math.abs(cardBox!.x + cardBox!.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      // Hai tháp sát hai mép thẻ, không đè lên thẻ và không hở khe.
      expect(Math.abs(leftBox!.x + leftBox!.width - cardBox!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(rightBox!.x - (cardBox!.x + cardBox!.width))).toBeLessThanOrEqual(1);
      // Cân đối: mép ngoài hai tháp cách tâm màn hình bằng nhau; mặt tiền phủ hết bề ngang thẻ.
      expect(Math.abs(width / 2 - leftBox!.x - (rightBox!.x + rightBox!.width - width / 2))).toBeLessThanOrEqual(1);
      expect(naveBox!.x).toBeLessThanOrEqual(cardBox!.x);
      expect(naveBox!.x + naveBox!.width).toBeGreaterThanOrEqual(cardBox!.x + cardBox!.width);
      expect(leftBox!.x).toBeGreaterThanOrEqual(0);
      expect(rightBox!.x + rightBox!.width).toBeLessThanOrEqual(width);
      // Dây đèn võng: hai đầu buộc đúng tâm hai chóp tháp, đáy dây (bóng giữa) nằm trên mép thẻ nên không đè lên form.
      const swag = scene.locator(".xmas__swag-lamp");
      await expect(swag).toHaveCount(17);
      const [firstLamp, middleLamp, lastLamp] = await Promise.all([swag.first().boundingBox(), swag.nth(8).boundingBox(), swag.last().boundingBox()]);
      expect(Math.abs(firstLamp!.x + firstLamp!.width / 2 - (leftBox!.x + leftBox!.width / 2))).toBeLessThanOrEqual(1.5);
      expect(Math.abs(lastLamp!.x + lastLamp!.width / 2 - (rightBox!.x + rightBox!.width / 2))).toBeLessThanOrEqual(1.5);
      expect(middleLamp!.y + middleLamp!.height).toBeLessThanOrEqual(cardBox!.y);
    });
  }

  test("cột băng ô mật khẩu phủ trọn ô, lùi sau nhãn khi nhãn nổi", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/login?theme=christmas");
    await expect(page.locator(".xmas")).toHaveAttribute("data-ready", "true");
    const password = page.getByLabel("Mật khẩu", { exact: true });
    const ice = () => password.evaluate(element => {
      const box = element.closest(".admin-password-input")!;
      const style = getComputedStyle(box, "::before");
      return { boxWidth: box.getBoundingClientRect().width, left: parseFloat(style.left), width: parseFloat(style.width) };
    });
    // Ô trống và chưa focus (tên đăng nhập đang giữ focus): nhãn nằm trong ô nên băng chạy từ mép trái đến mép phải (chừa 10px cho góc bo).
    await page.locator("#login-username").focus();
    const empty = await ice();
    expect(empty.left).toBe(10);
    expect(empty.width).toBeGreaterThanOrEqual(empty.boxWidth - 24);
    // Nhãn nổi lên mép trên khi focus: băng bắt đầu sau nhãn để không đè chữ.
    await password.focus();
    const floated = await ice();
    expect(floated.left).toBe(76);
    // Hàng măng băng mọc lên từ mép dưới: phủ trọn bề ngang (không có nhãn nên không phải né), tan cùng hàng trên khi bấm con mắt hiện mật khẩu.
    const bottomRow = () => password.evaluate(element => {
      const field = element.closest(".admin-field")!;
      const style = getComputedStyle(field, "::after");
      return { fieldWidth: field.getBoundingClientRect().width, opacity: Number(style.opacity), width: parseFloat(style.width) };
    });
    const frozen = await bottomRow();
    expect(frozen.opacity).toBe(1);
    expect(frozen.width).toBeGreaterThanOrEqual(frozen.fieldWidth - 24);
    await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
    await expect.poll(async () => (await bottomRow()).opacity).toBe(0);
  });

  test("thẻ đăng nhập trong suốt dạng kính mờ", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/login?theme=christmas");
    const card = page.locator(".xmas .xmas__card");
    await expect(page.locator(".xmas")).toHaveAttribute("data-ready", "true");
    const glass = await card.evaluate(element => {
      const style = getComputedStyle(element);
      return { backdrop: style.backdropFilter, alpha: Number(style.backgroundColor.match(/[\d.]+(?=\)$)/)?.[0] ?? 1), heading: getComputedStyle(element.querySelector("h1")!).color };
    });
    expect(glass.backdrop).toContain("blur");
    expect(glass.alpha).toBeLessThanOrEqual(0.4);
    expect(glass.heading).toBe("rgb(255, 255, 255)");
    // Viền sọc kẹo cây: ::before phủ cả chu vi thẻ (trừ viền 1px), khoét giữa bằng mask và đứng yên.
    const ring = await card.evaluate(element => {
      const style = getComputedStyle(element, "::before");
      const box = element.getBoundingClientRect();
      return { animation: style.animationName, height: parseFloat(style.height), heightDelta: box.height - 2, mask: style.maskComposite, width: parseFloat(style.width), widthDelta: box.width - 2 };
    });
    expect(Math.abs(ring.height - ring.heightDelta)).toBeLessThanOrEqual(1);
    expect(Math.abs(ring.width - ring.widthDelta)).toBeLessThanOrEqual(1);
    expect(ring.mask).toContain("exclude");
    expect(ring.animation).toBe("none");
  });

  test("điện thoại: ẩn tháp và mặt tiền, không tràn ngang", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin/login?theme=christmas");
    await expect(page.locator(".xmas")).toHaveAttribute("data-ready", "true");
    await expect(page.locator(".xmas__tower--l")).toBeHidden();
    await expect(page.locator(".xmas__tower--r")).toBeHidden();
    await expect(page.locator(".xmas__nave")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("đăng nhập sai: thẻ hiện vầng đỏ", async ({ page }) => {
    await page.goto("/admin/login?theme=christmas");
    await expect(page.locator(".xmas")).toHaveAttribute("data-ready", "true");
    // Lớp .xmas--alert chỉ tồn tại ~0,9 giây nên không thể dò bằng polling: phát sự kiện thất bại rồi đọc style ngay trong cùng một lượt.
    // CSS thẻ mới từng đè mất vầng đỏ này (xem christmas-card.css). Tên sự kiện: loginFailureEvent ở apps/admin/src/lib/login-events.ts.
    const shadows = await page.evaluate(() => {
      const card = document.querySelector(".xmas__card")!;
      const normal = getComputedStyle(card).boxShadow;
      window.dispatchEvent(new CustomEvent("cms:login-failure"));
      return { normal, alert: getComputedStyle(card).boxShadow };
    });
    expect(shadows.normal).not.toContain("255, 60, 70");
    expect(shadows.alert).toContain("255, 60, 70");
  });

  test("mật khẩu và lỗi đăng nhập vẫn hoạt động", async ({ page }) => {
    await page.route("**/api/v1/admin/session", route => route.fulfill({ status: 401, json: { error: { code: "INVALID_CREDENTIALS", message: "Thông tin đăng nhập không chính xác." } } }));
    await page.goto("/admin/login?theme=christmas");
    await expect(page.locator(".xmas")).toHaveAttribute("data-ready", "true");
    const user = page.getByLabel("Tên đăng nhập");
    const password = page.getByLabel("Mật khẩu", { exact: true });
    await user.fill("demo");
    await password.fill("demo-password");
    await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.locator('.admin-toast[role="alert"]')).toContainText("Thông tin đăng nhập không chính xác.");
    await expect(user).toHaveValue("demo");
    await expect(password).toHaveValue("demo-password");
  });
});

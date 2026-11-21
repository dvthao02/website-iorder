import { expect, test } from "@playwright/test";

// Không đăng nhập: chỉ xem trang đăng nhập công khai, nên chạy được với mọi dữ liệu và không tính vào giới hạn thử mật khẩu.
// Mở trang và chờ khung cảnh gắn xong trình nghe (dấu data-ready đặt sau hydrate); tương tác trước lúc đó sẽ không có ai nghe.
async function openChristmasLogin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login?theme=christmas");
  await expect(page.getByRole("heading", { name: "Đăng nhập CMS", level: 1 })).toBeVisible();
  await expect(page.locator('.xmas[data-ready="true"]')).toBeAttached();
}

test.describe("Trang đăng nhập mùa Giáng sinh", () => {
  test("có cảnh động nhưng form vẫn dùng được và cảnh không bắt chuột", async ({ page }) => {
    await openChristmasLogin(page);
    await expect(page.locator('input[name="username"]')).toBeFocused();
    await expect(page.locator('button[type="submit"]')).toHaveCount(1);
    await expect(page.locator(".xmas__scenery")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".xmas__snow")).toHaveAttribute("aria-hidden", "true");

    // Cảnh trang trí nằm dưới thẻ và không nhận chuột: bấm vào ô mật khẩu phải trúng ô mật khẩu.
    const password = page.getByLabel("Mật khẩu", { exact: true });
    await password.click();
    await expect(password).toBeFocused();
    await password.fill("khong-gui-di");
    await page.getByRole("button", { name: "Hiện mật khẩu" }).click();
    await expect(password).toHaveAttribute("type", "text");

    // Các hiệu ứng chính đang chạy: ông già Noel bay, đèn chớp, viền kẹo gậy chạy.
    // Chỉ một phần ba số sao nhấp nháy (cho nhẹ máy), còn lại đứng yên.
    for (const selector of [".xmas__santa", ".xmas-bulb", ".xmas__star:nth-child(3n)", ".xmas-leg"]) {
      expect(await page.locator(selector).first().evaluate((element) => getComputedStyle(element).animationName), selector).not.toBe("none");
    }
    expect(await page.locator(".xmas__card").evaluate((element) => getComputedStyle(element, "::before").animationName)).not.toBe("none");

    // Dây kim tuyến (ảnh SVG, đèn đứng yên) thay dây đèn màu nhấp nháy ở đỉnh trang.
    expect(await page.locator(".xmas__garland").evaluate((element) => ({ image: getComputedStyle(element).backgroundImage, children: element.children.length, lightsA: getComputedStyle(element, "::before").animationName, lightsB: getComputedStyle(element, "::after").animationName }))).toEqual({ image: expect.stringContaining("xmas-garland.svg"), children: 0, lightsA: "xmas-light-twinkle", lightsB: "xmas-light-twinkle" });
    // Đèn trên dây chớp nhẹ: độ mờ đổi nhưng không xuống dưới ~30%.
    const garlandSamples: number[] = [];
    for (let index = 0; index < 9; index += 1) {
      garlandSamples.push(await page.locator(".xmas__garland").evaluate((element) => Number(getComputedStyle(element, "::before").opacity)));
      await page.waitForTimeout(500);
    }
    expect(Math.max(...garlandSamples) - Math.min(...garlandSamples), garlandSamples.join(", ")).toBeGreaterThan(0.2);
    expect(Math.min(...garlandSamples), garlandSamples.join(", ")).toBeGreaterThanOrEqual(0.3);
    for (const file of ["xmas-garland.svg", "xmas-garland-lights-a.svg", "xmas-garland-lights-b.svg"]) expect((await page.request.get("/brand/" + file)).status(), file).toBe(200);

    // Chuông treo lủng lẳng ở đáy các nhịp võng của dây: đung đưa như con lắc (biên độ nhỏ), nằm trong khung hình.
    const bells = page.locator(".xmas__bell");
    expect(await bells.count()).toBe(8);
    const placed = await bells.evaluateAll((elements) => elements.filter((element) => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= window.innerWidth; }).length);
    expect(placed).toBeGreaterThanOrEqual(3);
    expect(await bells.first().evaluate((element) => getComputedStyle(element).animationName)).toBe("xmas-bell-swing");
    const bellAngles: number[] = [];
    for (let index = 0; index < 8; index += 1) {
      bellAngles.push(await bells.first().evaluate((element) => { const matrix = new DOMMatrix(getComputedStyle(element).transform); return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI; }));
      await page.waitForTimeout(450);
    }
    expect(Math.max(...bellAngles) - Math.min(...bellAngles), bellAngles.join(", ")).toBeGreaterThan(6);
    expect(Math.max(...bellAngles.map(Math.abs)), bellAngles.join(", ")).toBeLessThanOrEqual(10);

    // Cảnh dịch theo con trỏ (thị sai): di chuột sang phải thì --px dương.
    await page.mouse.move(page.viewportSize()!.width - 10, 120);
    await expect.poll(() => page.locator(".xmas").evaluate((element) => Number(element.style.getPropertyValue("--px")))).toBeGreaterThan(0.5);

    // Tuyết đã được vẽ lên canvas.
    const drawn = await page.locator(".xmas__snow").evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < data.length; index += 4) if (data[index] > 0) return true;
      return false;
    });
    expect(drawn).toBe(true);
  });

  test("giảm chuyển động: cảnh đứng yên, không còn hiệu ứng lặp", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
    const page = await context.newPage();
    await openChristmasLogin(page);
    for (const selector of [".xmas__santa", ".xmas-bulb", ".xmas__star", ".xmas__card", ".xmas__bell"]) {
      expect(await page.locator(selector).first().evaluate((element) => getComputedStyle(element).animationName), selector).toBe("none");
    }
    // Xe đứng yên với dải băng còn lọt trong màn hình, không thả giỏ quà (không có hoạt ảnh thì giỏ sẽ đứng chình ình dưới xe).
    for (const drop of await page.locator(".xmas__drop").all()) expect(await drop.evaluate((element) => getComputedStyle(element).display)).toBe("none");
    const still = await page.locator(".xmas__banner").boundingBox();
    expect(still!.x).toBeGreaterThanOrEqual(0);
    expect(still!.x + still!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    // Không chờ, không pháo hoa, không rải tuyết theo chuột; chuyển trang ngay khi đăng nhập thành công.
    const delay = await page.evaluate(() => {
      const detail = { delayMs: 0 };
      window.dispatchEvent(new CustomEvent("cms:login-success", { detail }));
      return detail.delayMs;
    });
    expect(delay).toBe(0);
    await expect(page.locator(".xmas")).not.toHaveClass(/xmas--success/);
    await page.mouse.move(100, 300);
    for (let step = 1; step <= 20; step += 1) await page.mouse.move(100 + step * 15, 300 + step * 4, { steps: 2 });
    await page.mouse.click(80, 330);
    await page.waitForTimeout(300);
    const drawn = await page.locator(".xmas__fx").evaluate((canvas: HTMLCanvasElement) => {
      if (!canvas.width || !canvas.height) return false;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < data.length; index += 4) if (data[index] > 0) return true;
      return false;
    });
    expect(drawn).toBe(false);
    await context.close();
  });

  test("điện thoại 390px không tràn ngang và thẻ vẫn nằm trọn màn hình", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openChristmasLogin(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const card = (await page.locator(".xmas__card").boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(390);
  });

  // Canvas pháo hoa/tuyết con trỏ có hạt nào đang được vẽ không.
  const fxHasPixels = (page: import("@playwright/test").Page) => page.locator(".xmas__fx").evaluate((canvas: HTMLCanvasElement) => {
    if (!canvas.width || !canvas.height) return false;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < data.length; index += 4) if (data[index] > 0) return true;
    return false;
  });

  test("bấm vào nền bắn pháo hoa", async ({ page }) => {
    await openChristmasLogin(page);
    expect(await fxHasPixels(page)).toBe(false);
    await page.mouse.click(80, 330);
    await expect.poll(() => fxHasPixels(page)).toBe(true);
  });

  test("kéo chuột tới đâu tuyết rơi tới đó (cả khi đi qua thẻ đăng nhập)", async ({ page }) => {
    await openChristmasLogin(page);
    expect(await fxHasPixels(page)).toBe(false);
    const card = (await page.locator(".xmas__card").boundingBox())!;
    await page.mouse.move(card.x + 20, card.y + 120);
    for (let step = 1; step <= 24; step += 1) await page.mouse.move(card.x + 20 + step * 12, card.y + 120 + step * 4, { steps: 2 });
    await expect.poll(() => fxHasPixels(page)).toBe(true);
  });

  test("ông già Noel bay sát mép trên, nằm trên dây đèn, chuông và cả thẻ (kể cả khi zoom to); không chặn form nhưng bấm trúng thì nói Ho ho ho", async ({ page }) => {
    await openChristmasLogin(page);
    const seekSanta = async (milliseconds: number) => {
      await page.evaluate((time) => {
        for (const animation of document.getAnimations()) {
          // Tua cả chuyến bay lẫn các giỏ quà (độ trễ âm đã tính trong currentTime của từng hoạt ảnh) về cùng một thời điểm của chu kỳ 30s.
          const name = (animation as CSSAnimation).animationName;
          if (name === "xmas-fly" || name === "xmas-drop") { animation.pause(); animation.currentTime = time; }
        }
      }, milliseconds);
      await page.waitForTimeout(150);
    };
    const geometry = () => page.evaluate(() => {
      const santa = document.querySelector<HTMLElement>(".xmas__santa")!.getBoundingClientRect();
      const z = (selector: string) => Number(getComputedStyle(document.querySelector(selector)!).zIndex);
      return {
        left: santa.left, top: santa.top, width: santa.width, height: santa.height,
        viewportWidth: innerWidth, viewportHeight: innerHeight,
        flight: z(".xmas__flight"), garland: z(".xmas__garland"), bells: z(".xmas__bells"), snow: z(".xmas__snow"), card: z(".xmas__center"), effects: z(".xmas__fx"),
        pointerEvents: getComputedStyle(document.querySelector(".xmas__santa")!).pointerEvents,
      };
    });

    // Lớp của ông nằm trên mọi thứ trang trí và trên thẻ, dưới canvas hiệu ứng.
    await seekSanta(9500);
    const wide = await geometry();
    expect(wide.flight).toBeGreaterThan(Math.max(wide.garland, wide.bells, wide.snow, wide.card));
    expect(wide.flight).toBeLessThan(wide.effects);
    // Bay sát mép trên (trong 1/5 chiều cao đầu), đang ở trong khung hình và đủ to.
    expect(wide.top).toBeLessThan(wide.viewportHeight * 0.2);
    expect(wide.left).toBeGreaterThan(0);
    expect(wide.left + wide.width).toBeLessThan(wide.viewportWidth);
    expect(wide.width).toBeGreaterThanOrEqual(260);
    // Không nhận chuột: bấm vào ô tên đăng nhập ngay dưới đường bay của ông vẫn trúng ô đó.
    expect(wide.pointerEvents).toBe("none");

    // Dải băng "Merry Christmas" kéo phía sau xe (nằm bên trái xe, chữ vừa trong dải), và ông thả giỏ quà dù xuống dưới.
    const banner = page.locator(".xmas__banner");
    const slices = banner.locator(".xmas__banner-slice");
    expect(await slices.count()).toBeGreaterThanOrEqual(10);
    // Chữ nằm trong data-text (vẽ bằng ::before) nên trang không có chữ thừa; vừa trong dải băng.
    await expect(banner.locator(".xmas__banner-face").first()).toHaveAttribute("data-text", "Merry Christmas");
    await expect(page.getByText("Merry Christmas")).toHaveCount(0);
    const bannerBox = await banner.boundingBox();
    const santaBox = await page.locator(".xmas__santa").boundingBox();
    expect(bannerBox!.x + bannerBox!.width).toBeLessThanOrEqual(santaBox!.x + santaBox!.width * 0.1);
    expect(bannerBox!.width).toBeGreaterThan(santaBox!.width * 0.5);
    expect(await banner.locator(".xmas__banner-face").first().evaluate((face) => {
      const style = getComputedStyle(face, "::before");
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = face.getAttribute("data-text")!;
      return context.measureText(text).width + (parseFloat(style.letterSpacing) || 0) * text.length <= face.clientWidth * 0.92;
    })).toBe(true);
    // Vải lượn sóng thật: đầu buộc (lát cuối) đứng yên, đuôi (lát đầu) bay nhiều nhất và đổi chiều theo thời gian; sóng không phải một tấm cứng.
    const offsets = () => slices.evaluateAll((elements) => elements.map((element) => new DOMMatrix(getComputedStyle(element).transform).m42));
    const amplitudes = await slices.evaluateAll((elements) => elements.map((element) => Number(getComputedStyle(element).getPropertyValue("--amp"))));
    expect(amplitudes[0]).toBeCloseTo(1, 1);
    expect(amplitudes[amplitudes.length - 1]).toBeCloseTo(0, 2);
    expect(amplitudes).toEqual([...amplitudes].sort((first, second) => second - first));
    const swing: number[] = [];
    for (let step = 0; step < 6; step += 1) {
      const sample = await offsets();
      expect(Math.abs(sample[sample.length - 1])).toBeLessThan(1);
      swing.push(sample[0]);
      await page.waitForTimeout(260);
    }
    expect(Math.max(...swing) - Math.min(...swing)).toBeGreaterThan(8);
    expect(new Set((await offsets()).map((value) => Math.round(value))).size).toBeGreaterThan(4);
    await expect(page.locator(".xmas__drop")).toHaveCount(3);
    const starts = await page.locator(".xmas__drop").evaluateAll((drops) => drops.map((drop) => getComputedStyle(drop).getPropertyValue("--at")));
    expect(new Set(starts).size).toBe(3);
    const dropAt = async (time: number) => {
      await seekSanta(time);
      return page.evaluate(() => {
        const santa = document.querySelector(".xmas__santa")!.getBoundingClientRect();
        const falling = [...document.querySelectorAll(".xmas__drop")].map((drop) => ({ box: drop.getBoundingClientRect(), opacity: Number(getComputedStyle(drop).opacity) })).filter((drop) => drop.opacity > 0.5);
        return { santaBottom: santa.bottom, viewportHeight: innerHeight, falling: falling.map((drop) => ({ top: drop.box.top, bottom: drop.box.bottom })) };
      });
    };
    const early = await dropAt(5600);
    expect(early.falling.length).toBeGreaterThanOrEqual(1);
    const late = await dropAt(8400);
    expect(late.falling.length).toBeGreaterThanOrEqual(1);
    // Rơi xuống dưới xe và hạ cánh trong màn hình (trên đồi tuyết), không văng ra ngoài đáy.
    expect(Math.max(...late.falling.map((drop) => drop.top))).toBeGreaterThan(late.santaBottom);
    const landing = await dropAt(8590);
    for (const drop of landing.falling) expect(drop.bottom).toBeLessThanOrEqual(landing.viewportHeight);
    await seekSanta(9500);

    // Bấm vào khung ông (chỗ nằm ngoài thẻ: cú bấm trong thẻ luôn thuộc về thẻ) thì ông nói "Ho ho ho!" chứ không bắn pháo hoa.
    const cardTop = (await page.locator(".xmas__card").boundingBox())!.y;
    const clickY = wide.top + wide.height * 0.25;
    expect(clickY).toBeLessThan(cardTop);
    await page.mouse.click(wide.left + wide.width * 0.5, clickY);
    await expect(page.locator(".xmas__santa")).toHaveClass(/is-poked/);

    // Zoom to (khung nhìn hẹp): thẻ lên sát mép trên, ông vẫn phải hiện trọn trên thẻ chứ không chui xuống dưới.
    await page.setViewportSize({ width: 620, height: 520 });
    await seekSanta(8500);
    const narrow = await geometry();
    const card = await page.locator(".xmas__card").boundingBox();
    expect(narrow.flight).toBeGreaterThan(narrow.card);
    expect(narrow.top).toBeLessThan(card!.y + 40);
    expect(narrow.left + narrow.width).toBeGreaterThan(card!.x);
    // Dù ông đang bay ngang trên thẻ, ô nhập dưới thẻ vẫn bấm được.
    await page.getByLabel("Mật khẩu", { exact: true }).click();
    await expect(page.getByLabel("Mật khẩu", { exact: true })).toBeFocused();
  });

  test("bấm người tuyết thì nhảy; bấm hộp quà thì bung pháo giấy", async ({ page }) => {
    await openChristmasLogin(page);
    await page.locator(".xmas__snowman").click();
    await expect(page.locator(".xmas__snowman")).toHaveClass(/is-poked/);
    await page.locator(".xmas__gifts").click();
    await expect(page.locator(".xmas__gifts")).toHaveClass(/is-poked/);
    await expect.poll(() => fxHasPixels(page)).toBe(true);
  });

  test("đăng nhập thất bại thì thẻ rung và đèn đỏ; thành công thì xin thêm một nhịp để chiếu pháo hoa", async ({ page }) => {
    await openChristmasLogin(page);
    // Giả lập sự kiện mà LoginForm phát ra (không gửi mật khẩu thật nên không tính vào giới hạn thử).
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("cms:login-failure")));
    await expect(page.locator(".xmas")).toHaveClass(/xmas--alert/);
    await expect(page.locator(".xmas")).not.toHaveClass(/xmas--alert/, { timeout: 3000 });

    const delay = await page.evaluate(() => {
      const detail = { delayMs: 0 };
      window.dispatchEvent(new CustomEvent("cms:login-success", { detail }));
      return detail.delayMs;
    });
    expect(delay).toBeGreaterThan(500);
    expect(delay).toBeLessThan(2000);
    await expect(page.locator(".xmas")).toHaveClass(/xmas--success/);
    await expect.poll(() => fxHasPixels(page)).toBe(true);
  });

  test("nền chỉ dịch nhẹ theo chuột, không rung (biên độ nhỏ, đổi mượt)", async ({ page }) => {
    await openChristmasLogin(page);
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width - 2, height - 2);
    await expect.poll(() => page.locator(".xmas").evaluate((element) => Number(element.style.getPropertyValue("--px")))).toBeGreaterThan(0.9);
    const shifts = await page.locator(".xmas__layer").evaluateAll((layers) => layers.map((layer) => { const matrix = new DOMMatrix(getComputedStyle(layer).transform); return [Math.abs(matrix.m41), Math.abs(matrix.m42)]; }));
    for (const [x, y] of shifts) {
      expect(x).toBeLessThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(7);
    }
    // Không dùng transition CSS cho lớp nền (nội suy từng khung hình trong JS), tránh giật khi chuột nhúc nhích liên tục.
    expect(await page.locator(".xmas__layer").first().evaluate((layer) => getComputedStyle(layer).transitionDuration)).toBe("0s");
  });

  test("theo bảng màu đã chọn ở Giao diện CMS (cookie): Giáng sinh thì bật, bảng màu khác thì trang thường kể cả trong mùa", async ({ browser, baseURL }) => {
    const cookieName = "iorder-cms-color-theme";
    for (const [value, expectScene] of [["christmas", true], ["dark", false], ["iorder", false]] as const) {
      const context = await browser.newContext({ baseURL });
      await context.addCookies([{ name: cookieName, value, url: baseURL! }]);
      const page = await context.newPage();
      await page.goto("/admin/login");
      await expect(page.getByRole("heading", { name: "Đăng nhập CMS", level: 1 })).toBeVisible();
      await expect(page.locator(".xmas"), `cookie ${value}`).toHaveCount(expectScene ? 1 : 0);
      await context.close();
    }
  });

  test("nhãn làm placeholder, gõ hoặc bấm vào thì nổi lên mép khung (viền khuyết, không có nền che)", async ({ page }) => {
    await openChristmasLogin(page);
    const geometry = (key: "username" | "password") => page.evaluate((field) => {
      const input = document.querySelector<HTMLInputElement>(field === "username" ? "#login-username" : "#login-password")!;
      const wrapper = input.closest(".admin-field")!;
      const label = wrapper.querySelector<HTMLElement>(".admin-field__label")!;
      const legend = wrapper.querySelector<HTMLElement>(".admin-field__frame > legend")!;
      const box = input.getBoundingClientRect();
      const labelBox = label.getBoundingClientRect();
      const style = getComputedStyle(label);
      return {
        labelCenter: labelBox.top + labelBox.height / 2 - box.top,
        inputHeight: box.height,
        notch: legend.getBoundingClientRect().width,
        labelWidth: labelBox.width,
        background: `${style.backgroundColor} ${style.backgroundImage}`,
      };
    }, key);

    // Ô tên đăng nhập đang được focus: nhãn đã nổi lên đúng mép trên của khung, viền khuyết rộng bằng chữ, nhãn không có nền.
    await expect.poll(async () => (await geometry("username")).labelCenter).toBeLessThan(3);
    const floated = await geometry("username");
    expect(floated.notch).toBeGreaterThan(floated.labelWidth);
    expect(floated.notch - floated.labelWidth).toBeLessThan(14);
    expect(floated.background).toBe("rgba(0, 0, 0, 0) none");

    // Ô mật khẩu còn trống, chưa focus: nhãn nằm giữa ô như placeholder và viền liền nét.
    const empty = await geometry("password");
    expect(Math.abs(empty.labelCenter - empty.inputHeight / 2)).toBeLessThan(2);
    expect(empty.notch).toBeLessThan(1);
    // Cao 42px (đo qua getBoundingClientRect nên lệch chút xíu khi thẻ còn đang phóng nhẹ lúc xuất hiện).
    expect(Math.abs(empty.inputHeight - 42)).toBeLessThan(0.5);

    // Gõ chữ rồi rời ô: nhãn vẫn ở trên khung.
    await page.getByLabel("Mật khẩu", { exact: true }).fill("abc");
    await page.locator(".xmas__card h1").click();
    await expect.poll(async () => (await geometry("password")).labelCenter).toBeLessThan(3);

    // Xóa hết chữ rồi rời ô: nhãn trở về trong ô.
    await page.getByLabel("Mật khẩu", { exact: true }).fill("");
    await page.locator(".xmas__card h1").click();
    await expect.poll(async () => Math.abs((await geometry("password")).labelCenter - 21)).toBeLessThan(2);
    await expect.poll(async () => (await geometry("password")).notch).toBeLessThan(1);
  });

  test("mật khẩu đang ẩn thì đóng băng (khung, con mắt, cột băng); hiện mật khẩu thì băng tan, ẩn lại thì đóng băng", async ({ page }) => {
    await openChristmasLogin(page);
    const toggle = page.locator(".admin-password-input__toggle");
    const password = page.getByLabel("Mật khẩu", { exact: true });
    const icicles = () => page.locator(".admin-password-input").evaluate((wrapper) => Number(getComputedStyle(wrapper, "::before").opacity));
    const frame = () => page.locator("#login-password").evaluate((input) => getComputedStyle(input.closest(".admin-field")!.querySelector(".admin-field__frame")!).borderTopColor);

    // Con mắt nằm trong khung của ô mật khẩu nên bấm vào nó là đang focus ô (viền đỏ); rời ô rồi mới đo màu viền "nghỉ".
    const leaveField = () => page.locator(".xmas__card h1").click();

    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(password).toHaveAttribute("type", "password");
    expect(await icicles()).toBe(1);
    const frozenFrame = await frame();
    expect(frozenFrame).toBe("rgb(159, 200, 247)");
    // Con mắt là khối băng có cột băng rủ ở đáy.
    expect(await toggle.evaluate((button) => getComputedStyle(button, "::after").backgroundImage)).toContain("xmas-icicles.svg");

    await toggle.click();
    // Băng vỡ tung: đang có hoạt ảnh mảnh vỡ ngay sau khi bấm.
    expect(await page.evaluate(() => document.getAnimations().some((animation) => (animation as CSSAnimation).animationName === "xmas-ice-shatter"))).toBe(true);
    await expect(password).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(icicles).toBeLessThan(0.05);
    await leaveField();
    await expect.poll(frame).not.toBe(frozenFrame);

    await toggle.click();
    await expect(password).toHaveAttribute("type", "password");
    await expect.poll(icicles).toBe(1);
    await leaveField();
    await expect.poll(frame).toBe(frozenFrame);

    // Con mắt vẫn bấm được bằng bàn phím và có tên cho trình đọc màn hình.
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await expect(toggle).toHaveAccessibleName("Ẩn mật khẩu");
  });

  test("giảm chuyển động: băng đổi trạng thái tức thì và không để lại mảnh vỡ", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, reducedMotion: "reduce" });
    const page = await context.newPage();
    await openChristmasLogin(page);
    await page.locator(".admin-password-input__toggle").click();
    await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute("type", "text");
    const shards = await page.locator(".admin-password-input").evaluate((wrapper) => getComputedStyle(wrapper, "::after").display);
    expect(shards).toBe("none");
    expect(await page.locator(".admin-password-input").evaluate((wrapper) => Number(getComputedStyle(wrapper, "::before").opacity))).toBe(0);
    await context.close();
  });

  test("?theme=default quay về giao diện thường", async ({ page }) => {
    await page.goto("/admin/login?theme=default");
    await expect(page.getByRole("heading", { name: "Đăng nhập CMS", level: 1 })).toBeVisible();
    await expect(page.locator(".xmas")).toHaveCount(0);
    await expect(page.locator('button[type="submit"]')).toHaveCount(1);
    // Giao diện thường: nhãn nằm trên ô như cũ, không có khung khuyết và không có băng.
    await expect(page.getByLabel("Tên đăng nhập")).toBeVisible();
    expect(await page.locator(".admin-field__frame").first().evaluate((element) => getComputedStyle(element).display)).toBe("none");
    expect(await page.locator(".admin-field__label").first().evaluate((element) => getComputedStyle(element).position)).toBe("static");
    expect(await page.locator(".admin-password-input").evaluate((wrapper) => getComputedStyle(wrapper, "::before").content)).toBe("none");
  });
});

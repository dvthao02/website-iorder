import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { cmsColorThemeIds, cmsThemeBootScript, colorThemeCookie, colorThemeStorageKey, isCmsColorThemeId, isCmsColorThemePreference, legacyThemeStorageKey, resolveColorTheme, systemColorTheme } from "./cms-theme";

// Test chạy từ thư mục gốc của repo (pnpm test).
const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

test("Danh sách bảng màu không trùng, có Giáng sinh và chế độ tối, nhận biết đúng id", () => {
  assert.equal(new Set(cmsColorThemeIds).size, cmsColorThemeIds.length);
  for (const id of ["iorder", "dark", "christmas"]) assert.ok(isCmsColorThemeId(id), id);
  for (const value of ["", "Christmas", "halloween", null, undefined]) assert.equal(isCmsColorThemeId(value), false, String(value));
  assert.equal(colorThemeCookie, "iorder-cms-color-theme");
});

test("Mọi bảng màu đều có token màu và có mặt trong màn hình chọn (thêm theme mà quên một chỗ sẽ bị bắt ở đây)", () => {
  const tokens = read("apps/admin/src/styles/tokens.css");
  const settings = read("apps/admin/src/components/admin/admin-theme-settings.tsx");
  for (const id of cmsColorThemeIds) {
    // "iorder" là bảng màu mặc định, nằm ở :root nên không có khối riêng.
    if (id !== "iorder") assert.ok(tokens.includes(`html[data-cms-theme="${id}"]`), `thiếu token màu cho ${id}`);
    assert.ok(settings.includes(`id: "${id}"`), `${id} chưa có trong danh sách chọn ở Giao diện CMS`);
  }
});

test("Mỗi bảng màu có nhận diện riêng ngoài màu nhấn (thanh bên, bo góc, đổ bóng...), thanh bên tối dùng logo chữ sáng", () => {
  const tokens = read("apps/admin/src/styles/tokens.css");
  const shell = read("apps/admin/src/styles/shell.css");
  const settings = read("apps/admin/src/components/admin/admin-theme-settings.tsx");
  const block = (id: string) => tokens.match(new RegExp('html\\[data-cms-theme="' + id + '"\\] \\{([\\s\\S]*?)\\n\\}'))?.[1] ?? "";

  // Token nhận diện có giá trị mặc định ở :root để theme nào không ghi đè vẫn đúng giao diện cổ điển.
  for (const token of ["--cms-nav-bg", "--cms-nav-text", "--cms-nav-active-bg", "--cms-nav-radius", "--cms-topbar-accent", "--cms-primary-fill", "--cms-shadow-card", "--cms-heading-font"]) {
    assert.ok(tokens.slice(0, tokens.indexOf('html[data-cms-theme="teal-mist"]')).includes(token + ":"), "thiếu mặc định " + token);
  }

  // Mọi theme (trừ mặc định, tối và Giáng sinh) phải khác biệt ít nhất ở 3 trong số: thanh bên, bo góc, đổ bóng, nút chuyển sắc, đường nhấn, nền, font tiêu đề.
  const traits = ["--cms-nav-bg", "--cms-radius-card", "--cms-shadow-card", "--cms-primary-fill", "--cms-topbar-accent", "--cms-background-image", "--cms-heading-font", "--cms-nav-radius"];
  for (const id of cmsColorThemeIds.filter((themeId) => !["iorder", "dark", "christmas"].includes(themeId))) {
    const body = block(id);
    assert.ok(body.length > 0, "không đọc được khối theme " + id);
    assert.ok(traits.filter((trait) => body.includes(trait + ":")).length >= 3, id + " chỉ đổi bảng màu, chưa có nhận diện riêng");
  }

  // Khung (thanh bên + thanh trên) có nền riêng, khác vùng nội dung: mỗi theme (trừ iOrder Blue ở :root) khai báo cả hai, thanh trên là màu đặc.
  assert.ok(/--cms-topbar-bg: #[0-9a-f]{6};/i.test(tokens.slice(0, tokens.indexOf('html[data-cms-theme="teal-mist"]'))), "mặc định thanh trên phải là màu đặc");
  for (const id of cmsColorThemeIds.filter((themeId) => themeId !== "iorder")) {
    const body = block(id);
    assert.ok(/--cms-nav-bg:/.test(body) && /--cms-topbar-bg: #[0-9a-f]{6}/i.test(body), id + " chưa có nền riêng cho thanh bên và thanh trên");
    const page = body.match(/--cms-background: (#[0-9a-f]{6})/i)?.[1];
    const top = body.match(/--cms-topbar-bg: (#[0-9a-f]{6})/i)?.[1];
    if (page && top) assert.notEqual(page.toLowerCase(), top.toLowerCase(), id + ": thanh trên trùng màu nền nội dung");
  }
  // Thanh bên và thanh trên phải KHÁC MÀU nhau và thanh bên luôn ĐẬM HƠN thanh trên (so độ sáng).
  const hex = (value?: string) => value?.match(/#[0-9a-f]{6}/i)?.[0].toLowerCase();
  const luminance = (color: string) => { const [r, g, b] = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const rootTokens = tokens.slice(0, tokens.indexOf('html[data-cms-theme="teal-mist"]'));
  for (const id of cmsColorThemeIds) {
    const body = id === "iorder" ? rootTokens : block(id);
    const nav = hex(body.match(/--cms-nav-bg: ([^;]+);/)?.[1]);
    const top = hex(body.match(/--cms-topbar-bg: ([^;]+);/)?.[1]);
    assert.ok(nav && top && nav !== top, id + ": thanh bên và thanh trên trùng màu (" + nav + " / " + top + ")");
    assert.ok(luminance(nav) < luminance(top), id + ": thanh bên phải đậm hơn thanh trên (" + nav + " / " + top + ")");
  }
  // Chữ sáng trên nền tối phải đủ tương phản (xét mọi điểm dừng của gradient nền thanh bên): chữ nav >= 10:1, chữ phụ nav >= 7:1,
  // chữ trên mục đang chọn >= 7:1, màu nhấn (icon mục đang chọn) >= 4.5:1.
  type Rgba = [number, number, number, number];
  const tokenOf = (body: string, name: string) => body.match(new RegExp(name + ": ([^;]+);"))?.[1].trim() ?? "";
  const toRgba = (value: string, body: string): Rgba => {
    const ref = value.match(/^var\((--[\w-]+)\)$/);
    if (ref) return toRgba(tokenOf(body, ref[1]) || tokenOf(rootTokens, ref[1]), body);
    if (value.startsWith("#")) return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16), 1];
    const m = value.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ (\d+)%)?\)$/);
    if (!m) throw new Error("không đọc được màu " + value);
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4]) / 100];
  };
  const lum3 = (c: number[]) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a: number[], b: number[]) => (Math.max(lum3(a), lum3(b)) + 0.05) / (Math.min(lum3(a), lum3(b)) + 0.05);
  const blend = (fg: Rgba, bg: number[]) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
  for (const id of cmsColorThemeIds) {
    const body = id === "iorder" ? rootTokens : block(id);
    const stops = (tokenOf(body, "--cms-nav-bg").match(/#[0-9a-f]{6}/gi) ?? []).map((stop) => toRgba(stop, body).slice(0, 3));
    const pick = (name: string) => toRgba(tokenOf(body, name), body);
    const activeOver = stops.map((stop) => blend(pick("--cms-nav-active-bg"), stop));
    const worst = (color: Rgba, backgrounds: number[][]) => Math.min(...backgrounds.map((bg) => ratio(color.slice(0, 3), bg)));
    assert.ok(worst(pick("--cms-nav-text"), stops) >= 10, id + ": chữ thanh bên chưa đủ sáng/tương phản (" + worst(pick("--cms-nav-text"), stops).toFixed(1) + ":1)");
    assert.ok(worst(pick("--cms-nav-muted"), stops) >= 7, id + ": chữ phụ thanh bên chưa đủ tương phản (" + worst(pick("--cms-nav-muted"), stops).toFixed(1) + ":1)");
    assert.ok(worst(pick("--cms-nav-active-text"), activeOver) >= 7, id + ": chữ mục đang chọn chưa đủ tương phản (" + worst(pick("--cms-nav-active-text"), activeOver).toFixed(1) + ":1)");
    assert.ok(worst(pick("--cms-nav-accent"), activeOver) >= 4.5, id + ": icon mục đang chọn chưa đủ tương phản (" + worst(pick("--cms-nav-accent"), activeOver).toFixed(1) + ":1)");
  }

  assert.match(settings, /top: string/, "ô xem trước có màu thanh trên");

  // Thanh bên luôn đậm hơn thanh trên nên mọi theme dùng logo chữ sáng; không còn bản logo nền sáng trong khung.
  assert.ok(!shell.includes("admin-brand__logo--light") && !read("apps/admin/src/components/admin/admin-shell.tsx").includes("logo--light"), "chỉ còn logo chữ sáng ở thanh bên");

  // Ô xem trước ở Giao diện CMS cho thấy màu thanh bên của từng theme.
  for (const id of cmsColorThemeIds) assert.match(settings, new RegExp('id: "' + id + '"[^\\n]*nav: "#[0-9A-Fa-f]{6}"'), id + " thiếu màu thanh bên ở ô xem trước");
});

test("Chữ đạt tương phản WCAG AA trên mọi bề mặt ở mọi bảng màu (chữ thường >= 7:1, chữ phụ, liên kết, nút chính, huy hiệu trạng thái, biểu tượng tệp >= 4.5:1)", () => {
  const tokens = read("apps/admin/src/styles/tokens.css");
  const components = read("apps/admin/src/styles/components.css");
  const rootStart = tokens.indexOf(":root {");
  const rootBody = tokens.slice(rootStart, tokens.indexOf("\n}", rootStart));
  const themeBody = (id: string) => tokens.match(new RegExp('html\\[data-cms-theme="' + id + '"\\] \\{([\\s\\S]*?)\\n\\}'))?.[1] ?? "";
  const parse = (body: string) => new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()] as const));
  type Rgb = [number, number, number];
  const luminance = (c: Rgb) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a: Rgb, b: Rgb) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const hexToRgb = (value: string): Rgb => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];

  for (const id of cmsColorThemeIds) {
    const vars = parse(rootBody);
    if (id !== "iorder") for (const [name, value] of parse(themeBody(id))) vars.set(name, value);
    const raw = (name: string): string => { const value = vars.get(name); assert.ok(value, id + ": thiếu token " + name); const ref = value.match(/^var\((--[\w-]+)\)$/); return ref ? raw(ref[1]) : value; };
    const rgb = (name: string): Rgb => { const value = raw(name); assert.ok(value.startsWith("#"), id + ": " + name + " cần là mã hex (đang là " + value + ")"); return hexToRgb(value); };
    const stops = (name: string): Rgb[] => (raw(name).match(/#[0-9a-f]{6}/gi) ?? []).map(hexToRgb);
    // --cms-subtle suy ra từ theme: color-mix(card, background 55%).
    const card = rgb("--cms-card"), background = rgb("--cms-background");
    const subtle = card.map((v, i) => v * 0.45 + background[i] * 0.55) as Rgb;
    const surfaces: Array<[string, Rgb]> = [["nền trang", background], ["thẻ", card], ["ô nhập", rgb("--cms-input-background")], ["hover", rgb("--cms-hover")], ["nền nhạt", subtle], ["primary-soft", rgb("--cms-primary-soft")]];
    const need = (label: string, fg: Rgb, bg: Rgb, min: number) => assert.ok(ratio(fg, bg) >= min, id + ": " + label + " chỉ " + ratio(fg, bg).toFixed(2) + ":1 (cần >= " + min + ")");

    for (const [name, bg] of surfaces) {
      need("chữ chính trên " + name, rgb("--cms-text"), bg, 7);
      need("chữ phụ trên " + name, rgb("--cms-muted"), bg, 4.5); // cũng là màu placeholder (đặc, không pha trong suốt)
    }
    for (const [name, bg] of [["thẻ", card], ["nền trang", background], ["primary-soft", rgb("--cms-primary-soft")]] as Array<[string, Rgb]>) need("liên kết/primary trên " + name, rgb("--cms-primary"), bg, 4.5);
    for (const fill of ["--cms-primary-fill", "--cms-primary-fill-hover"]) for (const stop of stops(fill).length ? stops(fill) : [rgb(fill === "--cms-primary-fill" ? "--cms-primary" : "--cms-primary-strong")]) need("chữ nút chính (" + fill + ")", rgb("--cms-on-primary"), stop, 4.5);
    for (const tone of ["neutral", "info", "success", "warning", "error"]) need("huy hiệu " + tone, rgb("--cms-status-" + tone + "-text"), rgb("--cms-status-" + tone + "-background"), 4.5);
    need("chữ lỗi trên thẻ", rgb("--cms-status-error-text"), card, 4.5);
    for (const kind of ["excel", "csv", "word", "pdf", "zip", "image", "text"]) need("biểu tượng tệp " + kind, rgb("--cms-file-" + kind), rgb("--cms-file-" + kind + "-soft"), 4.5);
  }

  // Chữ trắng cố định trên nền --cms-primary sẽ hỏng ở Chế độ tối (primary là xanh nhạt): phải dùng --cms-on-primary.
  const hardWhite = components.split("\n").filter((line) => /background: var\(--cms-primary\)[^}]*color: #fff/.test(line));
  assert.deepEqual(hardWhite, [], "chữ #fff trên nền --cms-primary, dùng var(--cms-on-primary)");
  assert.ok(/::placeholder \{ color: var\(--cms-muted\); opacity: 1; \}/.test(read("apps/admin/src/styles/base.css")), "placeholder là màu chữ phụ đặc");
});

test("Theme Giáng sinh: dây kim tuyến, mũ, cây thông và bông tuyết ở khung CMS; đèn chỉ chớp NHẸ; mọi thứ đứng yên khi giảm chuyển động", () => {
  const shell = read("apps/admin/src/styles/shell.css");
  const login = read("apps/admin/src/styles/christmas-login.css");
  assert.ok(shell.includes('html[data-cms-theme="christmas"] .admin-brand::after'), "mũ ông già Noel trên logo");
  assert.ok(shell.includes(".admin-topbar__festive") && shell.includes(".admin-festive__pine") && shell.includes(".admin-festive__flake"), "cây thông và bông tuyết ở thanh trên");
  assert.ok(shell.includes(".admin-festive-snow"), "lớp tuyết rơi");
  assert.ok(shell.includes(".admin-festive__snowman") && shell.includes(".admin-festive__gift"), "người tuyết và hộp quà trên dải tuyết");
  assert.ok(shell.includes(".xmas-tinsel--cms"), "dây kim tuyến ở thanh trên là một phần tử riêng");
  // Không còn dây đèn nhiều màu bật tắt dứt khoát ở thanh trên (pseudo-element của thanh trên và keyframes cũ).
  assert.ok(!shell.includes("cms-xmas-blink"));
  assert.ok(!/christmas"\] \.admin-topbar::(before|after)/.test(shell));

  // Ảnh dây (nơ đỏ, kim tuyến) và hai ảnh đèn xen kẽ dùng chung cho CMS và trang đăng nhập; trong ảnh không có hoạt ảnh nào.
  const base = read("apps/admin/public/brand/xmas-garland.svg");
  const lightsA = read("apps/admin/public/brand/xmas-garland-lights-a.svg");
  const lightsB = read("apps/admin/public/brand/xmas-garland-lights-b.svg");
  for (const svg of [base, lightsA, lightsB]) {
    assert.ok(svg.includes("<svg"));
    assert.ok(!/<animate|animateTransform|@keyframes|animation/.test(svg), "hoạt ảnh nằm ở CSS, không nằm trong ảnh");
  }
  assert.ok(!base.includes("<circle"), "ảnh dây không còn bóng đèn (đèn ở hai ảnh riêng)");
  const bulbs = (svg: string) => (svg.match(/fill="#(fff3c4|ffe08a)"/g) ?? []).length;
  assert.ok(bulbs(lightsA) >= 4 && bulbs(lightsB) >= 4 && bulbs(lightsA) + bulbs(lightsB) >= 10, "đủ bóng đèn, chia đều cho hai nhóm");
  assert.match(login, /\.xmas-tinsel \{[^}]*xmas-garland\.svg/);
  assert.match(login, /\.xmas-tinsel::before, \.xmas-tinsel::after \{[^}]*xmas-garland-lights-a\.svg/);
  assert.match(login, /\.xmas-tinsel::after \{[^}]*xmas-garland-lights-b\.svg/);
  assert.match(login, /\.xmas__garland \{[^}]*--tinsel-w/);

  // "Chớp nhẹ": độ mờ không xuống dưới 30%, chu kỳ từ 3 giây, hai nhóm lệch pha một nửa chu kỳ (thở luân phiên, không bật tắt dứt khoát).
  const keyframes = login.match(/@keyframes xmas-light-twinkle \{([^}]*\{[^}]*\}[^}]*\{[^}]*\})\s*\}/);
  assert.ok(keyframes, "thiếu keyframes xmas-light-twinkle");
  const opacities = [...keyframes[1].matchAll(/opacity: ([0-9.]+)/g)].map((match) => Number(match[1]));
  assert.ok(opacities.length >= 2 && Math.min(...opacities) >= 0.3 && Math.max(...opacities) <= 1, "độ mờ " + opacities.join(", "));
  assert.match(login, /--light-period, 3\.8s/);
  assert.match(login, /animation-delay: calc\(var\(--light-period, 3\.8s\) \/ -2\)/);

  // Giảm chuyển động: đèn trên dây, đèn trên cây thông và bông tuyết đứng yên.
  const reducedShell = shell.slice(shell.indexOf("@media (prefers-reduced-motion: reduce)", shell.indexOf(".admin-festive-snow")));
  assert.match(reducedShell, /admin-festive__flake, \.admin-festive__bulb, \.admin-festive__bell \{ animation: none/);
  assert.match(login, /prefers-reduced-motion: reduce[\s\S]*\.xmas-tinsel::before, \.xmas-tinsel::after, \.xmas-bell \{ animation: none/);

  // Chuông treo lủng lẳng: con lắc biên độ nhỏ (≤ 12 độ) quanh điểm treo ở đỉnh dây, có ở cả CMS lẫn trang đăng nhập.
  assert.ok(shell.includes(".admin-festive__bell--1") && login.includes(".xmas__bell"), "chuông ở CMS và ở trang đăng nhập");
  const swing = login.match(/@keyframes xmas-bell-swing \{ from \{ transform: rotate\((-?[0-9.]+)deg\); \} to \{ transform: rotate\((-?[0-9.]+)deg\); \} \}/);
  assert.ok(swing, "thiếu keyframes xmas-bell-swing");
  assert.ok(Math.abs(Number(swing[1])) <= 12 && Math.abs(Number(swing[2])) <= 12, "biên độ " + swing[1] + ", " + swing[2]);
  assert.match(login, /\.xmas-bell \{[^}]*transform-origin: 50% 0/);
  const bell = read("apps/admin/src/components/admin/christmas-bell.tsx");
  assert.ok(!/<(linear|radial)Gradient|url\(#|\sid=/.test(bell), "chuông không dùng id/gradient (ẩn bớt vài chiếc không được làm hỏng chiếc còn lại)");
  assert.ok(!/use client/.test(bell), "chuông là component thuần, dùng được cả ở server lẫn client");
});

test("Đăng nhập Giáng sinh: ông già Noel nằm trên thẻ, kéo dải băng Merry Christmas và thả giỏ quà dù; giảm chuyển động thì đứng yên, không thả", () => {
  const login = read("apps/admin/src/styles/christmas-login.css");
  const scenery = read("apps/admin/src/components/admin/login/christmas-scenery.tsx");
  const stage = read("apps/admin/src/components/admin/login/christmas-stage.tsx");
  const art = read("apps/admin/src/components/admin/login/christmas-art.tsx");

  // Lớp bay nằm trên dây đèn (5), chuông (6), thẻ (10), dưới canvas hiệu ứng (30); ông không nhận chuột và cú bấm được tính theo khung của ông.
  const z = (selector: string) => Number(login.match(new RegExp(selector.replace(/\./g, "\\.") + " \\{[^}]*?z-index: (\\d+)"))?.[1]);
  assert.ok(z(".xmas__flight") > Math.max(z(".xmas__garland"), z(".xmas__bells"), z(".xmas__center")), "lớp bay phải trên thẻ");
  assert.ok(z(".xmas__flight") < z(".xmas__fx"), "lớp bay phải dưới canvas hiệu ứng");
  assert.match(login, /\.xmas__flight \{[^}]*pointer-events: none/);
  assert.ok(!/\.xmas__santa[^{]*\{[^}]*pointer-events: auto/.test(login), "ông không nhận chuột để không chặn form");
  assert.match(stage, /santa\.getBoundingClientRect\(\)/, "cú bấm trúng khung ông vẫn được tính");
  assert.ok(!/\.xmas__layer[^>]*>\s*<div className="xmas__santa"/.test(scenery), "ông không nằm trong lớp cảnh nền (bị che hết)");

  // Dải băng chữ và giỏ quà: kích thước tính theo --w của xe, giỏ có độ trễ âm theo --at để lần đầu rơi đúng giây đó.
  assert.match(scenery, /<ChristmasBanner text="Merry Christmas" \/>/);
  assert.match(scenery, /data-text=\{text\}/, "chữ của dải băng nằm trong data-text (vẽ bằng ::before), không nhân đôi văn bản trang");
  assert.match(scenery, /const bannerSlices = \d+;/);
  assert.match(scenery, /const dropTimes = \[[\d., ]+\];/);
  assert.match(login, /\.xmas__banner \{[^}]*--bw: calc\(var\(--w\) \* [\d.]+\)/);

  // Vải lượn sóng thật (không phải tấm cứng xoay nguyên khối): nhiều lát lệch pha, đầu buộc đứng yên, chỉ animate transform/opacity.
  assert.match(login, /\.xmas__banner-slice \{[^}]*animation: xmas-banner-wave [^;]*; animation-delay: calc\(-2\.6s \+ var\(--lag\)\)/);
  const waveFrames = login.match(/@keyframes xmas-banner-wave \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.ok(/translateY\(calc\(var\(--w\) \* [\d.]+ \* var\(--amp\)/.test(waveFrames), "biên độ nhân với --amp (đầu buộc --amp = 0)");
  assert.ok(!/(left|top|width|height|margin|filter)\s*:/.test(waveFrames), "sóng chỉ dùng transform");
  assert.match(login, /@keyframes xmas-banner-shade \{ from \{ opacity: 0; \} to \{ opacity: [\d.]+; \} \}/);
  // Ông Noel: đường bay có thêm nhịp lượn dài, tay vẫy và ngù mũ đung đưa.
  assert.match(login, /\.xmas__santa-glide \{ animation: xmas-glide/);
  assert.match(login, /\.xmas-santa-arm \{[^}]*animation: xmas-santa-wave/);
  assert.match(login, /\.xmas-pom \{[^}]*animation: xmas-pom-swing/);
  const sleigh = art.slice(art.indexOf("export function SantaSleigh"), art.indexOf("export function GiftBasket"));
  assert.ok(sleigh.includes('className="xmas-santa-arm"') && sleigh.includes('className="xmas-pom"'), "xe có tay vẫy và ngù mũ");
  assert.ok((sleigh.match(/<Reindeer /g) ?? []).length === 2 && art.includes('className="xmas-leg"') && art.includes('className="xmas-nose"'), "hai tuần lộc, chân chạy và mũi phát sáng");

  // Mọi @keyframes trong file phải duy nhất tên (trùng tên thì định nghĩa sau đè định nghĩa trước, hoạt ảnh của chỗ khác bị đổi mà không ai hay).
  const keyframeNames = [...login.matchAll(/@keyframes ([\w-]+)/g)].map((match) => match[1]);
  const duplicated = keyframeNames.filter((name, index) => keyframeNames.indexOf(name) !== index);
  assert.deepEqual(duplicated, [], "trùng tên @keyframes: " + duplicated.join(", "));
  assert.match(login, /\.xmas__drop \{[^}]*animation-delay: calc\(var\(--at\) - 30s\)/);
  assert.match(login, /@keyframes xmas-drop \{[\s\S]*?\}\s*\n\s*\}/);
  assert.ok(/export function GiftBasket/.test(art) && !/<(linear|radial)Gradient|url\(#|\sid=/.test(art.slice(art.indexOf("export function GiftBasket"), art.indexOf("export function Garland"))), "giỏ quà không dùng id/gradient (dựng nhiều bản)");
  assert.ok(!/(drop-shadow|blur\(|backdrop-filter|mix-blend-mode)/.test(login.slice(login.indexOf(".xmas__banner {"), login.indexOf("@keyframes xmas-drop {"))), "dải băng và giỏ quà không dùng hiệu ứng nặng");

  // Giảm chuyển động: không thả giỏ quà (nếu không sẽ đứng chình ình dưới xe) và xe đứng ở chỗ dải băng còn lọt trong màn hình.
  const reduced = login.slice(login.indexOf("@media (prefers-reduced-motion: reduce)", login.indexOf(".xmas__shooting")));
  assert.match(reduced, /\.xmas__drop \{ display: none; \}/);
  assert.match(reduced, /\.xmas__santa \{ transform: translate3d\(min\(/);
});

test("Đăng nhập Giáng sinh: nhãn nổi lên mép khung bằng viền khuyết (không nền che); mật khẩu ẩn thì đóng băng, hiện thì băng vỡ; giảm chuyển động không để lại mảnh vỡ", () => {
  const login = read("apps/admin/src/styles/christmas-login.css");
  const form = read("apps/admin/src/app/admin/login/login-form.tsx");

  // Khung có khuyết: fieldset/legend ẩn khỏi trình đọc màn hình, chữ của legend vẽ bằng ::before nên không nhân đôi văn bản trang.
  assert.match(form, /<fieldset aria-hidden="true" className="admin-field__frame">\s*<legend data-label=\{label\} \/>/);
  assert.match(form, /<label className="admin-field__label" htmlFor="login-username">/);
  assert.ok(form.includes('placeholder=" "'), "cần placeholder=\" \" để :placeholder-shown biết ô còn trống");
  assert.match(login, /\n\s*\.admin-field__frame \{ display: none; \}/, "giao diện thường không dùng khung khuyết");
  assert.match(login, /\.xmas__card \.admin-field__frame > legend \{[^}]*max-width: 0\.01px/);
  assert.match(login, /\.admin-field:focus-within > \.admin-field__frame > legend,[\s\S]*?\{ max-width: 100%/);
  assert.match(login, /\.xmas__card \.admin-input \{[^}]*border-color: transparent/, "viền do khung vẽ, ô không tự vẽ viền");

  // Không quay lại cách cũ: nhãn không có nền che viền (nền luôn lệch màu so với ô khi tự điền/đóng băng/focus).
  const labelRules = login.match(/[^{}\n]*\.admin-field__label[^{}]*\{[^}]*\}/g) ?? [];
  assert.ok(labelRules.length >= 3, "tìm thấy các luật của nhãn");
  for (const rule of labelRules) assert.ok(!/background/.test(rule), "nhãn không được có nền: " + rule.slice(0, 80));

  // Đóng băng theo aria-pressed của nút con mắt (false = đang ẩn); cột băng là ảnh tĩnh, đủ nhỏ.
  assert.match(login, /\.admin-password-input:has\(\.admin-password-input__toggle\[aria-pressed="false"\]\)::after \{[^}]*animation: xmas-frost-glint/);
  assert.match(login, /\.admin-password-input:has\(\.admin-password-input__toggle\[aria-pressed="true"\]\)::after \{[^}]*animation: xmas-ice-shatter/);
  assert.match(login, /\.admin-password-input:has\(\.admin-password-input__toggle\[aria-pressed="true"\]\)::before \{ opacity: 0;/);
  const icicles = read("apps/admin/public/brand/xmas-icicles.svg");
  assert.ok(!/<(animate|script|filter|foreignObject)\b/i.test(icicles), "cột băng là ảnh tĩnh, không filter/script");
  assert.ok(icicles.length < 2048, "ảnh cột băng nhỏ: " + icicles.length);
  assert.ok(!/(drop-shadow|blur\(|backdrop-filter|mix-blend-mode)/.test(login.slice(login.indexOf("/* Mật khẩu đang ẩn thì"), login.indexOf("/* Nút đăng nhập: đỏ Giáng sinh"))), "phần đóng băng không dùng hiệu ứng nặng");

  // Giảm chuyển động: mảnh vỡ chỉ có nghĩa khi bay ra rồi mờ đi, không có hoạt ảnh thì ẩn hẳn (nếu không sẽ đứng yên cạnh nút).
  const reduced = login.slice(login.indexOf("@media (prefers-reduced-motion: reduce)", login.indexOf(".xmas__shooting")));
  assert.match(reduced, /\.admin-password-input:has\(\.admin-password-input__toggle\[aria-pressed="true"\]\)::after \{ display: none; \}/);
});

test("Theo hệ thống: là lựa chọn chứ không phải bảng màu có token riêng, và chọn sáng/tối theo thiết bị", () => {
  assert.equal(isCmsColorThemeId(systemColorTheme), false);
  assert.equal(isCmsColorThemePreference(systemColorTheme), true);
  assert.equal(isCmsColorThemePreference("dark"), true);
  for (const value of ["", "System", "auto", null, undefined]) assert.equal(isCmsColorThemePreference(value), false, String(value));
  assert.equal(resolveColorTheme("system", true), "dark");
  assert.equal(resolveColorTheme("system", false), "iorder");
  // Chọn một bảng màu cụ thể thì thiết bị sáng hay tối không đổi gì.
  for (const id of cmsColorThemeIds) for (const prefersDark of [true, false]) assert.equal(resolveColorTheme(id, prefersDark), id);
  assert.ok(read("apps/admin/src/components/admin/admin-theme-settings.tsx").includes('id: "system"'), "Theo hệ thống phải có trong màn hình chọn");
});

// Chạy đoạn script khởi động với localStorage và matchMedia giả để kiểm tra đúng thứ nó đặt lên <html>.
function bootTheme(stored: Record<string, string>, prefersDark: boolean) {
  const documentElement = { dataset: {} as Record<string, string> };
  new Function("localStorage", "matchMedia", "document", cmsThemeBootScript())(
    { getItem: (key: string) => stored[key] ?? null },
    () => ({ matches: prefersDark }),
    { documentElement },
  );
  return documentElement.dataset.cmsTheme;
}

test("Script khởi động bảng màu: đặt đúng bảng màu trước khi vẽ, theo hệ thống thì theo chế độ của thiết bị", () => {
  assert.equal(bootTheme({ [colorThemeStorageKey]: "system" }, true), "dark");
  assert.equal(bootTheme({ [colorThemeStorageKey]: "system" }, false), "iorder");
  assert.equal(bootTheme({ [colorThemeStorageKey]: "teal-mist" }, true), "teal-mist");
  assert.equal(bootTheme({ [legacyThemeStorageKey]: "christmas" }, false), "christmas", "khóa cũ vẫn được đọc khi chưa có khóa mới");
  assert.equal(bootTheme({ [colorThemeStorageKey]: "dark", [legacyThemeStorageKey]: "christmas" }, false), "dark", "khóa mới thắng khóa cũ");
  // Chưa chọn gì hoặc giá trị lạ: không đặt gì (CMS giữ bảng màu mặc định).
  assert.equal(bootTheme({}, true), undefined);
  assert.equal(bootTheme({ [colorThemeStorageKey]: "khong-co" }, true), undefined);
});

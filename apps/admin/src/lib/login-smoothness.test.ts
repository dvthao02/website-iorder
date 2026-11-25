import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// Test chạy từ thư mục gốc của repo (pnpm test).
const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

// Đo trên trang đăng nhập Giáng sinh (máy giả lập chậm gấp 4): đứng yên đã tốn ~36% thời gian xử lý để tính lại style, đăng nhập sai thì khung hình
// trung bình 130ms. Nguyên nhân là ghi biến CSS kế thừa (--px/--py, --xmas-twinkle) lên thẻ gốc của cảnh, mỗi lần buộc trình duyệt tính lại style
// hàng trăm phần tử và đổi nhịp hàng trăm hoạt ảnh. Những test này giữ cho điện thoại không quay lại cách đó.

test("Đăng nhập Giáng sinh: cảm ứng không ghi --px/--py định kỳ lên thẻ gốc (chỉ máy có chuột mới có thị sai)", () => {
  const stage = read("apps/admin/src/components/admin/login/christmas-stage.tsx");
  assert.ok(!/Math\.sin\(time/.test(stage), "không còn vòng trôi cảnh theo sin/cos cho cảm ứng");
  assert.equal((stage.match(/setParallax\(/g) ?? []).length, 1, "chỉ một chỗ gọi setParallax, nằm trong nhánh con trỏ");
  assert.ok(stage.indexOf("if (finePointer.matches)") < stage.indexOf("setParallax(currentX"), "ghi thị sai nằm trong nhánh có con trỏ");
});

test("Đăng nhập Giáng sinh: nhịp chớp đèn chỉ đổi theo trạng thái ở máy có chuột", () => {
  const css = read("apps/admin/src/styles/christmas-login.css");
  const fine = "@media (hover: hover) and (pointer: fine)";
  assert.match(css, new RegExp(String.raw`@media \(hover: hover\) and \(pointer: fine\) \{\s*(?:/\*[^*]*\*/\s*)?\.xmas:has\(\.xmas__card button\[type="submit"\]:disabled\) \{ --xmas-twinkle`), "đang gửi đăng nhập");
  assert.ok(css.includes(`${fine} { .xmas--alert { --xmas-twinkle`), "đăng nhập sai");
  assert.ok(css.includes(`${fine} { .xmas--success { --xmas-twinkle`), "đăng nhập đúng");
  // Giá trị mặc định đặt một lần ở thẻ gốc; mọi chỗ khác đặt lại --xmas-twinkle đều phải nằm trong khối máy có chuột ở trên.
  const assignments = [...css.matchAll(/(^|\n)([^\n]*)--xmas-twinkle: [\d.]+s;/g)].map((match) => match[2]);
  assert.equal(assignments.filter((line) => /\.xmas--(alert|success)|:has\(/.test(line) && !line.includes("@media")).length, 1, "chỉ khối :has nằm ở dòng riêng bên trong @media");
});

test("Đăng nhập Giáng sinh: hoạt ảnh lặp chỉ đổi transform/opacity (đổi left hay box-shadow buộc tính lại bố cục / vẽ lại vùng rộng ở từng khung hình)", () => {
  const css = read("apps/admin/src/styles/christmas-login.css");
  for (const name of ["xmas-moon", "xmas-shine"]) {
    const body = css.match(new RegExp(String.raw`@keyframes ${name} \{(.*)\}`))?.[1] ?? "";
    assert.ok(body.length > 0, `thiếu @keyframes ${name}`);
    assert.ok(!/(^|[\s{;])(left|top|right|bottom|width|height|box-shadow|filter|background[\w-]*)\s*:/.test(body), `${name} chỉ được đổi transform/opacity: ${body.trim()}`);
  }
});

test("Đăng nhập: thông báo nổi nằm ngoài thẻ (thẻ có transform nên phần tử fixed bên trong bị lệch khỏi màn hình)", () => {
  const form = read("apps/admin/src/app/admin/login/login-form.tsx");
  const page = read("apps/admin/src/app/admin/login/page.tsx");
  assert.ok(!/AdminToastProvider/.test(form.replace(/\/\/[^\n]*/g, "")), "form không tự bọc AdminToastProvider");
  const wrapped = (page.match(/<AdminToastProvider>/g) ?? []).length;
  assert.equal(wrapped, 2, "cả hai giao diện đăng nhập đều bọc AdminToastProvider ở trang");
  const christmas = page.slice(page.indexOf("<ChristmasStage>"), page.indexOf("</ChristmasStage>"));
  assert.ok(christmas.indexOf("<AdminToastProvider>") < christmas.indexOf('className="xmas__card"'), "provider bao ngoài thẻ Giáng sinh");
});

test("Đăng nhập: nút có vòng xoay theo giao diện suốt lúc chờ (kể cả lúc chờ mở CMS sau khi thành công), giảm chuyển động thì nhấp nháy thay vì xoay", () => {
  const form = read("apps/admin/src/app/admin/login/login-form.tsx");
  const page = read("apps/admin/src/app/admin/login/page.tsx");
  const components = read("apps/admin/src/styles/components.css");
  const christmas = read("apps/admin/src/styles/christmas-login.css");
  // Giao diện thường là vòng tròn, Giáng sinh là bông tuyết; trang truyền giao diện đang hiện vào form.
  assert.match(form, /theme === "christmas"[\s\S]*<Snowflake[\s\S]*login-spinner--christmas[\s\S]*<LoaderCircle[\s\S]*className="login-spinner"/);
  assert.match(page, /<LoginForm [^>]*theme=\{loginTheme\}/);
  // Vòng xoay hiện khi đang gửi và vẫn hiện (kèm chữ riêng) lúc đã đăng nhập đúng và đang chờ chuyển trang.
  assert.match(form, /\{isSubmitting \? <LoginSpinner theme=\{theme\} \/> : null\}/);
  assert.match(form, /setIsOpening\(true\);[\s\S]*window\.location\.replace\("\/admin"\)/);
  assert.match(form, /isOpening \? "Đăng nhập thành công, đang mở CMS…"/);
  // Vòng viền cũ (::before) của nút Giáng sinh đã được thay bằng bông tuyết, không để hai vòng xoay cùng hiện.
  assert.ok(!christmas.includes(".admin-button--primary:disabled::before"), "nút Giáng sinh không còn vòng viền ::before");
  assert.match(components, /\.login-spinner \{[^}]*animation: admin-spin/);
  assert.match(components, /prefers-reduced-motion: reduce\) \{ \.login-spinner \{ animation: login-pulse/);
  assert.match(christmas, /\.xmas \.login-spinner \{ animation: login-pulse[^}]*!important; \}/);
});

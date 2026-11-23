import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { builtInRedirect, legacyPathRedirect, legacyPaths, lowercasePathname, redirectLoopsBack } from "@iorder/shared/server/shared/legacy-paths";

test("URL tiếng Việt cũ chuyển về URL tiếng Anh chuẩn, giữ phần đường dẫn con", () => {
  assert.equal(legacyPathRedirect("/tin-tuc"), "/news");
  assert.equal(legacyPathRedirect("/tin-tuc/bai-viet-mau"), "/news/bai-viet-mau");
  assert.equal(legacyPathRedirect("/tin-tuc/chuyen-muc/khuyen-mai"), "/news/category/khuyen-mai");
  assert.equal(legacyPathRedirect("/tin-tuc/the/pos"), "/news/tag/pos");
  assert.equal(legacyPathRedirect("/ho-tro/huong-dan/cai-dat-may-in"), "/support/guides/cai-dat-may-in");
  assert.equal(legacyPathRedirect("/ho-tro/cai-dat"), "/support/setup");
  assert.equal(legacyPathRedirect("/ho-tro/faq"), "/support/faq");
  assert.equal(legacyPathRedirect("/ho-tro/video"), "/support/videos");
  assert.equal(legacyPathRedirect("/ho-tro-tu-xa"), "/support/remote");
  assert.equal(legacyPathRedirect("/ho-tro"), "/support");
  assert.equal(legacyPathRedirect("/trang/uu-dai"), "/pages/uu-dai");
  assert.equal(legacyPathRedirect("/tac-gia/nguyen-van-an"), "/author/nguyen-van-an");
  assert.equal(legacyPathRedirect("/gioi-thieu"), "/about");
  assert.equal(legacyPathRedirect("/lien-he"), "/contact");
  assert.equal(legacyPathRedirect("/thiet-bi/may-in"), "/equipment/may-in");
  assert.equal(legacyPathRedirect("/chinh-sach-bao-mat"), "/privacy-policy");
  assert.equal(legacyPathRedirect("/dieu-khoan"), "/terms-of-use");
  assert.equal(legacyPathRedirect("/phan-mem/iorder-pos"), "/software/iorder-pos");
  assert.equal(legacyPathRedirect("/giai-phap"), "/solutions");
  assert.equal(legacyPathRedirect("/dich-vu/bao-tri-it"), "/solutions/bao-tri-it");
});

test("Dịch vụ đã gộp vào Giải pháp: /services và trang con chuyển về /solutions", () => {
  assert.equal(legacyPathRedirect("/services"), "/solutions");
  assert.equal(legacyPathRedirect("/services/tu-van-chuyen-doi-so"), "/solutions/tu-van-chuyen-doi-so");
  assert.equal(legacyPathRedirect("/dich-vu"), "/solutions");
  for (const pathname of ["/servicesx", "/services-moi", "/solutions", "/solutions/ha-tang-mang-wifi-camera"]) assert.equal(legacyPathRedirect(pathname), null, pathname);
});

test("tên thư mục cũ /terms và trang /huong-dan đã gộp cũng chuyển về URL chuẩn", () => {
  assert.equal(legacyPathRedirect("/terms"), "/terms-of-use");
  assert.equal(legacyPathRedirect("/huong-dan"), "/support/guides");
  assert.equal(legacyPathRedirect("/huong-dan/cai-dat-may-in"), "/support/guides/cai-dat-may-in");
});

test("URL tiếng Anh chuẩn và URL không liên quan không bị chuyển hướng", () => {
  for (const pathname of ["/", "/news", "/support/guides", "/privacy-policy", "/terms-of-use", "/about", "/software/iorder-pos", "/tin-tucx", "/newsletter", "/trang-chu", "/trangx", "/ho-tro-khac", "/termsx", "/pages/uu-dai"]) {
    assert.equal(legacyPathRedirect(pathname), null, pathname);
  }
});

test("mục cụ thể đứng trước mục chung: /ho-tro/faq không bị /ho-tro nuốt, /tin-tuc/the không bị /tin-tuc nuốt", () => {
  const order = legacyPaths.map(([legacy]) => legacy);
  for (const [specific, general] of [["/ho-tro/faq", "/ho-tro"], ["/ho-tro/cai-dat", "/ho-tro"], ["/ho-tro/huong-dan", "/ho-tro"], ["/ho-tro/video", "/ho-tro"], ["/tin-tuc/the", "/tin-tuc"], ["/tin-tuc/chuyen-muc", "/tin-tuc"]]) {
    assert.ok(order.indexOf(specific) < order.indexOf(general), `${specific} phải đứng trước ${general}`);
  }
});

test("mọi URL cũ đều có đích là URL tiếng Anh chuẩn, không đích nào lại bị chuyển hướng tiếp (không chuỗi, không vòng)", () => {
  assert.equal(new Set(legacyPaths.map(([legacy]) => legacy)).size, legacyPaths.length, "URL cũ trùng nhau");
  for (const [legacy, current] of legacyPaths) {
    assert.equal(legacyPathRedirect(current), null, `${legacy} → ${current} bị chuyển hướng tiếp`);
    assert.match(current, /^\/[a-z0-9-]+(\/[a-z0-9-]+)?$/, current);
  }
});

test("URL chuẩn trùng tên thư mục route của website (không còn rewrites): mỗi đích đều có thư mục tương ứng", () => {
  const routes = path.join(__dirname, "../app/(web)");
  for (const [, current] of legacyPaths) {
    const segments = current.split("/").filter(Boolean);
    // Đoạn đầu là thư mục tĩnh hoặc danh mục động [catalog] (software, solutions, services).
    const catalog = ["software", "solutions", "services"].includes(segments[0]);
    assert.ok(catalog || existsSync(path.join(routes, segments[0])), `thiếu thư mục route cho ${current}`);
    if (!catalog && segments.length > 1) assert.ok(readdirSync(path.join(routes, segments[0])).includes(segments[1]), `thiếu thư mục route cho ${current}`);
  }
});

test("đường dẫn viết hoa được đưa về chữ thường, giữ nguyên mã hóa phần trăm", () => {
  assert.equal(lowercasePathname("/NEWS"), "/news");
  assert.equal(lowercasePathname("/News/Category/Abc"), "/news/category/abc");
  assert.equal(lowercasePathname("/t%C3%AAn"), "/t%C3%AAn");
  assert.equal(lowercasePathname("/ho-tro/cai-dat"), "/ho-tro/cai-dat");
});

test("chuyển hướng có sẵn gồm URL tiếng Việt cũ và URL viết hoa; URL chuẩn thì không", () => {
  assert.equal(builtInRedirect("/chinh-sach-bao-mat"), "/privacy-policy");
  assert.equal(builtInRedirect("/TIN-TUC"), "/news", "viết hoa rồi mới áp bảng nên chỉ một bước");
  assert.equal(builtInRedirect("/NEWS"), "/news");
  assert.equal(builtInRedirect("/Tin-Tuc/Bai-A"), "/news/bai-a");
  assert.equal(builtInRedirect("/privacy-policy"), null);
  assert.equal(builtInRedirect("/t%C3%AAn"), null);
});

test("nhận ra chuyển hướng của CMS quay về chính đường dẫn nguồn (vòng lặp vô hạn trên trình duyệt)", () => {
  assert.equal(redirectLoopsBack("/privacy-policy", "/chinh-sach-bao-mat"), true);
  assert.equal(redirectLoopsBack("/privacy-policy", "/chinh-sach-bao-mat?utm=1#phan-2"), true);
  assert.equal(redirectLoopsBack("/news/bai-a", "/tin-tuc/bai-a"), true);
  assert.equal(redirectLoopsBack("/bang-gia", "/Bang-Gia"), true);
  assert.equal(redirectLoopsBack("/trang/privacy-policy", "/privacy-policy"), false);
  assert.equal(redirectLoopsBack("/chinh-sach-bao-mat", "/privacy-policy"), false, "nguồn là URL cũ, đích là URL chuẩn: hợp lệ");
  assert.equal(redirectLoopsBack("/giai-phap/cu", "/solutions/moi"), false);
});

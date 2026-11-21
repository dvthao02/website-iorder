import assert from "node:assert/strict";
import test from "node:test";

import { englishPathRedirect, isRewrittenPath, lowercasePathname, publicRewrites, routeFolders } from "./legacy-paths";

test("URL tiếng Anh (tên thư mục) chuyển về URL tiếng Việt, giữ phần đường dẫn con", () => {
  assert.equal(englishPathRedirect("/news"), "/tin-tuc");
  assert.equal(englishPathRedirect("/news/bai-viet-mau"), "/tin-tuc/bai-viet-mau");
  assert.equal(englishPathRedirect("/news/category/khuyen-mai"), "/tin-tuc/chuyen-muc/khuyen-mai");
  assert.equal(englishPathRedirect("/support/guides/cai-dat-may-in"), "/ho-tro/huong-dan/cai-dat-may-in");
  assert.equal(englishPathRedirect("/support/setup"), "/ho-tro/cai-dat");
  assert.equal(englishPathRedirect("/support/remote"), "/ho-tro-tu-xa");
  assert.equal(englishPathRedirect("/support"), "/ho-tro");
  assert.equal(englishPathRedirect("/pages/uu-dai"), "/trang/uu-dai");
  assert.equal(englishPathRedirect("/privacy-policy"), "/chinh-sach-bao-mat");
  assert.equal(englishPathRedirect("/terms"), "/dieu-khoan");
  assert.equal(englishPathRedirect("/huong-dan"), "/ho-tro/huong-dan");
  assert.equal(englishPathRedirect("/huong-dan/cai-dat-may-in"), "/ho-tro/huong-dan/cai-dat-may-in");
});

test("URL tiếng Việt chuẩn và URL không liên quan không bị chuyển hướng", () => {
  assert.equal(englishPathRedirect("/"), null);
  assert.equal(englishPathRedirect("/tin-tuc"), null);
  assert.equal(englishPathRedirect("/ho-tro/huong-dan"), null);
  assert.equal(englishPathRedirect("/software"), null);
  assert.equal(englishPathRedirect("/newsletter"), null);
  assert.equal(englishPathRedirect("/pagesx"), null);
});

test("Mỗi URL tiếng Việt có hai rewrite (chính nó và đường dẫn con), mục cụ thể đứng trước mục chung", () => {
  const rewrites = publicRewrites();
  assert.equal(rewrites.length, routeFolders.length * 2);
  const index = (source: string) => rewrites.findIndex((rule) => rule.source === source);
  assert.ok(index("/tin-tuc/chuyen-muc") < index("/tin-tuc"));
  assert.ok(index("/tin-tuc/the/:path*") < index("/tin-tuc/:path*"));
});

test("Nhận ra URL đi qua rewrites() để tắt tải trước (kèm query, neo, đường dẫn con)", () => {
  for (const href of ["/tin-tuc", "/tin-tuc/bai-viet-mau", "/tin-tuc?trang=2", "/thiet-bi#bang-gia", "/ho-tro/huong-dan/cai-dat-may-in", "/lien-he", "/trang/uu-dai", "/ho-tro"]) assert.equal(isRewrittenPath(href), true, href);
  for (const href of ["/", "/phan-mem", "/phan-mem/iorder", "/tin-tucx", "https://iorder.vn/tin-tuc", "//cdn.example.com/tin-tuc", "#lien-he", "mailto:a@b.vn"]) assert.equal(isRewrittenPath(href), false, href);
});

test("Đường dẫn viết hoa được đưa về chữ thường, giữ nguyên mã hóa phần trăm", () => {
  assert.equal(lowercasePathname("/TIN-TUC"), "/tin-tuc");
  assert.equal(lowercasePathname("/Tin-Tuc/Bai-Viet-Mau"), "/tin-tuc/bai-viet-mau");
  assert.equal(lowercasePathname("/tin-tuc"), "/tin-tuc");
  assert.equal(lowercasePathname("/"), "/");
  assert.equal(lowercasePathname("/tin-tuc/b%C3%A0i"), "/tin-tuc/b%C3%A0i");
  assert.equal(lowercasePathname("/Tin-Tuc/B%C3%A0i"), "/tin-tuc/b%C3%A0i");
});

test("Viết hoa rồi mới áp bảng URL tiếng Anh thì chỉ cần một bước chuyển hướng", () => {
  assert.equal(englishPathRedirect(lowercasePathname("/NEWS")), "/tin-tuc");
  assert.equal(englishPathRedirect(lowercasePathname("/Support/FAQ")), "/ho-tro/faq");
});

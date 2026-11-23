import assert from "node:assert/strict";
import test from "node:test";

import { describeLinkUpdates } from "./redirects.contract";
import { rewriteLink, rewriteLinksInJson } from "./redirect-links";

const move = { from: "/chinh-sach-cu", to: "/chinh-sach-moi" };

test("liên kết trỏ đúng đường dẫn cũ được đổi, giữ query và neo", () => {
  assert.equal(rewriteLink("/chinh-sach-cu", move), "/chinh-sach-moi");
  assert.equal(rewriteLink("/chinh-sach-cu?trang=2", move), "/chinh-sach-moi?trang=2");
  assert.equal(rewriteLink("/chinh-sach-cu#muc-1", move), "/chinh-sach-moi#muc-1");
  assert.equal(rewriteLink("/chinh-sach-cu?a=1#muc-1", move), "/chinh-sach-moi?a=1#muc-1");
});

test("neo của đích được ưu tiên hơn neo của liên kết; query của đích không được thêm vào (website giữ query của khách)", () => {
  assert.equal(rewriteLink("/chinh-sach-cu#a", { from: "/chinh-sach-cu", to: "/moi#b" }), "/moi#b");
  assert.equal(rewriteLink("/chinh-sach-cu?x=1", { from: "/chinh-sach-cu", to: "/moi?y=2" }), "/moi?x=1");
});

test("không đổi liên kết khác: đường dẫn con, tiền tố trùng, URL ngoài, chữ hoa", () => {
  for (const value of ["/chinh-sach-cu/con", "/chinh-sach-cu-hon", "/x/chinh-sach-cu", "https://iorder.vn/chinh-sach-cu", "//cdn.example.com/chinh-sach-cu", "mailto:a@b.vn", "#chinh-sach-cu", "", "/CHINH-SACH-CU"]) {
    assert.equal(rewriteLink(value, move), null, value);
  }
});

test("đường dẫn gốc / chỉ khớp chính nó, không khớp mọi đường dẫn", () => {
  assert.equal(rewriteLink("/", { from: "/", to: "/trang-chu" }), "/trang-chu");
  assert.equal(rewriteLink("/?utm=1", { from: "/", to: "/trang-chu" }), "/trang-chu?utm=1");
  assert.equal(rewriteLink("/news", { from: "/", to: "/trang-chu" }), null);
});

test("chỉ đổi ở trường liên kết (href/url/link/…Href/…Url), không đụng văn bản hay đơn vị giá", () => {
  const input = {
    title: "/chinh-sach-cu",
    period: "/chinh-sach-cu",
    blocks: [
      { href: "/chinh-sach-cu", label: "/chinh-sach-cu" },
      { actions: [{ label: "Xem", href: "/chinh-sach-cu?a=1" }], ctaHref: "/chinh-sach-cu", imageUrl: "/chinh-sach-cu", link: "/chinh-sach-cu" },
    ],
  };
  const { value, links } = rewriteLinksInJson(input, move);
  assert.equal(links, 5);
  assert.deepEqual(value, {
    title: "/chinh-sach-cu",
    period: "/chinh-sach-cu",
    blocks: [
      { href: "/chinh-sach-moi", label: "/chinh-sach-cu" },
      { actions: [{ label: "Xem", href: "/chinh-sach-moi?a=1" }], ctaHref: "/chinh-sach-moi", imageUrl: "/chinh-sach-moi", link: "/chinh-sach-moi" },
    ],
  });
  assert.equal(input.blocks[0].href, "/chinh-sach-cu", "không sửa bản gốc");
});

test("liên kết trong bài viết soạn thảo (mark link) được đổi", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Xem chính sách", marks: [{ type: "link", attrs: { href: "/chinh-sach-cu", target: null } }] }] }] };
  const { value, links } = rewriteLinksInJson(doc, move);
  assert.equal(links, 1);
  assert.equal(JSON.stringify(value).includes("/chinh-sach-moi"), true);
  assert.equal(JSON.stringify(value).includes("/chinh-sach-cu"), false);
});

test("không có liên kết nào khớp thì trả lại đúng đối tượng cũ", () => {
  const input = { blocks: [{ href: "/khac" }], note: null, count: 3 };
  const result = rewriteLinksInJson(input, move);
  assert.equal(result.links, 0);
  assert.equal(result.value, input);
  assert.equal(rewriteLinksInJson(null, move).value, null);
});

test("câu báo cho người vận hành", () => {
  assert.equal(describeLinkUpdates({ links: 0, places: [] }), "");
  assert.equal(describeLinkUpdates({ links: 3, places: [{ label: "Menu", items: 1, links: 1 }, { label: "Trang website", items: 2, links: 2 }] }), "Đã đổi 3 liên kết trỏ tới đường dẫn cũ sang đường dẫn mới (Menu: 1, Trang website: 2).");
});

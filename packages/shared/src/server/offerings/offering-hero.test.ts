import assert from "node:assert/strict";
import test from "node:test";

import { pageBlockInputSchema, type PageBlock } from "../pages/pages.contract";
import { offeringHeroBlock, withOfferingHero } from "./offering-hero";

const cover = "2304f978-1dd5-43ec-9e30-91db934955ff";
const extra = "8ea85cb4-1154-4552-8db8-4f1090ab1ee0";
const source = {
  title: "Phần mềm quản lý trạm sạc xe điện iOrder EV",
  summary: "Quản lý trạm sạc xe điện: theo dõi trụ sạc, phiên sạc và doanh thu.",
  coverMediaId: cover,
  content: { category: "Trạm sạc xe điện", bestFor: "Chủ trạm sạc, bãi đỗ xe", keyValue: "Theo dõi trụ sạc trên cùng một màn hình", appearance: { hero: { layout: "background" as const, height: "screen" as const, background: "default" as const, extraMediaIds: [extra] } } },
};

test("Phần đầu trang sản phẩm dựng thành thành phần hợp lệ từ các trường cố định", () => {
  const hero = offeringHeroBlock(source);
  assert.equal(pageBlockInputSchema.safeParse(hero).success, true);
  assert.equal(hero.data.title, source.title);
  assert.equal(hero.data.description, source.summary);
  assert.equal(hero.data.eyebrow, "Trạm sạc xe điện");
  assert.equal(hero.data.mediaId, cover);
  assert.deepEqual(hero.data.extraMediaIds, [extra]);
  assert.equal(hero.data.layout, "background");
  assert.deepEqual(hero.data.highlights.map((item) => item.title), ["Phù hợp với", "Giá trị nổi bật"]);
  assert.equal(hero.data.primaryAction?.href, "/lien-he");
  assert.equal(hero.data.secondaryAction, null);
});

test("Có bảng giá thì thêm nút Xem bảng giá và gán mã neo cho phần bảng giá", () => {
  const pricing = pageBlockInputSchema.parse({ type: "pricing", isEnabled: true, data: { eyebrow: null, title: "Bảng giá", description: null, note: null, plans: [{ name: "Cơ bản", price: "1.000đ", period: "/Năm", description: null, features: ["A"], action: { label: "Dùng thử", href: "/lien-he" }, highlighted: false, badge: null }] } });
  const blocks = withOfferingHero([pricing], source);
  assert.equal(blocks[0].type, "hero");
  assert.equal(blocks[0].type === "hero" && blocks[0].data.secondaryAction?.href, "#bang-gia");
  const anchored = blocks[1];
  assert.equal(anchored.type, "pricing");
  assert.equal(anchored.appearance?.anchor, "bang-gia");
});

test("Đã có phần đầu trang thì giữ nguyên, ý nổi bật dài được cắt gọn đúng giới hạn", () => {
  const hero = offeringHeroBlock(source);
  const existing: PageBlock[] = [hero];
  assert.equal(withOfferingHero(existing, source), existing);
  const long = offeringHeroBlock({ ...source, content: { ...source.content, bestFor: "A".repeat(400) } });
  assert.ok((long.data.highlights[0].note ?? "").length <= 160);
});

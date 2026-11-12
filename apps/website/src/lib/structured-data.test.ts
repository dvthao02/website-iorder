import assert from "node:assert/strict";
import { test } from "node:test";

import { articleJsonLd, breadcrumbJsonLd, productJsonLd, serializeJsonLd } from "./structured-data";

test("Breadcrumb dùng URL tuyệt đối và đánh số từ 1", () => {
  const data = breadcrumbJsonLd("https://iorder.vn", [{ name: "Trang chủ", path: "/" }, { name: "Tin tức", path: "/tin-tuc" }]);
  assert.deepEqual(data.itemListElement.map((item) => [item.position, item.item]), [[1, "https://iorder.vn/"], [2, "https://iorder.vn/tin-tuc"]]);
});

test("Article có ảnh tuyệt đối, ngày xuất bản ISO; thiếu ảnh thì bỏ trường", () => {
  const article = articleJsonLd("https://iorder.vn/", { title: "Bài A", description: null, path: "/tin-tuc/bai-a", imagePath: "/media/x.png", publishedAt: new Date("2026-10-17T03:00:00Z"), publisherName: "iOrder" });
  assert.deepEqual(article.image, ["https://iorder.vn/media/x.png"]);
  assert.equal(article.datePublished, "2026-10-17T03:00:00.000Z");
  assert.equal(articleJsonLd("https://iorder.vn", { title: "B", description: null, path: "/b", imagePath: null, publishedAt: null, publisherName: "iOrder" }).image, undefined);
});

test("Product chỉ có offers khi có giá; JSON không thể đóng thẻ script", () => {
  assert.equal(productJsonLd("https://iorder.vn", { name: "Máy in", description: null, path: "/thiet-bi/may-in", imagePath: null, priceVnd: 0, brand: "iOrder" }).offers, undefined);
  assert.equal(productJsonLd("https://iorder.vn", { name: "Máy in", description: null, path: "/thiet-bi/may-in", imagePath: null, priceVnd: 1500000, brand: "iOrder" }).offers?.price, 1500000);
  assert.ok(!serializeJsonLd({ name: "</script><script>" }).includes("</script>"));
});

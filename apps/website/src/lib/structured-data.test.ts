import assert from "node:assert/strict";
import { test } from "node:test";

import { articleJsonLd, breadcrumbJsonLd, faqItemsOfBlocks, faqPageJsonLd, productJsonLd, serializeJsonLd, lowestPlanPriceVnd, profilePageJsonLd, serviceJsonLd, softwareApplicationJsonLd, webPageJsonLd, webPageKindOf } from "./structured-data";

test("Loại trang theo trang hệ thống: Giới thiệu, Liên hệ, danh sách; còn lại là WebPage", () => {
  assert.equal(webPageKindOf("about"), "AboutPage");
  assert.equal(webPageKindOf("contact", "standard"), "ContactPage");
  assert.equal(webPageKindOf("listing-news", "listing"), "CollectionPage");
  assert.equal(webPageKindOf("terms", "standard"), "WebPage");
  assert.equal(webPageKindOf("khuyen-mai"), "WebPage");
});

test("WebPage thuộc WebSite chung, có ngôn ngữ và ngày sửa; chỉ AboutPage trỏ về tổ chức", () => {
  const page = webPageJsonLd("https://iorder.vn/", { kind: "AboutPage", name: "Về iOrder", description: "Giới thiệu", path: "/gioi-thieu", modifiedAt: new Date("2026-11-01T00:00:00Z") });
  assert.equal(page["@type"], "AboutPage");
  assert.equal(page["@id"], "https://iorder.vn/gioi-thieu#webpage");
  assert.deepEqual(page.isPartOf, { "@id": "https://iorder.vn/#website" });
  assert.deepEqual(page.about, { "@id": "https://iorder.vn/#organization" });
  assert.equal(page.dateModified, "2026-11-01T00:00:00.000Z");
  const plain = webPageJsonLd("https://iorder.vn", { name: "Liên hệ", description: null, path: "/lien-he", modifiedAt: new Date("không phải ngày") });
  assert.equal(plain["@type"], "WebPage");
  assert.equal(plain.about, undefined);
  assert.equal(plain.dateModified, undefined);
});

test("FAQPage chỉ gồm câu hỏi đang bật có đủ câu hỏi và trả lời; không có mục nào thì không dựng", () => {
  const faq = faqPageJsonLd("https://iorder.vn", "/ho-tro/faq", [
    { question: " Phần mềm có dùng offline không? ", answer: "Có." },
    { question: "Đã tắt", answer: "x", isEnabled: false },
    { question: "Thiếu trả lời", answer: "  " },
  ]);
  assert.equal(faq?.["@type"], "FAQPage");
  assert.equal(faq?.["@id"], "https://iorder.vn/ho-tro/faq#faq");
  assert.deepEqual(faq?.mainEntity, [{ "@type": "Question", name: "Phần mềm có dùng offline không?", acceptedAnswer: { "@type": "Answer", text: "Có." } }]);
  assert.equal(faqPageJsonLd("https://iorder.vn", "/x", []), null);
  assert.equal(faqPageJsonLd("https://iorder.vn", "/x", [{ question: "", answer: "a" }]), null);
});

test("Lấy câu hỏi từ các khối FAQ đang bật, bỏ khối khác loại, khối tắt và mục tắt", () => {
  const items = faqItemsOfBlocks([
    { type: "hero", data: { items: [{ question: "Không phải FAQ", answer: "x" }] } },
    { type: "faq", isEnabled: false, data: { items: [{ question: "Khối tắt", answer: "x" }] } },
    { type: "faq", data: { items: [{ question: "Một", answer: "a" }, { question: "Mục tắt", answer: "b", isEnabled: false }, { question: 5, answer: "c" }] } },
    { type: "faq", data: null },
    { type: "faq", data: { items: [{ question: "Hai", answer: "d" }] } },
  ]);
  assert.deepEqual(items.map((item) => item.question), ["Một", "Hai"]);
});

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

test("Article khai ngày sửa, chuyên mục, thẻ; tác giả và nhà xuất bản trỏ về cùng nút tổ chức; bỏ ngày sửa lệch trước ngày đăng", () => {
  const input = { title: "Bài A", description: null, path: "/tin-tuc/bai-a", imagePath: null, publishedAt: new Date("2026-10-17T03:00:00Z"), publisherName: "iOrder" };
  const article = articleJsonLd("https://iorder.vn", { ...input, modifiedAt: new Date("2026-11-01T00:00:00Z"), section: "Mẹo bán hàng", keywords: ["pos", "f&b"] });
  assert.equal(article.dateModified, "2026-11-01T00:00:00.000Z");
  assert.equal(article.articleSection, "Mẹo bán hàng");
  assert.equal(article.keywords, "pos, f&b");
  assert.equal(article.inLanguage, "vi-VN");
  assert.equal(article.publisher["@id"], "https://iorder.vn/#organization");
  assert.deepEqual(article.author, article.publisher);
  assert.equal(articleJsonLd("https://iorder.vn", { ...input, modifiedAt: new Date("2026-10-01T00:00:00Z") }).dateModified, undefined);
  assert.equal(articleJsonLd("https://iorder.vn", input).keywords, undefined);
});

test("Product và Service có URL tuyệt đối và trỏ về nút tổ chức", () => {
  const product = productJsonLd("https://iorder.vn", { name: "Máy in", description: null, path: "/thiet-bi/may-in", imagePath: null, priceVnd: 1500000, brand: "iOrder" });
  assert.equal(product.url, "https://iorder.vn/thiet-bi/may-in");
  assert.equal(product.offers?.seller["@id"], "https://iorder.vn/#organization");
  assert.equal(serviceJsonLd("https://iorder.vn", { name: "Cài đặt", description: null, path: "/dich-vu/cai-dat", imagePath: null, providerName: "iOrder" }).provider["@id"], "https://iorder.vn/#organization");
});

test("Product chỉ có offers khi có giá; JSON không thể đóng thẻ script", () => {
  assert.equal(productJsonLd("https://iorder.vn", { name: "Máy in", description: null, path: "/thiet-bi/may-in", imagePath: null, priceVnd: 0, brand: "iOrder" }).offers, undefined);
  assert.equal(productJsonLd("https://iorder.vn", { name: "Máy in", description: null, path: "/thiet-bi/may-in", imagePath: null, priceVnd: 1500000, brand: "iOrder" }).offers?.price, 1500000);
  assert.ok(!serializeJsonLd({ name: "</script><script>" }).includes("</script>"));
});

test("Product khai tình trạng hàng theo CMS: mặc định còn hàng, hết hàng/ngừng bán/đặt trước đúng URL schema.org", () => {
  const input = { name: "Máy in", description: null, path: "/thiet-bi/may-in", imagePath: null, priceVnd: 1500000, brand: "iOrder" };
  assert.equal(productJsonLd("https://iorder.vn", input).offers?.availability, "https://schema.org/InStock");
  assert.equal(productJsonLd("https://iorder.vn", { ...input, availability: null }).offers?.availability, "https://schema.org/InStock");
  assert.equal(productJsonLd("https://iorder.vn", { ...input, availability: "out_of_stock" }).offers?.availability, "https://schema.org/OutOfStock");
  assert.equal(productJsonLd("https://iorder.vn", { ...input, availability: "discontinued" }).offers?.availability, "https://schema.org/Discontinued");
  assert.equal(productJsonLd("https://iorder.vn", { ...input, availability: "pre_order" }).offers?.availability, "https://schema.org/PreOrder");
  assert.equal(productJsonLd("https://iorder.vn", { ...input, availability: "limited" }).offers?.availability, "https://schema.org/LimitedAvailability");
});

test("Article: tác giả khách là Person (chức danh, hồ sơ ngoài); nhà xuất bản vẫn là tổ chức; không có tác giả thì là tổ chức", () => {
  const input = { title: "Bài", description: null, path: "/tin-tuc/bai", imagePath: null, publishedAt: new Date("2026-10-17T03:00:00Z"), publisherName: "iOrder" };
  const guest = articleJsonLd("https://iorder.vn", { ...input, author: { name: " Nguyễn Văn An ", jobTitle: "Chuyên viên triển khai", profileUrl: "https://www.linkedin.com/in/an" } });
  assert.deepEqual(guest.author, { "@type": "Person", "@id": undefined, name: "Nguyễn Văn An", jobTitle: "Chuyên viên triển khai", url: "https://www.linkedin.com/in/an", sameAs: undefined });
  assert.equal(guest.publisher["@id"], "https://iorder.vn/#organization");
  assert.deepEqual(articleJsonLd("https://iorder.vn", { ...input, author: { name: "An" } }).author, { "@type": "Person", "@id": undefined, name: "An", jobTitle: undefined, url: undefined, sameAs: undefined });
  for (const author of [null, undefined, { name: "  " }]) assert.deepEqual(articleJsonLd("https://iorder.vn", { ...input, author }).author, { "@type": "Organization", "@id": "https://iorder.vn/#organization", name: "iOrder" });
});

test("Article: tác giả có trang riêng thì Person có @id và url trỏ về trang đó, hồ sơ ngoài là sameAs", () => {
  const input = { title: "Bài", description: null, path: "/tin-tuc/bai", imagePath: null, publishedAt: null, publisherName: "iOrder" };
  const author = articleJsonLd("https://iorder.vn/", { ...input, author: { name: "An", jobTitle: "Chuyên viên", pagePath: "/tac-gia/an", profileUrl: "https://www.linkedin.com/in/an" } }).author;
  assert.deepEqual(author, { "@type": "Person", "@id": "https://iorder.vn/tac-gia/an#person", name: "An", jobTitle: "Chuyên viên", url: "https://iorder.vn/tac-gia/an", sameAs: ["https://www.linkedin.com/in/an"] });
});

test("ProfilePage của tác giả: thuộc WebSite chung, Person là nội dung chính có @id khớp với Person trên bài viết", () => {
  const page = profilePageJsonLd("https://iorder.vn", { name: "Nguyễn Văn An", jobTitle: "Chuyên viên", bio: " 10 năm triển khai POS. ", path: "/tac-gia/nguyen-van-an", avatarPath: "/media/an.jpg", profileUrl: "https://www.linkedin.com/in/an", modifiedAt: new Date("2026-11-01T00:00:00Z") });
  assert.equal(page["@type"], "ProfilePage");
  assert.equal(page["@id"], "https://iorder.vn/tac-gia/nguyen-van-an#profilepage");
  assert.deepEqual(page.isPartOf, { "@id": "https://iorder.vn/#website" });
  assert.equal(page.dateModified, "2026-11-01T00:00:00.000Z");
  assert.deepEqual(page.mainEntity, { "@type": "Person", "@id": "https://iorder.vn/tac-gia/nguyen-van-an#person", name: "Nguyễn Văn An", jobTitle: "Chuyên viên", description: "10 năm triển khai POS.", image: "https://iorder.vn/media/an.jpg", url: "https://iorder.vn/tac-gia/nguyen-van-an", sameAs: ["https://www.linkedin.com/in/an"] });
  const bare = profilePageJsonLd("https://iorder.vn", { name: "An", jobTitle: null, bio: null, path: "/tac-gia/an", avatarPath: null, profileUrl: null });
  assert.equal(bare.mainEntity.image, undefined);
  assert.equal(bare.mainEntity.sameAs, undefined);
});

test("Giá thấp nhất từ bảng giá: chỉ đọc số rõ ràng, bỏ gói tắt, 'Liên hệ' và số không phải giá", () => {
  assert.equal(lowestPlanPriceVnd([{ price: "199.000đ" }, { price: "Từ 1.200.000 ₫" }, { price: "Liên hệ" }]), 199000);
  assert.equal(lowestPlanPriceVnd([{ price: "99.000đ", isEnabled: false }, { price: "299,000 VND" }]), 299000);
  assert.equal(lowestPlanPriceVnd([{ price: "Dùng thử 15 ngày" }, { price: "Miễn phí" }]), null);
  assert.equal(lowestPlanPriceVnd(null), null);
});

test("Phần mềm là SoftwareApplication, có giá khi đọc được và không bao giờ tự thêm đánh giá sao", () => {
  const app = softwareApplicationJsonLd("https://iorder.vn", { name: "Phần mềm quản lý bán hàng iOrder", description: "Mô tả", path: "/phan-mem/phan-mem-quan-ly-ban-hang-iorder", imagePath: "/media/a.png", publisherName: "iOrder", category: "Quản lý bán hàng", priceVnd: 199000 });
  assert.equal(app["@type"], "SoftwareApplication");
  assert.equal(app["@id"], "https://iorder.vn/phan-mem/phan-mem-quan-ly-ban-hang-iorder#software");
  assert.equal(app.applicationCategory, "BusinessApplication");
  assert.deepEqual(app.publisher, { "@type": "Organization", "@id": "https://iorder.vn/#organization", name: "iOrder" });
  assert.equal(app.offers?.price, 199000);
  assert.equal("aggregateRating" in app, false);
  assert.equal(softwareApplicationJsonLd("https://iorder.vn", { name: "A", description: null, path: "/phan-mem/a", imagePath: null, publisherName: "iOrder" }).offers, undefined);
});

test("Product chỉ khai thương hiệu khi có dữ liệu, không đoán là thương hiệu của iOrder", () => {
  const base = { name: "Máy POS Sunmi", description: null, path: "/thiet-bi/may-pos-sunmi", imagePath: null, priceVnd: 1000 };
  assert.deepEqual(productJsonLd("https://iorder.vn", { ...base, brand: "Sunmi" }).brand, { "@type": "Brand", name: "Sunmi" });
  assert.equal(productJsonLd("https://iorder.vn", { ...base, brand: null }).brand, undefined);
  assert.equal(productJsonLd("https://iorder.vn", { ...base, brand: "" }).brand, undefined);
  assert.equal(productJsonLd("https://iorder.vn", base).brand, undefined);
});

import assert from "node:assert/strict";
import test from "node:test";

import { countKeyword, matchKeyword, normalizeRelatedKeywords, seoChecks, seoGuide, seoPrepublishIssues, suggestFocusKeyword, suggestPageSeoDescription, suggestSeoDescription, suggestSeoTitle, trimToLimit, truncateAtWord, withBrand } from "./seo";

test("cắt ở ranh giới từ và thêm dấu …", () => {
  assert.equal(truncateAtWord("Ngắn gọn", 60), "Ngắn gọn");
  const cut = truncateAtWord("Phần mềm quản lý nhà hàng giúp chủ quán theo dõi doanh thu từng ca làm việc", 40);
  assert.ok(cut.length <= 40, cut);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("  "));
  assert.equal(suggestSeoTitle("  Tiêu   đề  "), "Tiêu đề");
});

test("mô tả gợi ý ưu tiên tóm tắt, rồi đoạn văn đầu tiên", () => {
  const content = { blocks: [{ type: "checklist", heading: "Danh sách", items: ["A"] }, { type: "paragraph", text: "  Đoạn   đầu tiên. " }] };
  assert.equal(suggestSeoDescription("Tóm tắt bài", content), "Tóm tắt bài");
  assert.equal(suggestSeoDescription("   ", content), "Đoạn đầu tiên.");
  assert.equal(suggestSeoDescription(null, { blocks: [] }), null);
  assert.ok((suggestSeoDescription("x ".repeat(200)) ?? "").length <= 155);
});

test("kiểm tra SEO báo đúng điểm thiếu", () => {
  const checks = Object.fromEntries(seoChecks({ title: "Ngắn", seoTitle: "", seoDescription: "", excerpt: "", slug: "mot-hai-ba-bon-nam-sau-bay-tam-chin", hasCover: false, content: { blocks: [{ type: "paragraph", text: "ít chữ" }] } }).map((check) => [check.id, check.ok]));
  assert.deepEqual(checks, { title: false, description: false, excerpt: false, cover: false, length: false, slug: false });
  const good = seoChecks({ title: "Phần mềm quản lý nhà hàng cho chủ quán bận rộn", seoTitle: "", seoDescription: "", excerpt: "Hướng dẫn chọn phần mềm quản lý nhà hàng phù hợp quy mô, theo dõi doanh thu và kho theo thời gian thực.", slug: "phan-mem-quan-ly-nha-hang", hasCover: true, content: { blocks: [{ type: "paragraph", text: "từ ".repeat(320) }] } });
  assert.ok(good.every((check) => check.ok), JSON.stringify(good.filter((check) => !check.ok)));
});

test("Mô tả tự động bỏ qua các dòng nhãn ngắn ở đầu bài (bài nhập từ Word), lấy đoạn văn thật đầu tiên", () => {
  const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
  const doc = { type: "doc", content: [p("Bán hàng"), p("Hướng dẫn sử dụng"), p("Màn hình Bán hàng là giao diện trung tâm hỗ trợ nhân viên tạo đơn, thanh toán và in hóa đơn nhanh.")] };
  assert.equal(suggestSeoDescription(null, { version: 2, doc } as never), "Màn hình Bán hàng là giao diện trung tâm hỗ trợ nhân viên tạo đơn, thanh toán và in hóa đơn nhanh.");
  // Không có đoạn nào đủ dài thì vẫn dùng đoạn có chữ đầu tiên.
  assert.equal(suggestSeoDescription(null, { version: 2, doc: { type: "doc", content: [p("Ngắn"), p("Cũng ngắn")] } } as never), "Ngắn");
});

test("Mô tả tự động cho Trang: lấy đoạn đủ dài đầu tiên theo thứ tự trang, bỏ khối tắt, nhận cả nội dung soạn thảo", () => {
  const long = "iOrder là nền tảng quản lý bán hàng cho nhà hàng, quán cà phê và cửa hàng bán lẻ, dùng được trên mọi thiết bị.";
  const hero = { type: "hero", isEnabled: true, data: { title: "Giới thiệu", description: "Ngắn" } };
  const text = { type: "rich_text", isEnabled: true, data: { heading: null, body: long } };
  // Phần đầu trang chỉ có dòng ngắn: ưu tiên đoạn đủ dài ở khối sau.
  assert.equal(suggestPageSeoDescription([hero, text]), long);
  // Chỉ có đoạn ngắn thì vẫn dùng.
  assert.equal(suggestPageSeoDescription([hero]), "Ngắn");
  // Khối tắt bị bỏ qua; không có chữ thì null.
  assert.equal(suggestPageSeoDescription([{ ...text, isEnabled: false }]), null);
  assert.equal(suggestPageSeoDescription([{ type: "stats", data: { items: [] } }]), null);
  assert.equal(suggestPageSeoDescription(undefined), null);
  const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: long }] }] };
  assert.equal(suggestPageSeoDescription([{ type: "rich_text", data: { heading: null, body: doc } }]), long);
  assert.ok((suggestPageSeoDescription([{ type: "hero", data: { description: "từ ".repeat(200) } }]) ?? "").length <= 155);
});

const richParagraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const richHeading = (text: string) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const richImage = (alt: string | null) => ({ type: "image", attrs: { src: "/media/a.png", alt, title: null, width: 100, align: "center" } });
const byId = (checks: ReturnType<typeof seoChecks>) => Object.fromEntries(checks.map((check) => [check.id, check.ok]));

test("Đếm từ khóa theo cụm nguyên vẹn, không phân biệt hoa thường, không tính khi nằm giữa từ khác", () => {
  assert.equal(countKeyword("Phần mềm quản lý nhà hàng: phần mềm QUẢN LÝ nhà hàng tốt nhất", "phần mềm quản lý nhà hàng"), 2);
  assert.equal(countKeyword("Máy in hóa đơn, máy in bếp", "máy in"), 2);
  assert.equal(countKeyword("Đăng bài post lên website", "pos"), 0);
  assert.equal(countKeyword("Từ khóa ở cuối: pos", "pos"), 1);
  assert.equal(countKeyword("bất kỳ", "  "), 0);
});

test("Không có từ khóa chính thì không có mục kiểm tra từ khóa, kết quả cũ giữ nguyên", () => {
  const input = { title: "Phần mềm quản lý nhà hàng cho chủ quán bận rộn", seoTitle: "", seoDescription: "", excerpt: "Hướng dẫn chọn phần mềm quản lý nhà hàng phù hợp quy mô, theo dõi doanh thu và kho theo thời gian thực.", slug: "phan-mem-quan-ly-nha-hang", hasCover: true };
  assert.deepEqual(seoChecks({ ...input, content: { blocks: [{ type: "paragraph", text: "từ ".repeat(320) }] } }).map((check) => check.id), ["title", "description", "excerpt", "cover", "length", "slug"]);
  assert.deepEqual(seoChecks({ ...input, focusKeyword: "   " }).map((check) => check.id), ["title", "description", "excerpt", "cover", "length", "slug"]);
});

test("Từ khóa chính: tiêu đề, mô tả, đường dẫn (so không dấu); không có nội dung thì chỉ kiểm ba mục này", () => {
  const base = { title: "Phần mềm quản lý nhà hàng", seoTitle: "", seoDescription: "Chọn phần mềm quản lý nhà hàng theo quy mô.", excerpt: "", slug: "phan-mem-quan-ly-nha-hang", hasCover: false, focusKeyword: "phần mềm quản lý nhà hàng" };
  const ok = seoChecks(base).filter((check) => check.id.startsWith("kw_"));
  assert.deepEqual(ok.map((check) => [check.id, check.ok, check.partial]), [["kw_title", true, undefined], ["kw_description", true, undefined], ["kw_slug", true, undefined]]);
  const bad = seoChecks({ ...base, title: "Giải pháp F&B", seoDescription: "Mô tả khác.", slug: "giai-phap-fb" }).filter((check) => check.id.startsWith("kw_"));
  // Tiêu đề và mô tả thiếu cụm thì chưa đạt; đường dẫn thiếu cụm chỉ là gợi ý (đạt kèm cờ partial).
  assert.deepEqual(bad.map((check) => [check.ok, check.partial]), [[false, undefined], [false, undefined], [true, true]]);
  assert.match(bad[0].message, /“phần mềm quản lý nhà hàng”/);
  // Từ khóa là một đoạn liền của đường dẫn thì khớp (bỏ dấu); đường dẫn viết dính chữ ("quanly") thì không.
  assert.equal(byId(seoChecks({ ...base, focusKeyword: "quản lý nhà" })).kw_slug, true);
  const joined = seoChecks({ ...base, slug: "phan-mem-quanly-nha-hang" }).find((check) => check.id === "kw_slug")!;
  assert.deepEqual([joined.ok, joined.partial], [true, true]);
  assert.match(joined.message, /Bài đã đăng: cứ để nguyên/);
});

test("Từ khóa chính trong bài: đoạn mở đầu, đề mục và mật độ 0,5–2,5%", () => {
  const keyword = "quản lý kho";
  const filler = (words: number) => "từ ".repeat(words).trim();
  const article = (parts: unknown[]) => ({ version: 2 as const, doc: { type: "doc" as const, content: parts as never[] } });
  const input = { title: "Cách quản lý kho cho nhà hàng nhỏ", seoTitle: "", seoDescription: "", excerpt: "", slug: "quan-ly-kho", hasCover: false, focusKeyword: keyword };
  // 200 từ, từ khóa 3 lần (3×3/200 = 4,5% → quá nhiều); mở đầu và đề mục có từ khóa.
  const stuffed = seoChecks({ ...input, content: article([richParagraph(`Cách quản lý kho hiệu quả. ${filler(60)}`), richHeading("Quản lý kho theo ca"), richParagraph(`quản lý kho ${filler(60)} quản lý kho ${filler(60)}`)]) });
  const stuffedIds = byId(stuffed);
  assert.equal(stuffedIds.kw_intro, true);
  assert.equal(stuffedIds.kw_heading, true);
  assert.equal(stuffedIds.kw_density, false);
  assert.match(stuffed.find((check) => check.id === "kw_density")!.message, /nhồi từ khóa/);
  // 400 từ, từ khóa 2 lần ≈ 1,5% → hợp lý.
  const fine = byId(seoChecks({ ...input, content: article([richParagraph(`Giới thiệu về quản lý kho. ${filler(190)}`), richHeading("Các bước"), richParagraph(`Bước đầu của quản lý kho. ${filler(190)}`)]) }));
  assert.equal(fine.kw_density, true);
  // Bài ngắn (< 100 từ) không đo mật độ; thiếu từ khóa ở mở đầu/đề mục bị báo.
  const short = byId(seoChecks({ ...input, content: article([richParagraph("Mở đầu không nhắc từ khóa."), richHeading("Đề mục khác")]) }));
  assert.equal(short.kw_intro, false);
  assert.equal(short.kw_heading, false);
  assert.ok(!("kw_density" in short));
});

test("Bài soạn thảo: ảnh thiếu alt và bài dài thiếu đề mục bị báo; bài ngắn hay nội dung dạng khối không bị áp dụng", () => {
  const base = { title: "Tiêu đề bài viết đủ dài cho Google nhìn", seoTitle: "", seoDescription: "", excerpt: "Tóm tắt.", slug: "bai-viet", hasCover: true };
  const long = "từ ".repeat(320).trim();
  const withImages = byId(seoChecks({ ...base, content: { version: 2, doc: { type: "doc", content: [richParagraph("Ngắn."), richImage("Ảnh màn hình bán hàng"), richImage(" ")] } } as never }));
  assert.equal(withImages.images_alt, false);
  assert.ok(!("headings" in withImages));
  assert.equal(byId(seoChecks({ ...base, content: { version: 2, doc: { type: "doc", content: [richImage("Có alt")] } } as never })).images_alt, true);
  assert.equal(byId(seoChecks({ ...base, content: { version: 2, doc: { type: "doc", content: [richParagraph(long)] } } as never })).headings, false);
  assert.equal(byId(seoChecks({ ...base, content: { version: 2, doc: { type: "doc", content: [richHeading("Mục 1"), richParagraph(long)] } } as never })).headings, true);
  const blocks = seoChecks({ ...base, content: { blocks: [{ type: "paragraph", text: long }] } }).map((check) => check.id);
  assert.ok(!blocks.includes("headings") && !blocks.includes("images_alt"));
});

test("Gợi ý cụm từ khách hay gõ từ tiêu đề: cắt ở dấu phân tách và từ nối, tối đa 6 từ, chữ thường", () => {
  assert.equal(suggestFocusKeyword("Phần mềm quản lý nhà hàng cho chủ quán bận rộn"), "phần mềm quản lý nhà hàng");
  assert.equal(suggestFocusKeyword("Cách quản lý kho cho nhà hàng nhỏ"), "cách quản lý kho");
  assert.equal(suggestFocusKeyword("Máy in hóa đơn K80: giá, thông số và nơi mua"), "máy in hóa đơn k80");
  assert.equal(suggestFocusKeyword("Hướng dẫn cài đặt máy in bếp qua mạng LAN cho quán"), "hướng dẫn cài đặt máy in");
  assert.equal(suggestFocusKeyword("  "), "");
  assert.equal(suggestFocusKeyword("Vi"), "");
});

test("Tóm tắt SEO cho người không rành: điểm, trạng thái, tối đa ba việc theo thứ tự nên làm", () => {
  const input = { title: "Phần mềm quản lý nhà hàng cho chủ quán bận rộn", seoTitle: "", seoDescription: "", excerpt: "Hướng dẫn chọn phần mềm quản lý nhà hàng phù hợp quy mô, theo dõi doanh thu và kho theo thời gian thực.", slug: "phan-mem-quan-ly-nha-hang", hasCover: true, content: { blocks: [{ type: "paragraph", text: "từ ".repeat(320) }] } };
  const ready = seoGuide(input);
  assert.deepEqual([ready.status, ready.passed, ready.total, ready.todo.length, ready.hidden], ["ready", 6, 6, 0, 0]);
  assert.equal(ready.headline, "Sẵn sàng lên Google");
  // Thiếu ảnh bìa, tóm tắt, nội dung ngắn, mô tả quá ngắn: nhiều việc → "needs"; chỉ hiện 3 việc, mô tả/tiêu đề lên trước.
  const weak = seoGuide({ ...input, title: "Ngắn", excerpt: "", seoDescription: "Mô tả ngắn.", hasCover: false, content: { blocks: [{ type: "paragraph", text: "ít chữ" }] } });
  assert.equal(weak.status, "needs");
  assert.deepEqual(weak.todo.map((item) => item.id), ["description", "title", "cover"]);
  assert.equal(weak.hidden, weak.total - weak.passed - 3);
  assert.match(weak.headline, /^Cần bổ sung \d việc/);
  // Còn một việc nhỏ → "almost".
  const almost = seoGuide({ ...input, hasCover: false });
  assert.deepEqual([almost.status, almost.todo.map((item) => item.id)], ["almost", ["cover"]]);
  assert.equal(almost.headline, "Gần xong, còn 1 việc nhỏ");
  // checkIds giới hạn mục tính điểm (Trang không có ảnh bìa/tóm tắt).
  assert.equal(seoGuide({ ...input, hasCover: false }, { checkIds: ["title", "description"] }).status, "ready");
});

test("Rút gọn để lưu: không thêm …, cắt ở dấu ngăn cách rồi ranh giới từ, bỏ từ nối lủng lẳng", () => {
  const long = "Trang chủ: iOrder - Phần mềm, hạ tầng và giải pháp chuyển đổi số cho doanh nghiệp";
  assert.equal(trimToLimit(long, 60), "Trang chủ: iOrder - Phần mềm, hạ tầng", "cắt trước từ nối “và”, giữ trọn cụm danh từ");
  // Có độ dài tối thiểu: dấu phẩy ở ký tự 28 bị bỏ qua khi yêu cầu giữ ít nhất 30.
  assert.ok(trimToLimit("Trang chủ: iOrder - Phần mềm, hạ tầng giải pháp chuyển đổi số cho doanh nghiệp", 60, { min: 30 }).length >= 30);
  assert.equal(trimToLimit("Tiêu đề SEO rất dài cho trang phần mềm quản lý nhà hàng của iOrder năm 2026", 60), "Tiêu đề SEO rất dài cho trang phần mềm quản lý nhà hàng");
  assert.equal(trimToLimit("  Ngắn   gọn  ", 60), "Ngắn gọn");
  for (const text of [long, "x ".repeat(100), "Từ ".repeat(50)]) {
    const out = trimToLimit(text, 60);
    assert.ok(out.length <= 60 && !out.includes("…") && !/[\s,.;:–—|-]$/.test(out), out);
  }
});

test("Rút gọn mô tả ưu tiên kết thúc ở câu trọn vẹn khi câu đó đủ dài", () => {
  const sentence = "Phần mềm quản lý bán hàng cho quán cà phê, nhà hàng và cửa hàng bán lẻ, dùng được trên mọi thiết bị.";
  const description = `${sentence} Quản lý kho, báo cáo doanh thu theo ca, nhập xuất hàng và công nợ nhà cung cấp trong một nơi.`;
  assert.equal(trimToLimit(description, 155, { sentence: true }), sentence);
  // Câu đầu quá ngắn (< 60% giới hạn) thì cắt ở ranh giới từ như bình thường.
  const shortFirst = `Ngắn. ${"một câu dài không có dấu chấm nào cả ".repeat(8)}`;
  const out = trimToLimit(shortFirst, 155, { sentence: true });
  assert.ok(out.length <= 155 && out.length > 100 && !out.includes("…"));
});

test("Gợi ý tiêu đề SEO không còn thêm …; withBrand chỉ thêm | iOrder khi tiêu đề chưa có thương hiệu", () => {
  assert.equal(suggestSeoTitle("  Tiêu   đề  "), "Tiêu đề");
  assert.ok(!suggestSeoTitle("Giải pháp quản lý chuỗi nhà hàng và quán cà phê cho chủ doanh nghiệp vừa và nhỏ").includes("…"));
  assert.equal(withBrand("Giới thiệu"), "Giới thiệu | iOrder");
  assert.equal(withBrand("Trang chủ: iOrder - Phần mềm"), "Trang chủ: iOrder - Phần mềm");
  assert.equal(withBrand("IORDER POS"), "IORDER POS");
  // Thêm thương hiệu mà vượt 60 ký tự thì giữ nguyên tiêu đề: Google cắt cuối tiêu đề, mất phần có nghĩa.
  const nearLimit = "Ưu đãi tháng này: đăng ký gói năm tặng máy in hóa đơn";
  assert.equal(withBrand(nearLimit), nearLimit);
  assert.equal(withBrand("Ưu đãi tháng này: đăng ký gói năm tặng máy in"), "Ưu đãi tháng này: đăng ký gói năm tặng máy in | iOrder");
});

test("Nút sửa nhanh chỉ có khi máy làm đúng được: rút gọn tiêu đề/mô tả quá dài; không tự ghép từ khóa vào tiêu đề", () => {
  const base = { title: "Phần mềm quản lý nhà hàng", seoTitle: "", seoDescription: "", excerpt: "", slug: "phan-mem", hasCover: true };
  const longTitle = seoGuide({ ...base, seoTitle: "Tiêu đề SEO rất dài cho trang phần mềm quản lý nhà hàng của iOrder năm 2026" }).todo.find((item) => item.id === "title");
  assert.equal(longTitle?.fix?.field, "seoTitle");
  assert.ok(longTitle!.fix!.value.length <= 60 && !longTitle!.fix!.value.includes("…"));
  const longDescription = seoGuide({ ...base, seoDescription: "x ".repeat(100) }).todo.find((item) => item.id === "description");
  assert.equal(longDescription?.fix?.field, "seoDescription");
  assert.ok(longDescription!.fix!.value.length <= 155 && !longDescription!.fix!.value.includes("…"));
  // Mô tả quá ngắn hay thiếu thì cần người viết: không có nút.
  assert.equal(seoGuide({ ...base, seoDescription: "Mô tả ngắn." }).todo.find((item) => item.id === "description")?.fix, undefined);
  // Thiếu từ khóa trong tiêu đề: báo việc nhưng không có nút (ghép máy móc cho ra tiêu đề rác như "Iorder.vn: Trang chủ: iOrder - …").
  const noKeyword = seoGuide({ ...base, title: "Trang chủ: iOrder - Phần mềm, hạ tầng và giải pháp", focusKeyword: "iorder.vn" }).todo.find((item) => item.id === "kw_title");
  assert.ok(noKeyword);
  assert.equal(noKeyword.fix, undefined);
  assert.ok(!seoGuide({ ...base, focusKeyword: "quản lý nhà hàng" }).todo.some((item) => item.id === "kw_title"));
});

test("Bấm sửa nhanh xong thì chính mục đó phải đạt: kết quả rút gọn không rơi xuống dưới mức tối thiểu", () => {
  const base = { title: "Trang chủ", seoTitle: "", seoDescription: "", excerpt: "", slug: "home", hasCover: false };
  const titles = ["Trang chủ: iOrder - Phần mềm, hạ tầng và giải pháp chuyển đổi số cho doanh nghiệp", "Phần mềm quản lý nhà hàng, quán cà phê và cửa hàng bán lẻ cho chủ doanh nghiệp vừa và nhỏ", "Một tiêu đề dài không có dấu ngăn cách nào cả nhưng vẫn phải rút gọn được cho vừa giới hạn của Google"];
  for (const seoTitle of titles) {
    const fix = seoGuide({ ...base, seoTitle }).todo.find((item) => item.id === "title")?.fix;
    assert.ok(fix, seoTitle);
    assert.ok(fix.value.length >= 30 && fix.value.length <= 60, `${fix.value} (${fix.value.length})`);
    assert.equal(seoChecks({ ...base, seoTitle: fix.value }).find((check) => check.id === "title")?.ok, true, fix.value);
  }
  const sentenceDescription = "Phần mềm quản lý bán hàng cho quán cà phê, nhà hàng và cửa hàng bán lẻ. Quản lý kho, báo cáo doanh thu theo ca, nhập xuất hàng, công nợ nhà cung cấp và nhân viên trong một nơi duy nhất, dùng được trên điện thoại.";
  const descriptions = [sentenceDescription, "Mô tả dài không có dấu chấm câu nào nhưng vẫn phải được rút gọn cho vừa giới hạn một trăm sáu mươi ký tự của Google để hiển thị đủ".repeat(2)];
  for (const seoDescription of descriptions) {
    const fix = seoGuide({ ...base, seoDescription }).todo.find((item) => item.id === "description")?.fix;
    assert.ok(fix, seoDescription);
    assert.ok(fix.value.length >= 70 && fix.value.length <= 160, `${fix.value} (${fix.value.length})`);
    assert.equal(seoChecks({ ...base, seoDescription: fix.value }).find((check) => check.id === "description")?.ok, true, fix.value);
  }
});

test("Nhắc SEO trước khi đăng chỉ gồm việc đáng xử lý: tiêu đề, mô tả, từ khóa, alt ảnh; không nhắc ảnh bìa, tóm tắt, độ dài, đường dẫn", () => {
  const good = { title: "Phần mềm quản lý nhà hàng cho chủ quán bận rộn", seoTitle: "", seoDescription: "", excerpt: "Hướng dẫn chọn phần mềm quản lý nhà hàng phù hợp quy mô, theo dõi doanh thu và kho theo thời gian thực.", slug: "phan-mem-quan-ly-nha-hang", hasCover: true, content: { blocks: [{ type: "paragraph", text: "từ ".repeat(320) }] } };
  assert.deepEqual(seoPrepublishIssues(good), []);
  // Thiếu ảnh bìa, tóm tắt, nội dung ngắn, đường dẫn dài: đã có nhắc riêng hoặc chỉ là gợi ý nên không đưa vào.
  assert.deepEqual(seoPrepublishIssues({ ...good, hasCover: false, excerpt: "", slug: "mot-hai-ba-bon-nam-sau-bay-tam-chin", content: { blocks: [{ type: "paragraph", text: "ít chữ" }] } }).map((check) => check.id), ["description"]);
  // Từ khóa đã chọn mà thiếu ở tiêu đề/mô tả thì nhắc; chưa chọn từ khóa thì không có mục từ khóa.
  assert.deepEqual(seoPrepublishIssues({ ...good, focusKeyword: "máy in bếp" }).map((check) => check.id), ["kw_title", "kw_description"]);
  const withImage = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "Bài có ảnh." }] }, { type: "image", attrs: { src: "/media/a.png", alt: null, title: null, width: 100, align: "center" } }] };
  assert.deepEqual(seoPrepublishIssues({ ...good, content: { version: 2, doc: withImage } as never }).map((check) => check.id), ["images_alt"]);
});

test("Khớp từ khóa: nguyên cụm, gần khớp (≥ 60% số từ, không cần liền nhau) hoặc không khớp", () => {
  const keyword = "phần mềm quản lý bán hàng";
  assert.equal(matchKeyword("Giới thiệu phần mềm quản lý bán hàng iOrder", keyword), "exact");
  // Ví dụ thực tế: bỏ hai từ "quản lý" vẫn là cùng ý định tìm kiếm.
  assert.equal(matchKeyword("Phần mềm bán hàng cho nhà hàng, cà phê và bán lẻ", keyword), "partial");
  assert.equal(matchKeyword("Bán hàng và quản lý kho bằng phần mềm", keyword), "partial", "không cần đúng thứ tự");
  assert.equal(matchKeyword("Máy in hóa đơn nhiệt cho quầy thu ngân", keyword), "none");
  // Ngưỡng 60%: cụm 3 từ cần 2, cụm 4 từ cần 3; cụm một từ chỉ có nguyên cụm hoặc không.
  assert.equal(matchKeyword("Máy in hóa đơn", "máy in bếp"), "partial", "2/3 số từ");
  assert.equal(matchKeyword("Máy in bếp", "máy in hóa đơn"), "none", "2/4 số từ chưa đủ 60%");
  assert.equal(matchKeyword("Máy chấm công", "máy in"), "none");
  assert.equal(matchKeyword("Đăng bài post", "pos"), "none");
  assert.equal(matchKeyword("Bất kỳ", ""), "none");
});

test("Mô tả, đoạn mở đầu, đề mục: gần khớp vẫn đạt (kèm gợi ý nhỏ); tiêu đề giữ chặt, đường dẫn chỉ là gợi ý", () => {
  const base = { title: "Phần mềm bán hàng iOrder cho nhà hàng", seoTitle: "", seoDescription: "Phần mềm bán hàng cho nhà hàng, cà phê và bán lẻ: gọi món, thu ngân, kho, nhân viên và báo cáo trên một nền tảng.", excerpt: "", slug: "phan-mem-ban-hang", hasCover: true, focusKeyword: "phần mềm quản lý bán hàng" };
  const byId = Object.fromEntries(seoChecks(base).map((check) => [check.id, check]));
  assert.deepEqual([byId.kw_description.ok, byId.kw_description.partial], [true, true]);
  assert.match(byId.kw_description.message, /viết đủ cả cụm một lần ở ô “Mô tả SEO”/);
  assert.equal(byId.kw_title.ok, false, "tiêu đề gần khớp chưa đạt");
  assert.match(byId.kw_title.message, /Sửa ở ô “Tiêu đề SEO”: viết đủ cả cụm/);
  assert.equal(byId.kw_slug.ok, true, "đường dẫn chỉ là gợi ý, không bắt buộc");
  // Nguyên cụm thì đạt hẳn, không còn cờ partial.
  const exact = seoChecks({ ...base, seoDescription: "Phần mềm quản lý bán hàng cho nhà hàng, cà phê và bán lẻ: gọi món, thu ngân, kho và báo cáo trên một nền tảng." }).find((check) => check.id === "kw_description")!;
  assert.deepEqual([exact.ok, exact.partial], [true, undefined]);
  // Không khớp: chưa đạt.
  assert.equal(seoChecks({ ...base, seoDescription: "Máy in hóa đơn nhiệt cho quầy thu ngân, in nhanh và bền, bảo hành mười hai tháng." }).find((check) => check.id === "kw_description")!.ok, false);
});

const filler = (count: number) => "từ ".repeat(count).trim();
const bodyOf = (...parts: string[]) => ({ blocks: [{ type: "paragraph", text: parts.join(" ") }] });

test("Chuẩn hóa cụm liên quan: bỏ trống, trùng (không phân biệt hoa thường) và trùng cụm chính; tối đa 4", () => {
  assert.deepEqual(normalizeRelatedKeywords(["  phần mềm POS ", "", "Phần mềm pos", "máy in bếp", "phần mềm bán hàng", "a", "b", "c"], "Phần mềm bán hàng"), ["phần mềm POS", "máy in bếp", "a", "b"]);
  assert.deepEqual(normalizeRelatedKeywords(undefined), []);
  assert.deepEqual(normalizeRelatedKeywords(null), []);
});

test("Cụm liên quan: chỉ kiểm khi bài đủ dài; có thì đạt, gần khớp là gợi ý nhỏ, không có thì chưa đạt, lặp nhiều thì báo nhồi từ khóa", () => {
  const base = { title: "Phần mềm quản lý nhà hàng cho chủ quán bận rộn", seoTitle: "", seoDescription: "", excerpt: "Hướng dẫn chọn phần mềm quản lý nhà hàng phù hợp quy mô, theo dõi doanh thu và kho theo thời gian thực.", slug: "phan-mem-quan-ly-nha-hang", hasCover: true };
  const related = ["phần mềm POS", "tính tiền nhà hàng", "máy in bếp"];
  // Bài ngắn (< 100 từ): không đủ để đánh giá nên không tạo mục nào.
  assert.deepEqual(seoChecks({ ...base, content: bodyOf("phần mềm POS", filler(40)), relatedKeywords: related }).filter((check) => check.id.startsWith("kw_related")), []);
  // Không có nội dung (Trang): không tạo mục.
  assert.deepEqual(seoChecks({ ...base, relatedKeywords: related }).filter((check) => check.id.startsWith("kw_related")), []);
  const content = bodyOf("Dùng phần mềm POS cho quán.", filler(150), "Tính toán tiền nhà hàng mỗi ca.", filler(60));
  const checks = Object.fromEntries(seoChecks({ ...base, content, relatedKeywords: related }).filter((check) => check.id.startsWith("kw_related")).map((check) => [check.id, check]));
  assert.deepEqual(Object.keys(checks), ["kw_related_1", "kw_related_2", "kw_related_3"]);
  assert.equal(checks.kw_related_1.ok, true);
  assert.match(checks.kw_related_1.message, /xuất hiện 1 lần/);
  assert.deepEqual([checks.kw_related_2.ok, checks.kw_related_2.partial], [true, true], "'tính tiền nhà hàng' chỉ gần khớp ('tính', 'nhà', 'hàng' có, 'tiền' ở nơi khác)");
  assert.equal(checks.kw_related_3.ok, false);
  assert.match(checks.kw_related_3.message, /chưa xuất hiện trong bài/);
  // Lặp quá nhiều (≥ 2,5% số từ): báo nhồi từ khóa.
  const stuffed = bodyOf(...Array.from({ length: 6 }, () => `phần mềm POS ${filler(20)}`));
  const over = seoChecks({ ...base, content: stuffed, relatedKeywords: ["phần mềm POS"] }).find((check) => check.id === "kw_related_1")!;
  assert.equal(over.ok, false);
  assert.match(over.message, /nhồi từ khóa/);
  // Cụm liên quan trùng cụm chính không tạo mục riêng.
  assert.deepEqual(seoChecks({ ...base, content, focusKeyword: "phần mềm POS", relatedKeywords: ["Phần mềm pos"] }).filter((check) => check.id.startsWith("kw_related")), []);
});

test("Tóm tắt SEO: gợi ý nhỏ cho mục gần khớp (đã đạt), tối đa 2; cụm liên quan chưa có nằm trong việc nên làm", () => {
  const base = { title: "Phần mềm quản lý bán hàng iOrder cho nhà hàng", seoTitle: "", seoDescription: "Phần mềm bán hàng cho nhà hàng, cà phê và bán lẻ: gọi món, thu ngân, kho, nhân viên và báo cáo trên một nền tảng.", excerpt: "x", slug: "phan-mem-quan-ly-ban-hang", hasCover: true, focusKeyword: "phần mềm quản lý bán hàng", content: bodyOf("Phần mềm quản lý bán hàng cho quán.", filler(300)) };
  const guide = seoGuide(base);
  assert.equal(guide.status, "ready", "gần khớp không làm mất trạng thái sẵn sàng");
  assert.deepEqual(guide.hints.map((hint) => hint.id), ["kw_description"]);
  assert.equal(guide.todo.length, 0);
  const withRelated = seoGuide({ ...base, relatedKeywords: ["máy in bếp"] });
  assert.ok(withRelated.todo.some((item) => item.id === "kw_related_1"));
});

// Dữ liệu mẫu đầy đủ trường cho môi trường dev: mọi module có nội dung để website hiển thị trọn vẹn,
// nội dung thật sẽ sửa sau trong CMS. Chạy lại an toàn: chỉ tạo mục chưa có (theo slug/tên);
// cập nhật 8 sản phẩm/dịch vụ, trang hệ thống và chỉ điền các ô cài đặt đang trống (không ghi đè dữ liệu thật).
// Ảnh lấy từ SEED_MEDIA_ROOT (mặc định ../storage/media/seed). Không dùng cho production.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { equipmentGroups, mediaAssets, offerings, partners, posts, salesEquipment, supportDownloads, testimonials, users } from "../packages/core/src/db/schema";
import { editAdminMedia, uploadAdminMedia } from "../packages/core/src/server/media/media.service";
import { writeTaxonomy } from "../packages/core/src/server/taxonomy/taxonomy.service";
import { findCategoryBySlug, findTagBySlug } from "../packages/core/src/server/taxonomy/taxonomy.repository";
import { createAdminPost } from "../packages/core/src/server/posts/posts.service";
import { getAdminOfferingById, updateAdminOffering } from "../packages/core/src/server/offerings/offerings.service";
import { writeEquipment } from "../packages/core/src/server/equipment/equipment.service";
import { writeSupporting } from "../packages/core/src/server/supporting/supporting.service";
import { createAdminSupportDownload } from "../packages/core/src/server/support/support-downloads.service";
import { getAdminPageBySlug, saveAdminPage } from "../packages/core/src/server/pages/pages.service";
import { getSiteProfileWithVersion, updateSiteProfile } from "../packages/core/src/server/settings/profile.service";
import { getPublishingConfigWithVersion, updatePublishingConfig } from "../packages/core/src/server/settings/publishing.service";
import { getExternalLinksWithVersion, updateExternalLinks } from "../packages/core/src/server/settings/external-links.service";
import { getAdminNavigation, saveNavigation } from "../packages/core/src/server/navigation/navigation.service";
import type { PageBlock } from "../packages/core/src/server/pages/pages.contract";
import type { RichDocument } from "../packages/core/src/server/shared/rich-text";

const mediaRoot = resolve(process.env.SEED_MEDIA_ROOT?.trim() || "../storage/media/seed");
const demoNote = "Dữ liệu mẫu";
const now = Date.now();
const days = (count: number) => new Date(now + count * 86_400_000);

// ---------- Rich text ----------
type Node = Record<string, unknown>;
const text = (value: string) => ({ type: "text", text: value });
const p = (value: string): Node => ({ type: "paragraph", content: [text(value)] });
const h = (level: 2 | 3, value: string): Node => ({ type: "heading", attrs: { level }, content: [text(value)] });
const ul = (items: string[]): Node => ({ type: "bulletList", content: items.map((item) => ({ type: "listItem", content: [p(item)] })) });
const quote = (value: string): Node => ({ type: "blockquote", content: [p(value)] });
const doc = (...nodes: Node[]) => ({ version: 2 as const, doc: { type: "doc" as const, content: nodes } });

// ---------- Media ----------
async function image(userId: string, file: string, altText: string, caption: string | null = null) {
  const name = basename(file);
  const [existing] = await getDb().select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.originalName, name), isNull(mediaAssets.deletedAt))).limit(1);
  if (existing) return existing.id;
  const asset = await uploadAdminMedia(new File([await readFile(resolve(mediaRoot, file))], name), userId);
  await editAdminMedia(asset.id, { altText, caption, expectedVersion: asset.version }, userId);
  return asset.id;
}

// PDF một trang hợp lệ làm tệp tải về mẫu (không tải tệp thật trên máy lên).
function samplePdf(title: string) {
  const content = `BT /F1 18 Tf 72 720 Td (${title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[()\\]/g, "")}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(body.length); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
async function pdf(userId: string, name: string, title: string) {
  const [existing] = await getDb().select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.originalName, name), isNull(mediaAssets.deletedAt))).limit(1);
  if (existing) return existing.id;
  const asset = await uploadAdminMedia(new File([samplePdf(title)], name), userId);
  await editAdminMedia(asset.id, { altText: null, caption: `${title} (${demoNote})`, expectedVersion: asset.version }, userId);
  return asset.id;
}

async function run() {
  const db = getDb();
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!admin) throw new Error("Không tìm thấy tài khoản quản trị (INITIAL_ADMIN_USERNAME).");
  const uid = admin.id;
  const log = (message: string) => console.log(`• ${message}`);

  // ---------- Ảnh ----------
  const img = {
    hero1: await image(uid, "home/hero-1.png", "Phần mềm iOrder trên máy tính, máy tính bảng và điện thoại"),
    hero2: await image(uid, "home/hero-2.png", "Màn hình bán hàng iOrder tại quầy"),
    hero3: await image(uid, "home/hero-3.jpg", "Cửa hàng sử dụng iOrder"),
    computer: await image(uid, "home/deployment-computer.png", "iOrder trên máy tính"),
    phone: await image(uid, "home/deployment-phone.png", "iOrder trên điện thoại"),
    pos: await image(uid, "home/deployment-pos.png", "iOrder trên máy POS"),
    news1: await image(uid, "posts/news1.jpg", "Ảnh minh họa tin tức iOrder"),
    news2: await image(uid, "posts/news2.jpg", "Ảnh minh họa cửa hàng"),
    news3: await image(uid, "posts/news3.jpg", "Ảnh minh họa vận hành"),
    iod86: await image(uid, "equipment/iod86.png", "Máy POS iOrder iOD86"),
    posMini: await image(uid, "equipment/pos-mini.png", "Máy POS mini cầm tay"),
    printer: await image(uid, "equipment/printer.png", "Máy in hóa đơn nhiệt"),
    scanner: await image(uid, "equipment/scanner.png", "Máy quét mã vạch"),
    drawer: await image(uid, "equipment/cash-drawer.png", "Két đựng tiền"),
  };
  const logos: Array<[string, string, "partner" | "customer", string]> = [
    ["home/grabfood.png", "GrabFood", "partner", "https://www.grab.com/vn/food/"],
    ["home/shopeefood.png", "ShopeeFood", "partner", "https://shopeefood.vn"],
    ["home/mobifone.png", "MobiFone", "partner", "https://www.mobifone.vn"],
    ["home/cmc.png", "CMC", "partner", "https://www.cmc.com.vn"],
    ["home/vietnix.png", "Vietnix", "partner", "https://vietnix.vn"],
    ["home/taxnet.png", "Taxnet", "partner", "https://taxnet.vn"],
    ["home/lac-viet.png", "Lạc Việt", "partner", "https://lacviet.vn"],
    ["home/etelecom.png", "eTelecom", "partner", "https://etelecom.vn"],
    ["home/incard.png", "inCard", "partner", "https://incard.vn"],
    ["home/crm-online.png", "CRM Online", "partner", "https://crmonline.vn"],
    ["home/base.png", "Base", "partner", "https://base.vn"],
    ["home/bni.png", "BNI", "customer", "https://bni.vn"],
    ["home/ttc.png", "TTC", "customer", "https://ttcgroup.vn"],
    ["home/huit.png", "HUIT", "customer", "https://huit.edu.vn"],
    ["home/tan-an-phat.png", "Tân An Phát", "customer", "https://tananphat.vn"],
    ["home/vietsunco.png", "Vietsunco", "customer", "https://vietsunco.vn"],
  ];
  log(`Ảnh: ${Object.keys(img).length} ảnh nội dung`);

  // ---------- Chuyên mục & thẻ ----------
  const categoryDefs: Array<[string, string, string]> = [
    ["tin-cong-ty", "Tin công ty", "Hoạt động, sự kiện và cập nhật sản phẩm của iOrder."],
    ["kinh-nghiem-kinh-doanh", "Kinh nghiệm kinh doanh", "Chia sẻ kinh nghiệm vận hành nhà hàng, quán cà phê và cửa hàng bán lẻ."],
    ["khuyen-mai", "Khuyến mãi", "Chương trình ưu đãi dành cho khách hàng iOrder."],
    ["huong-dan-su-dung", "Hướng dẫn sử dụng", "Hướng dẫn từng bước sử dụng phần mềm iOrder."],
    ["cai-dat-thiet-bi", "Cài đặt thiết bị", "Cài đặt máy in, máy POS, máy quét và driver."],
  ];
  const category: Record<string, string> = {};
  for (const [index, [slug, name, description]] of categoryDefs.entries()) {
    const existing = await findCategoryBySlug(slug);
    category[slug] = existing?.id ?? String(await writeTaxonomy("categories", null, { parentId: null, name, slug, description, sortOrder: index }, uid));
  }
  const tagDefs: Array<[string, string]> = [["nha-hang", "Nhà hàng"], ["cafe", "Cà phê"], ["ban-le", "Bán lẻ"], ["bao-cao", "Báo cáo"], ["may-in", "Máy in"], ["hoa-don-dien-tu", "Hóa đơn điện tử"], ["chuyen-doi-so", "Chuyển đổi số"]];
  const tag: Record<string, string> = {};
  for (const [slug, name] of tagDefs) {
    const existing = await findTagBySlug(slug);
    tag[slug] = existing?.id ?? String(await writeTaxonomy("tags", null, { name, slug }, uid));
  }
  log(`Chuyên mục: ${categoryDefs.length}, thẻ: ${tagDefs.length}`);

  // ---------- Bài viết & hướng dẫn ----------
  type PostDef = { slug: string; type: "news" | "promotion" | "case_study" | "announcement" | "guide"; title: string; excerpt: string; cover: string; categories: string[]; tags: string[]; body: Node[]; badge: string; cta: [string, string] };
  const postDefs: PostDef[] = [
    { slug: "iorder-ra-mat-giao-dien-ban-hang-moi", type: "news", title: "iOrder ra mắt giao diện bán hàng mới, thao tác nhanh hơn 30%", excerpt: "Giao diện bán hàng mới giúp thu ngân lên đơn, tách bàn và thanh toán chỉ với vài lần chạm.", cover: img.news1, categories: ["tin-cong-ty"], tags: ["nha-hang", "cafe"], badge: "Mới", cta: ["Dùng thử miễn phí", "https://app.iorder.vn/register-trial"],
      body: [p("Phiên bản mới của iOrder tập trung vào tốc độ thao tác tại quầy: thu ngân lên đơn, gộp bàn, tách hóa đơn và thanh toán nhanh hơn."), h(2, "Những thay đổi chính"), ul(["Màn hình gọi món gọn hơn, tìm món theo tên hoặc mã", "Tách và gộp bàn chỉ với hai lần chạm", "Thanh toán QR hiện ngay trên màn hình khách"]), h(2, "Cập nhật như thế nào?"), p("Bản cập nhật tự động áp dụng cho mọi cửa hàng, không cần cài đặt lại. Dữ liệu bán hàng được giữ nguyên.")] },
    { slug: "5-cach-giam-thoi-gian-cho-mon-gio-cao-diem", type: "news", title: "5 cách giảm thời gian chờ món vào giờ cao điểm", excerpt: "Giờ cao điểm là lúc dễ mất khách nhất. Năm cách đơn giản giúp bếp và phục vụ phối hợp nhịp nhàng hơn.", cover: img.news2, categories: ["kinh-nghiem-kinh-doanh"], tags: ["nha-hang", "bao-cao"], badge: "Kinh nghiệm", cta: ["Nhận tư vấn", "https://iorder.com.vn/lien-he"],
      body: [p("Khách chờ món quá lâu là lý do hàng đầu khiến họ không quay lại. Dưới đây là năm cách các cửa hàng dùng iOrder đã áp dụng."), h(2, "1. Gửi món thẳng xuống bếp"), p("Đơn được in hoặc hiện trên màn hình bếp ngay khi phục vụ bấm gửi, không cần chạy phiếu tay."), h(2, "2. Chuẩn bị trước món bán chạy"), p("Báo cáo món bán chạy theo khung giờ giúp bếp sơ chế trước."), h(2, "3. Gọi món tại bàn bằng QR"), p("Khách tự gọi món, nhân viên chỉ cần xác nhận."), h(2, "4. Theo dõi thời gian chế biến"), p("Mỗi món có đồng hồ đếm từ lúc gọi tới lúc ra món."), h(2, "5. Phân khu phục vụ"), p("Chia bàn theo khu vực để mỗi nhân viên phụ trách rõ ràng."), quote("Áp dụng gọi món bằng QR, thời gian chờ của quán giảm gần một nửa vào cuối tuần.")] },
    { slug: "uu-dai-mua-phan-mem-tang-may-in", type: "promotion", title: "Ưu đãi tháng này: đăng ký gói năm tặng máy in hóa đơn", excerpt: "Đăng ký gói 12 tháng trong tháng này để nhận máy in hóa đơn nhiệt và miễn phí cài đặt tại cửa hàng.", cover: img.news3, categories: ["khuyen-mai"], tags: ["may-in", "ban-le"], badge: "Ưu đãi", cta: ["Đăng ký ngay", "https://app.iorder.vn/register-trial"],
      body: [p("Chương trình áp dụng cho khách hàng đăng ký mới gói 12 tháng trong thời gian khuyến mãi."), h(2, "Quà tặng"), ul(["Máy in hóa đơn nhiệt khổ 80mm", "Miễn phí cài đặt và đào tạo tại cửa hàng", "Tặng thêm 1 tháng sử dụng"]), h(2, "Điều kiện"), p("Mỗi cửa hàng nhận tối đa một phần quà. Chương trình có thể kết thúc sớm khi hết quà.")] },
    { slug: "chuoi-ca-phe-quan-ly-10-chi-nhanh", type: "case_study", title: "Chuỗi cà phê quản lý 10 chi nhánh trên một màn hình", excerpt: "Từ sổ sách rời rạc ở từng quán tới báo cáo tập trung theo thời gian thực cho chủ chuỗi.", cover: img.hero3, categories: ["kinh-nghiem-kinh-doanh"], tags: ["cafe", "bao-cao", "chuyen-doi-so"], badge: "Câu chuyện khách hàng", cta: ["Tư vấn cho chuỗi", "https://iorder.com.vn/lien-he"],
      body: [p("Trước khi dùng iOrder, mỗi chi nhánh tự ghi chép doanh thu và tồn kho, cuối ngày gửi báo cáo qua tin nhắn."), h(2, "Thách thức"), ul(["Không biết doanh thu thật theo thời gian thực", "Thất thoát nguyên liệu khó kiểm soát", "Giá bán và khuyến mãi không đồng bộ giữa các quán"]), h(2, "Giải pháp"), p("Toàn bộ chi nhánh dùng chung thực đơn, giá và chương trình khuyến mãi; kho được trừ tự động theo công thức món."), h(2, "Kết quả"), p("Chủ chuỗi xem doanh thu từng quán trên điện thoại, thất thoát nguyên liệu giảm rõ rệt sau ba tháng.")] },
    { slug: "thong-bao-lich-bao-tri-he-thong", type: "announcement", title: "Thông báo lịch bảo trì hệ thống định kỳ", excerpt: "Hệ thống bảo trì định kỳ vào rạng sáng Chủ nhật; ứng dụng bán hàng vẫn hoạt động ngoại tuyến.", cover: img.computer, categories: ["tin-cong-ty"], tags: ["chuyen-doi-so"], badge: "Thông báo", cta: ["Liên hệ hỗ trợ", "https://iorder.com.vn/lien-he"],
      body: [p("Để nâng cấp hạ tầng, iOrder bảo trì hệ thống định kỳ từ 01:00 tới 03:00 sáng Chủ nhật."), h(2, "Ảnh hưởng"), ul(["Ứng dụng bán hàng vẫn hoạt động ngoại tuyến", "Báo cáo trên web có thể chậm trong thời gian bảo trì", "Dữ liệu tự đồng bộ khi hệ thống hoạt động lại"])] },
    { slug: "huong-dan-tao-thuc-don-va-gia-ban", type: "guide", title: "Hướng dẫn tạo thực đơn và giá bán", excerpt: "Tạo nhóm món, món, giá theo size và topping trong vài phút.", cover: img.computer, categories: ["huong-dan-su-dung"], tags: ["nha-hang", "cafe"], badge: "Cơ bản", cta: ["Xem video hướng dẫn", "https://www.youtube.com/results?search_query=iorder+huong+dan"],
      body: [p("Thực đơn là dữ liệu đầu tiên cần chuẩn bị trước khi bán hàng."), h(2, "Bước 1: Tạo nhóm món"), p("Vào Hàng hóa → Nhóm hàng → Thêm nhóm, ví dụ: Cà phê, Trà, Bánh."), h(2, "Bước 2: Thêm món"), p("Vào Hàng hóa → Thêm hàng hóa, nhập tên, giá bán và chọn nhóm."), h(2, "Bước 3: Giá theo size và topping"), ul(["Thêm thuộc tính Size với giá cộng thêm", "Thêm topping dùng chung cho nhiều món"])] },
    { slug: "huong-dan-cai-dat-may-in-hoa-don", type: "guide", title: "Hướng dẫn cài đặt máy in hóa đơn", excerpt: "Kết nối máy in nhiệt qua USB hoặc mạng LAN và in thử hóa đơn.", cover: img.printer, categories: ["cai-dat-thiet-bi"], tags: ["may-in"], badge: "Thiết bị", cta: ["Tải driver máy in", "https://iorder.com.vn/ho-tro/cai-dat"],
      body: [p("iOrder hỗ trợ máy in nhiệt khổ 58mm và 80mm qua USB, LAN và Bluetooth."), h(2, "Cài driver"), p("Tải driver đúng dòng máy tại mục Hỗ trợ cài đặt và cài như phần mềm thông thường."), h(2, "Kết nối trong iOrder"), ul(["Vào Thiết lập → Máy in → Thêm máy in", "Chọn kiểu kết nối và khổ giấy", "Bấm In thử để kiểm tra"])] },
    { slug: "huong-dan-xem-bao-cao-doanh-thu", type: "guide", title: "Hướng dẫn xem báo cáo doanh thu", excerpt: "Xem doanh thu theo ngày, ca, nhân viên và món bán chạy.", cover: img.phone, categories: ["huong-dan-su-dung"], tags: ["bao-cao"], badge: "Báo cáo", cta: ["Mở ứng dụng", "https://app.iorder.vn/login"],
      body: [p("Báo cáo cập nhật theo thời gian thực trên máy tính và điện thoại."), h(2, "Các loại báo cáo"), ul(["Doanh thu theo ngày, tuần, tháng", "Doanh thu theo ca và nhân viên", "Món bán chạy và món bán chậm"]), h(2, "Xuất báo cáo"), p("Bấm Xuất Excel ở góc phải để tải báo cáo về máy.")] },
  ];
  let createdPosts = 0;
  for (const [index, def] of postDefs.entries()) {
    const [existing] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.slug, def.slug), isNull(posts.deletedAt))).limit(1);
    if (existing) continue;
    await createAdminPost({
      coverMediaId: def.cover, type: def.type, title: def.title, slug: def.slug, excerpt: def.excerpt, content: doc(...def.body), status: "published",
      seoTitle: def.title.slice(0, 60), seoDescription: def.excerpt.slice(0, 155), canonicalUrl: null,
      promotionStartAt: def.type === "promotion" ? days(-3) : null, promotionEndAt: def.type === "promotion" ? days(27) : null,
      ctaLabel: def.cta[0], ctaUrl: def.cta[1], badgeText: def.badge, scheduledAt: null,
      categoryIds: def.categories.map((slug) => category[slug]), tagIds: def.tags.map((slug) => tag[slug]),
    }, uid);
    createdPosts += 1;
    void index;
  }
  log(`Bài viết/hướng dẫn: tạo ${createdPosts}/${postDefs.length}`);

  // ---------- Sản phẩm & dịch vụ (8 mục nháp đã có → đủ nội dung + xuất bản) ----------
  type OfferingDef = { slug: string; cover: string; icon: string; category: string; summary: string; description: string; bestFor: string; keyValue: string; features: string[]; benefits: string[]; metrics: string[]; tags: string[]; faq: [string, string][] };
  const offeringDefs: OfferingDef[] = [
    { slug: "phan-mem-quan-ly-ban-hang-iorder", cover: img.hero1, icon: "store", category: "Quản lý bán hàng", summary: "Phần mềm bán hàng cho nhà hàng, cà phê và bán lẻ: gọi món, thu ngân, kho, nhân viên và báo cáo trên một nền tảng.", description: "iOrder giúp cửa hàng bán nhanh tại quầy, gọi món tại bàn, quản lý kho theo công thức, chấm công nhân viên và xem báo cáo theo thời gian thực trên mọi thiết bị.", bestFor: "Nhà hàng, quán cà phê, cửa hàng bán lẻ và chuỗi nhiều chi nhánh", keyValue: "Bán nhanh hơn, thất thoát ít hơn, ra quyết định bằng số liệu thật", features: ["Bán hàng tại quầy và gọi món tại bàn", "Gọi món bằng QR", "Quản lý kho theo công thức món", "Báo cáo doanh thu theo thời gian thực", "Quản lý nhiều chi nhánh"], benefits: ["Giảm thời gian thanh toán", "Kiểm soát thất thoát nguyên liệu", "Chủ cửa hàng theo dõi mọi lúc mọi nơi"], metrics: ["10.000+ cửa hàng sử dụng", "Triển khai trong 1 ngày"], tags: ["F&B", "Bán lẻ"], faq: [["Có dùng thử miễn phí không?", "Có, dùng thử đầy đủ tính năng trong 15 ngày."], ["Mất mạng có bán được không?", "Có, ứng dụng hoạt động ngoại tuyến và tự đồng bộ khi có mạng."]] },
    { slug: "phan-mem-quan-ly-tram-sac-xe-dien-iorder-ev", cover: img.hero2, icon: "plug-zap", category: "Trạm sạc xe điện", summary: "Quản lý trạm sạc xe điện: theo dõi trụ sạc, phiên sạc, thanh toán và doanh thu theo thời gian thực.", description: "iOrder EV kết nối các trụ sạc, ghi nhận từng phiên sạc, tính tiền tự động và cho chủ trạm xem trạng thái toàn bộ hệ thống trên một màn hình.", bestFor: "Chủ trạm sạc, bãi đỗ xe, khu đô thị và chuỗi cửa hàng có trạm sạc", keyValue: "Vận hành trạm sạc không cần người trực", features: ["Theo dõi trạng thái trụ sạc", "Thanh toán QR theo phiên sạc", "Báo cáo sản lượng điện và doanh thu", "Cảnh báo lỗi trụ sạc"], benefits: ["Giảm chi phí nhân sự trực trạm", "Minh bạch doanh thu theo từng trụ"], metrics: ["Giám sát 24/7", "Thanh toán không tiền mặt"], tags: ["Xe điện", "IoT"], faq: [["Hỗ trợ những loại trụ sạc nào?", "Các trụ sạc hỗ trợ giao thức OCPP phổ biến."], ["Khách thanh toán thế nào?", "Quét mã QR tại trụ sạc và thanh toán qua ví hoặc ngân hàng."]] },
    { slug: "hoa-don-dien-tu-chu-ky-so", cover: img.computer, icon: "file-check", category: "Hóa đơn & chữ ký số", summary: "Xuất hóa đơn điện tử ngay khi bán hàng, ký số và gửi cho khách theo đúng quy định.", description: "Kết nối iOrder với nhà cung cấp hóa đơn điện tử để xuất hóa đơn từ đơn bán hàng, ký bằng chữ ký số và gửi email cho khách tự động.", bestFor: "Doanh nghiệp, hộ kinh doanh phải xuất hóa đơn điện tử", keyValue: "Xuất hóa đơn trong vài giây, đúng quy định", features: ["Xuất hóa đơn từ đơn bán hàng", "Ký số tự động", "Gửi hóa đơn qua email", "Tra cứu hóa đơn"], benefits: ["Không nhập lại dữ liệu", "Tránh sai sót khi xuất hóa đơn"], metrics: ["Xuất hóa đơn dưới 5 giây"], tags: ["Hóa đơn điện tử"], faq: [["Có phải mua chữ ký số riêng không?", "iOrder hỗ trợ đăng ký chữ ký số cùng gói hóa đơn điện tử."], ["Hóa đơn có đúng quy định không?", "Hóa đơn tuân theo quy định hiện hành về hóa đơn điện tử."]] },
    { slug: "tu-van-chuyen-doi-so", cover: img.hero3, icon: "compass", category: "Tư vấn", summary: "Khảo sát quy trình, đề xuất giải pháp và lộ trình chuyển đổi số phù hợp quy mô doanh nghiệp.", description: "Đội ngũ iOrder khảo sát thực tế vận hành, chỉ ra điểm nghẽn và đề xuất lộ trình áp dụng phần mềm, thiết bị và quy trình phù hợp ngân sách.", bestFor: "Doanh nghiệp vừa và nhỏ bắt đầu chuyển đổi số", keyValue: "Đầu tư đúng chỗ, triển khai từng bước", features: ["Khảo sát quy trình tại chỗ", "Đề xuất giải pháp và ngân sách", "Lộ trình triển khai theo giai đoạn", "Đào tạo nhân sự"], benefits: ["Tránh đầu tư dàn trải", "Nhân viên thích nghi nhanh"], metrics: ["Khảo sát miễn phí buổi đầu"], tags: ["Chuyển đổi số"], faq: [["Tư vấn có mất phí không?", "Buổi khảo sát đầu tiên miễn phí."], ["Mất bao lâu để có lộ trình?", "Thường từ 3 đến 5 ngày làm việc."]] },
    { slug: "phat-trien-phan-mem-theo-yeu-cau", cover: img.phone, icon: "code", category: "Phát triển phần mềm", summary: "Xây dựng phần mềm, ứng dụng di động và tích hợp hệ thống theo đúng nghiệp vụ riêng của doanh nghiệp.", description: "Từ phân tích yêu cầu, thiết kế giao diện tới phát triển, kiểm thử và bảo trì, iOrder xây dựng phần mềm theo nghiệp vụ đặc thù và tích hợp với hệ thống sẵn có.", bestFor: "Doanh nghiệp có quy trình đặc thù chưa có phần mềm đóng gói phù hợp", keyValue: "Phần mềm vừa khít quy trình, sở hữu mã nguồn", features: ["Phân tích và thiết kế nghiệp vụ", "Ứng dụng web và di động", "Tích hợp API với hệ thống sẵn có", "Bảo trì và nâng cấp"], benefits: ["Tự động hóa quy trình riêng", "Mở rộng theo nhu cầu"], metrics: ["Báo giá trong 7 ngày"], tags: ["Phần mềm", "Tích hợp"], faq: [["Doanh nghiệp có sở hữu mã nguồn không?", "Có, tùy theo thỏa thuận hợp đồng."], ["Có bảo trì sau bàn giao không?", "Có gói bảo trì định kỳ sau bàn giao."]] },
    { slug: "ha-tang-mang-wifi-camera", cover: img.pos, icon: "wifi", category: "Hạ tầng", summary: "Thiết kế, lắp đặt mạng LAN, Wi-Fi và camera giám sát cho cửa hàng, văn phòng và nhà xưởng.", description: "Khảo sát mặt bằng, thiết kế hạ tầng mạng ổn định cho máy bán hàng, Wi-Fi cho khách và hệ thống camera xem từ xa trên điện thoại.", bestFor: "Cửa hàng, văn phòng, nhà xưởng cần mạng ổn định và giám sát", keyValue: "Mạng ổn định cho bán hàng, giám sát mọi lúc", features: ["Thiết kế mạng LAN và Wi-Fi", "Lắp đặt camera giám sát", "Xem camera trên điện thoại", "Bảo trì định kỳ"], benefits: ["Bán hàng không gián đoạn", "An ninh cửa hàng tốt hơn"], metrics: ["Khảo sát trong 24 giờ"], tags: ["Wi-Fi", "Camera"], faq: [["Có bảo hành thiết bị không?", "Thiết bị bảo hành theo nhà sản xuất, thi công bảo hành 12 tháng."], ["Có xem camera từ xa được không?", "Có, xem trực tiếp và xem lại trên điện thoại."]] },
    { slug: "data-center-cho-doanh-nghiep", cover: img.computer, icon: "server", category: "Hạ tầng", summary: "Máy chủ, lưu trữ và sao lưu dữ liệu cho doanh nghiệp: triển khai tại chỗ hoặc trên đám mây.", description: "Tư vấn và triển khai hạ tầng máy chủ, lưu trữ, sao lưu và khôi phục dữ liệu, đảm bảo hệ thống hoạt động liên tục và an toàn.", bestFor: "Doanh nghiệp cần hạ tầng máy chủ riêng hoặc sao lưu tập trung", keyValue: "Dữ liệu an toàn, hệ thống luôn sẵn sàng", features: ["Máy chủ và lưu trữ", "Sao lưu tự động", "Khôi phục khi sự cố", "Giám sát hệ thống"], benefits: ["Giảm rủi ro mất dữ liệu", "Chủ động hạ tầng"], metrics: ["Giám sát 24/7"], tags: ["Máy chủ", "Sao lưu"], faq: [["Có triển khai trên đám mây không?", "Có, hỗ trợ cả tại chỗ và đám mây."], ["Bao lâu sao lưu một lần?", "Tùy nhu cầu, phổ biến là mỗi ngày."]] },
    { slug: "kiem-soat-ra-vao-cham-cong", cover: img.posMini, icon: "fingerprint", category: "An ninh", summary: "Hệ thống kiểm soát ra vào và chấm công bằng vân tay, khuôn mặt hoặc thẻ, kết nối bảng lương.", description: "Lắp đặt thiết bị kiểm soát cửa, máy chấm công và phần mềm tổng hợp công, xuất dữ liệu sang bảng lương tự động.", bestFor: "Văn phòng, nhà xưởng, chuỗi cửa hàng nhiều nhân viên", keyValue: "Chấm công chính xác, ra vào an toàn", features: ["Chấm công vân tay, khuôn mặt, thẻ", "Kiểm soát cửa ra vào", "Tổng hợp công tự động", "Xuất dữ liệu bảng lương"], benefits: ["Tránh chấm công hộ", "Tiết kiệm thời gian tính lương"], metrics: ["Tổng hợp công trong 1 phút"], tags: ["Chấm công", "An ninh"], faq: [["Có chấm công nhiều chi nhánh không?", "Có, dữ liệu tổng hợp về một nơi."], ["Có kết nối phần mềm lương không?", "Xuất Excel hoặc kết nối qua API."]] },
  ];
  let updatedOfferings = 0;
  for (const [index, def] of offeringDefs.entries()) {
    const [row] = await db.select({ id: offerings.id }).from(offerings).where(and(eq(offerings.slug, def.slug), isNull(offerings.deletedAt))).limit(1);
    if (!row) continue;
    const current = await getAdminOfferingById(row.id);
    if (!current) continue;
    await updateAdminOffering(row.id, {
      coverMediaId: def.cover, type: current.type, title: current.title, slug: current.slug, summary: def.summary,
      content: { description: def.description, tags: def.tags, bestFor: def.bestFor, keyValue: def.keyValue, metrics: def.metrics, features: def.features, benefits: def.benefits, faq: def.faq, items: [{ title: "Đăng ký tư vấn", href: "/lien-he" }, { title: "Xem tin tức iOrder", href: "/tin-tuc" }], category: def.category },
      icon: def.icon, status: "published", scheduledAt: null, sortOrder: index, isFeatured: index < 3,
      seoTitle: current.title.slice(0, 60), seoDescription: def.summary.slice(0, 155), canonicalUrl: null,
    }, uid, "Dữ liệu mẫu đầy đủ", current.draftVersion);
    updatedOfferings += 1;
  }
  log(`Sản phẩm & dịch vụ: cập nhật ${updatedOfferings}/${offeringDefs.length}`);

  // ---------- Thiết bị ----------
  const groupDefs: Array<[string, string, string, string]> = [
    ["may-pos", "Máy POS", "Máy bán hàng cảm ứng để bàn và cầm tay.", img.iod86],
    ["may-in", "Máy in", "Máy in hóa đơn và in bếp.", img.printer],
    ["phu-kien", "Phụ kiện", "Máy quét mã vạch, két tiền và phụ kiện bán hàng.", img.scanner],
  ];
  const group: Record<string, string> = {};
  for (const [index, [slug, name, description, cover]] of groupDefs.entries()) {
    const [existing] = await db.select({ id: equipmentGroups.id }).from(equipmentGroups).where(and(eq(equipmentGroups.slug, slug), isNull(equipmentGroups.deletedAt))).limit(1);
    group[slug] = existing?.id ?? String(await writeEquipment("groups", null, { name, slug, description, coverMediaId: cover, sortOrder: index, isEnabled: true }, uid));
  }
  const spec = (title: string, items: Array<[string, string]>) => ({ title, items: items.map(([label, value]) => ({ label, value })) });
  const equipmentDefs = [
    { slug: "may-pos-iorder-iod86", groupId: group["may-pos"], name: "Máy POS iOrder iOD86", modelCode: "iOD86", coverMediaId: img.iod86, priceVnd: 8_900_000, warrantyMonths: 12, summary: "Máy bán hàng cảm ứng hai màn hình, cài sẵn iOrder, phù hợp quầy thu ngân nhà hàng và cà phê.", specificationGroups: [spec("Cấu hình", [["Màn hình", "15.6 inch cảm ứng + màn hình khách 10.1 inch"], ["CPU", "Quad-core 2.0 GHz"], ["Bộ nhớ", "4GB RAM / 32GB"]]), spec("Kết nối", [["Cổng USB", "4 cổng"], ["Mạng", "LAN, Wi-Fi 2.4/5 GHz, Bluetooth"]])] },
    { slug: "may-pos-mini-cam-tay", groupId: group["may-pos"], name: "Máy POS mini cầm tay", modelCode: "POS-MINI", coverMediaId: img.posMini, priceVnd: 3_500_000, warrantyMonths: 12, summary: "Máy cầm tay có máy in tích hợp để gọi món tại bàn và thanh toán ngay tại chỗ.", specificationGroups: [spec("Cấu hình", [["Màn hình", "5.5 inch cảm ứng"], ["Pin", "5000 mAh"], ["Máy in", "Tích hợp, khổ 58mm"]]), spec("Kết nối", [["Mạng", "Wi-Fi, 4G, Bluetooth"]])] },
    { slug: "may-in-hoa-don-nhiet-80mm", groupId: group["may-in"], name: "Máy in hóa đơn nhiệt 80mm", modelCode: "TP-80", coverMediaId: img.printer, priceVnd: 1_650_000, warrantyMonths: 12, summary: "Máy in nhiệt tốc độ cao, tự cắt giấy, dùng cho in hóa đơn và in bếp.", specificationGroups: [spec("In ấn", [["Khổ giấy", "80mm"], ["Tốc độ", "250 mm/giây"], ["Cắt giấy", "Tự động"]]), spec("Kết nối", [["Cổng", "USB + LAN"]])] },
    { slug: "may-quet-ma-vach", groupId: group["phu-kien"], name: "Máy quét mã vạch", modelCode: "SC-2D", coverMediaId: img.scanner, priceVnd: 950_000, warrantyMonths: 12, summary: "Quét mã vạch 1D, 2D và QR trên giấy lẫn màn hình điện thoại.", specificationGroups: [spec("Thông số", [["Loại mã", "1D, 2D, QR"], ["Kết nối", "USB"], ["Chế độ", "Cầm tay và tự động"]])] },
    { slug: "ket-dung-tien", groupId: group["phu-kien"], name: "Két đựng tiền", modelCode: "CD-405", coverMediaId: img.drawer, priceVnd: 850_000, warrantyMonths: 12, summary: "Két tiền 5 ngăn tiền giấy, 4 ngăn tiền xu, tự mở khi in hóa đơn.", specificationGroups: [spec("Thông số", [["Ngăn", "5 ngăn giấy, 4 ngăn xu"], ["Kết nối", "RJ11 qua máy in"], ["Chất liệu", "Thép sơn tĩnh điện"]])] },
  ];
  let createdEquipment = 0;
  for (const [index, def] of equipmentDefs.entries()) {
    const [existing] = await db.select({ id: salesEquipment.id }).from(salesEquipment).where(and(eq(salesEquipment.slug, def.slug), isNull(salesEquipment.deletedAt))).limit(1);
    if (existing) continue;
    await writeEquipment("items", null, { ...def, status: "published", scheduledAt: null, sortOrder: index, isFeatured: index < 2, seoTitle: def.name.slice(0, 70), seoDescription: def.summary.slice(0, 180), canonicalUrl: null }, uid, "Dữ liệu mẫu");
    createdEquipment += 1;
  }
  log(`Thiết bị: ${groupDefs.length} nhóm, tạo ${createdEquipment}/${equipmentDefs.length} thiết bị`);

  // ---------- Đối tác & đánh giá ----------
  let createdPartners = 0;
  for (const [index, [file, name, kind, websiteUrl]] of logos.entries()) {
    const [existing] = await db.select({ id: partners.id }).from(partners).where(and(eq(partners.name, name), isNull(partners.deletedAt))).limit(1);
    if (existing) continue;
    await writeSupporting("partners", null, { logoMediaId: await image(uid, file, `Logo ${name}`), kind, name, description: kind === "partner" ? `Đối tác hợp tác cùng iOrder (${demoNote}).` : `Khách hàng sử dụng giải pháp iOrder (${demoNote}).`, websiteUrl, sortOrder: index, isEnabled: true }, uid);
    createdPartners += 1;
  }
  const testimonialDefs: Array<[string, string, string, number]> = [
    ["Chị Lan", "Chủ quán cà phê", "Từ ngày dùng iOrder, cuối ngày tôi chỉ cần mở điện thoại là biết doanh thu từng ca, không phải đối chiếu sổ sách nữa.", 5],
    ["Anh Minh", "Quản lý nhà hàng", "Gọi món bằng QR giúp nhân viên đỡ chạy bàn, khách gọi món nhanh hơn hẳn vào giờ cao điểm.", 5],
    ["Chị Hương", "Chủ chuỗi trà sữa", "Quản lý 5 chi nhánh trên một màn hình, giá và khuyến mãi đồng bộ, tôi yên tâm đi công tác.", 4],
  ];
  let createdTestimonials = 0;
  for (const [index, [authorName, authorRole, quote, rating]] of testimonialDefs.entries()) {
    const [existing] = await db.select({ id: testimonials.id }).from(testimonials).where(and(eq(testimonials.authorName, authorName), isNull(testimonials.deletedAt))).limit(1);
    if (existing) continue;
    await writeSupporting("testimonials", null, { avatarMediaId: null, authorName, authorRole, company: demoNote, quote, rating, sortOrder: index, isEnabled: true }, uid);
    createdTestimonials += 1;
  }
  log(`Đối tác: tạo ${createdPartners}/${logos.length}; đánh giá: tạo ${createdTestimonials}/${testimonialDefs.length}`);

  // ---------- Tệp hỗ trợ tải về ----------
  const downloadDefs: Array<[string, string, string, string, string]> = [
    ["driver-may-in-nhiet.pdf", "printer", "Driver máy in hóa đơn nhiệt", "Driver cho máy in nhiệt 58mm và 80mm trên Windows.", "Windows 10/11 · PDF mẫu"],
    ["huong-dan-ket-noi-may-pos.pdf", "monitor-smartphone", "Hướng dẫn kết nối máy POS", "Các bước kết nối máy POS với máy in, két tiền và mạng.", "PDF · 1 trang"],
    ["tai-lieu-gioi-thieu-iorder.pdf", "file-text", "Tài liệu giới thiệu iOrder", "Giới thiệu tính năng và bảng giá tham khảo.", "PDF · 1 trang"],
  ];
  let createdDownloads = 0;
  for (const [index, [fileName, icon, title, description, meta]] of downloadDefs.entries()) {
    const [existing] = await db.select({ id: supportDownloads.id }).from(supportDownloads).where(and(eq(supportDownloads.title, title), isNull(supportDownloads.deletedAt))).limit(1);
    if (existing) continue;
    await createAdminSupportDownload({ fileMediaId: await pdf(uid, fileName, title), icon, title, description, meta, sortOrder: index, isEnabled: true }, uid, "Dữ liệu mẫu");
    createdDownloads += 1;
  }
  log(`Tệp tải về: tạo ${createdDownloads}/${downloadDefs.length}`);

  // ---------- Trang ----------
  const action = (label: string, href: string) => ({ label, href });
  async function updatePage(slug: string, build: (current: PageBlock[]) => PageBlock[], seo: { seoTitle: string; seoDescription: string }) {
    const page = await getAdminPageBySlug(slug);
    if (!page) return log(`Trang ${slug}: chưa có, bỏ qua`);
    const { id, draftVersion, publishedAt, updatedAt, ...values } = page;
    void publishedAt; void updatedAt;
    await saveAdminPage(id, { ...values, ...seo, status: values.status === "archived" ? "archived" : "published", blocks: build(page.blocks) }, uid, { expectedVersion: draftVersion });
  }
  const hero = (eyebrow: string, title: string, description: string, mediaId: string | null): PageBlock => ({ type: "hero", isEnabled: true, data: { eyebrow, title, description, primaryAction: action("Dùng thử miễn phí", "https://app.iorder.vn/register-trial"), secondaryAction: action("Nhận tư vấn", "/lien-he"), mediaId, layout: "split", highlights: [{ title: "Dễ sử dụng", note: "Bắt đầu nhanh chóng" }, { title: "Triển khai nhanh", note: "Sẵn sàng vận hành" }, { title: "Hỗ trợ 24/7", note: "Luôn đồng hành" }], footnote: "Dùng thử miễn phí đầy đủ tính năng trong 15 ngày", slides: [], extraMediaIds: [], tone: null, panels: [] } });
  const replaceHero = (blocks: PageBlock[], next: PageBlock) => blocks.some((block) => block.type === "hero") ? blocks.map((block) => block.type === "hero" ? next : block) : [next, ...blocks];

  await updatePage("home", () => [
    hero("Giải pháp quản lý bán hàng toàn diện", "Phần mềm quản lý hiệu quả cho mọi mô hình kinh doanh", "Quản lý bán hàng, kho, nhân viên và báo cáo chi tiết trên một nền tảng duy nhất — phù hợp từ cửa hàng, quán cà phê đến chuỗi cửa hàng.", img.hero1),
    { type: "partners", isEnabled: true, data: { eyebrow: "Được hơn 10.000+ cửa hàng tin tưởng sử dụng", title: "Đối tác và khách hàng", kind: "all", limit: 15 } },
    { type: "media_text", isEnabled: true, data: { layout: "image_right", tone: "light", eyebrow: "Bán hàng", title: "Bán nhanh tại quầy, gọi món ngay tại bàn", description: "Thu ngân lên đơn, tách gộp bàn và thanh toán QR chỉ với vài lần chạm. Phục vụ gọi món trên điện thoại, đơn gửi thẳng xuống bếp.", bullets: ["Gọi món bằng QR tại bàn", "In bếp và in hóa đơn tự động", "Thanh toán QR, thẻ, tiền mặt"], mediaId: img.pos, primaryAction: action("Dùng thử miễn phí", "https://app.iorder.vn/register-trial"), secondaryAction: action("Xem phần mềm", "/phan-mem/phan-mem-quan-ly-ban-hang-iorder") } },
    { type: "media_text", isEnabled: true, data: { layout: "image_left", tone: "tinted", eyebrow: "Báo cáo", title: "Doanh thu theo thời gian thực trên điện thoại", description: "Chủ cửa hàng xem doanh thu theo ca, nhân viên, món bán chạy và tồn kho ở bất cứ đâu.", bullets: ["Báo cáo theo ngày, ca, chi nhánh", "Cảnh báo tồn kho thấp", "Xuất Excel một chạm"], mediaId: img.phone, primaryAction: action("Nhận tư vấn", "/lien-he"), secondaryAction: null } },
    { type: "media_text", isEnabled: true, data: { layout: "image_right", tone: "light", eyebrow: "Quản lý", title: "Một màn hình cho cả chuỗi cửa hàng", description: "Đồng bộ thực đơn, giá và khuyến mãi cho mọi chi nhánh; phân quyền nhân viên theo vai trò.", bullets: ["Quản lý nhiều chi nhánh", "Phân quyền nhân viên", "Kho theo công thức món"], mediaId: img.computer, primaryAction: action("Tư vấn cho chuỗi", "/lien-he"), secondaryAction: null } },
    { type: "stats", isEnabled: true, data: { eyebrow: "iOrder trong số liệu", title: "Đồng hành cùng hàng nghìn cửa hàng", items: [{ value: "10.000+", label: "Cửa hàng sử dụng", note: null }, { value: "63", label: "Tỉnh thành", note: "Trên toàn quốc" }, { value: "1 ngày", label: "Triển khai", note: "Từ khi đăng ký" }, { value: "24/7", label: "Hỗ trợ", note: "Kỹ thuật viên trực" }] } },
    { type: "features", isEnabled: true, data: { eyebrow: "Tính năng", title: "Đủ công cụ để vận hành cửa hàng", description: "Từ bán hàng tới kho, nhân viên và báo cáo.", items: [{ title: "Bán hàng đa thiết bị", description: "Máy tính, máy POS, máy tính bảng và điện thoại.", href: "/phan-mem/phan-mem-quan-ly-ban-hang-iorder" }, { title: "Quản lý kho", description: "Nhập, xuất, kiểm kho và trừ kho theo công thức.", href: null }, { title: "Nhân viên & chấm công", description: "Phân ca, chấm công và tính hoa hồng.", href: null }, { title: "Hóa đơn điện tử", description: "Xuất hóa đơn ngay khi bán hàng.", href: "/phan-mem/hoa-don-dien-tu-chu-ky-so" }, { title: "Khách hàng thân thiết", description: "Tích điểm, ưu đãi và lịch sử mua hàng.", href: null }, { title: "Báo cáo thông minh", description: "Theo dõi mọi chỉ số trên điện thoại.", href: null }] } },
    { type: "process", isEnabled: true, data: { eyebrow: "Triển khai", title: "Bắt đầu chỉ với 4 bước", description: null, items: [{ title: "Đăng ký", description: "Tạo tài khoản dùng thử miễn phí.", href: "https://app.iorder.vn/register-trial" }, { title: "Nhập thực đơn", description: "Nhập món hoặc nhập nhanh bằng Excel.", href: null }, { title: "Kết nối thiết bị", description: "Máy in, máy POS, két tiền.", href: "/thiet-bi" }, { title: "Bán hàng", description: "Bắt đầu bán và xem báo cáo.", href: null }] } },
    { type: "pricing", isEnabled: true, data: { eyebrow: "Bảng giá", title: "Chọn gói phù hợp với cửa hàng", description: "Dùng thử miễn phí 15 ngày trước khi chọn gói.", note: "Giá tham khảo (dữ liệu mẫu), chưa gồm VAT — cập nhật trước khi phát hành.", plans: [
      { name: "Cơ bản", price: "199.000đ", period: "/tháng", description: "Cho cửa hàng nhỏ, một quầy.", features: ["1 chi nhánh", "Bán hàng tại quầy", "Báo cáo cơ bản"], action: action("Dùng thử", "https://app.iorder.vn/register-trial"), highlighted: false, badge: null },
      { name: "Chuyên nghiệp", price: "399.000đ", period: "/tháng", description: "Cho nhà hàng, quán cà phê.", features: ["1 chi nhánh", "Gọi món bằng QR", "Quản lý kho theo công thức", "Báo cáo nâng cao"], action: action("Dùng thử", "https://app.iorder.vn/register-trial"), highlighted: true, badge: "Phổ biến" },
      { name: "Chuỗi", price: "Liên hệ", period: null, description: "Cho chuỗi nhiều chi nhánh.", features: ["Không giới hạn chi nhánh", "Đồng bộ thực đơn và giá", "Hỗ trợ ưu tiên"], action: action("Nhận tư vấn", "/lien-he"), highlighted: false, badge: null },
    ] } },
    { type: "testimonials", isEnabled: true, data: { eyebrow: "Khách hàng nói gì", title: "Cửa hàng tin dùng iOrder", limit: 6 } },
    { type: "collection_list", isEnabled: true, data: { source: "posts", eyebrow: "Tin tức", title: "Tin mới từ iOrder", description: "Cập nhật sản phẩm và kinh nghiệm kinh doanh.", limit: 3, anchor: null } },
    { type: "faq", isEnabled: true, data: { eyebrow: "Hỏi đáp", title: "Câu hỏi thường gặp", items: [{ question: "Có dùng thử miễn phí không?", answer: "Có, dùng thử đầy đủ tính năng trong 15 ngày, không cần thẻ thanh toán." }, { question: "Mất mạng có bán hàng được không?", answer: "Được, ứng dụng hoạt động ngoại tuyến và tự đồng bộ khi có mạng." }, { question: "Có hỗ trợ cài đặt tại cửa hàng không?", answer: "Có, kỹ thuật viên hỗ trợ cài đặt và đào tạo tại cửa hàng." }, { question: "Dùng được trên những thiết bị nào?", answer: "Máy tính Windows, máy POS, máy tính bảng và điện thoại Android, iOS." }] } },
    { type: "cta", isEnabled: true, data: { id: "tu-van", eyebrow: "Sẵn sàng bắt đầu?", title: "Dùng thử iOrder miễn phí 15 ngày", action: action("Đăng ký dùng thử", "https://app.iorder.vn/register-trial") } },
    { type: "lead_form", isEnabled: true, data: { title: "Nhận tư vấn miễn phí", description: "Để lại thông tin, chuyên viên iOrder sẽ gọi lại trong 30 phút làm việc.", submitLabel: "Gửi yêu cầu tư vấn", needOptions: ["Phần mềm bán hàng", "Trạm sạc xe điện", "Hóa đơn điện tử", "Thiết bị bán hàng", "Hạ tầng mạng, camera"] } },
  ], { seoTitle: "iOrder - Phần mềm quản lý bán hàng", seoDescription: "Phần mềm quản lý bán hàng cho nhà hàng, cà phê, bán lẻ và chuỗi: bán hàng, kho, nhân viên, báo cáo trên một nền tảng." });

  await updatePage("about", () => [
    { type: "hero", isEnabled: true, data: { eyebrow: "Về chúng tôi", title: "iOrder đồng hành cùng cửa hàng Việt chuyển đổi số", description: "Chúng tôi xây dựng phần mềm, thiết bị và hạ tầng giúp hàng nghìn cửa hàng vận hành gọn gàng và hiệu quả hơn.", primaryAction: action("Liên hệ", "/lien-he"), secondaryAction: action("Xem sản phẩm", "/phan-mem"), mediaId: img.hero3, layout: "split", highlights: [], footnote: null, slides: [], extraMediaIds: [], tone: null, panels: [] } },
    { type: "stats", isEnabled: true, data: { eyebrow: null, title: "Con số nổi bật", items: [{ value: "10.000+", label: "Cửa hàng", note: null }, { value: "8+", label: "Năm kinh nghiệm", note: null }, { value: "50+", label: "Nhân sự", note: null }] } },
    { type: "media_text", isEnabled: true, data: { layout: "image_left", tone: "light", eyebrow: "Sứ mệnh", title: "Công nghệ đơn giản cho mọi cửa hàng", description: "iOrder tin rằng công nghệ tốt là công nghệ dễ dùng. Mọi tính năng đều được thiết kế để nhân viên mới cũng dùng được ngay.", bullets: ["Dễ sử dụng", "Chi phí hợp lý", "Hỗ trợ tận nơi"], mediaId: img.computer, primaryAction: null, secondaryAction: null } },
    { type: "partners", isEnabled: true, data: { eyebrow: null, title: "Đối tác của chúng tôi", kind: "partner", limit: 12 } },
    { type: "cta", isEnabled: true, data: { id: null, eyebrow: "Cùng hợp tác", title: "Trở thành đối tác của iOrder", action: action("Liên hệ hợp tác", "/lien-he") } },
  ], { seoTitle: "Về iOrder", seoDescription: "iOrder xây dựng phần mềm, thiết bị và hạ tầng giúp cửa hàng Việt vận hành hiệu quả hơn." });

  await updatePage("contact", (current) => [
    { type: "hero", isEnabled: true, data: { eyebrow: "Liên hệ", title: "Liên hệ tư vấn", description: "Gọi hotline 028 710 73 999 hoặc để lại thông tin, chúng tôi sẽ liên hệ lại ngay.", primaryAction: action("Gọi hotline", "tel:02871073999"), secondaryAction: action("Nhắn Zalo", "https://zalo.me/202942984074069074"), mediaId: null, layout: "centered", highlights: [], footnote: "Thứ 2 - Thứ 7: 08:00 - 18:00", slides: [], extraMediaIds: [], tone: null, panels: [] } },
    ...current.filter((block) => block.type === "lead_form"),
    ...(current.some((block) => block.type === "lead_form") ? [] : [{ type: "lead_form", isEnabled: true, data: { title: "Gửi yêu cầu tư vấn", description: "Chuyên viên sẽ liên hệ lại trong giờ làm việc.", submitLabel: "Gửi yêu cầu", needOptions: ["Phần mềm bán hàng", "Thiết bị", "Hạ tầng"] } } as PageBlock]),
    { type: "faq", isEnabled: true, data: { eyebrow: null, title: "Câu hỏi thường gặp", items: [{ question: "Bao lâu thì có người liên hệ lại?", answer: "Trong vòng 30 phút làm việc." }, { question: "Có tư vấn tại cửa hàng không?", answer: "Có, tại TP.HCM và các tỉnh lân cận." }] } },
  ], { seoTitle: "Liên hệ tư vấn iOrder", seoDescription: "Liên hệ iOrder để được tư vấn phần mềm bán hàng, thiết bị và hạ tầng cho cửa hàng." });

  const legal = (title: string, intro: string, sections: Array<[string, string[]]>): PageBlock[] => [
    { type: "hero", isEnabled: true, data: { eyebrow: "Chính sách", title, description: intro, primaryAction: null, secondaryAction: null, mediaId: null, layout: "centered", highlights: [], footnote: `Cập nhật: ${new Date().toLocaleDateString("vi-VN")} (${demoNote})`, slides: [], extraMediaIds: [], tone: null, panels: [] } },
    { type: "rich_text", isEnabled: true, data: { heading: null, body: doc(...sections.flatMap(([heading, items]) => [h(2, heading), ul(items)])).doc as unknown as RichDocument } },
  ];
  await updatePage("privacy-policy", () => legal("Chính sách bảo mật", "Cách iOrder thu thập, sử dụng và bảo vệ thông tin của bạn.", [["Thông tin thu thập", ["Họ tên, số điện thoại, email khi bạn đăng ký hoặc liên hệ", "Dữ liệu sử dụng phần mềm để cải thiện dịch vụ"]], ["Mục đích sử dụng", ["Cung cấp và hỗ trợ dịch vụ", "Gửi thông báo liên quan tới tài khoản"]], ["Bảo vệ thông tin", ["Mã hóa khi truyền tải", "Không chia sẻ cho bên thứ ba khi chưa được đồng ý"]]]), { seoTitle: "Chính sách bảo mật", seoDescription: "Chính sách bảo mật thông tin khách hàng của iOrder." });
  await updatePage("terms", () => legal("Điều khoản dịch vụ", "Điều khoản áp dụng khi sử dụng dịch vụ của iOrder.", [["Tài khoản", ["Bạn chịu trách nhiệm bảo mật mật khẩu", "Thông tin đăng ký phải chính xác"]], ["Thanh toán", ["Phí dịch vụ thanh toán theo gói đã chọn", "Gia hạn trước ngày hết hạn để không gián đoạn"]], ["Chấm dứt", ["Bạn có thể ngừng sử dụng bất cứ lúc nào", "Dữ liệu được lưu 30 ngày sau khi chấm dứt"]]]), { seoTitle: "Điều khoản dịch vụ", seoDescription: "Điều khoản sử dụng dịch vụ phần mềm iOrder." });
  await updatePage("remote-support", () => [
    { type: "hero", isEnabled: true, data: { eyebrow: "Hỗ trợ", title: "Hỗ trợ từ xa", description: "Tải phần mềm điều khiển từ xa để kỹ thuật viên iOrder hỗ trợ trực tiếp trên máy của bạn.", primaryAction: action("Tải UltraViewer", "https://www.ultraviewer.net/vi/download.html"), secondaryAction: action("Tải TeamViewer", "https://www.teamviewer.com/vi/download/"), mediaId: img.computer, layout: "split", highlights: [], footnote: "Hotline hỗ trợ: 028 710 73 999", slides: [], extraMediaIds: [], tone: null, panels: [] } },
    { type: "process", isEnabled: true, data: { eyebrow: null, title: "Các bước nhận hỗ trợ", description: null, items: [{ title: "Tải phần mềm", description: "Tải UltraViewer hoặc TeamViewer.", href: null }, { title: "Gọi hotline", description: "Báo vấn đề cho kỹ thuật viên.", href: null }, { title: "Gửi mã kết nối", description: "Đọc ID và mật khẩu cho kỹ thuật viên.", href: null }] } },
  ], { seoTitle: "Hỗ trợ từ xa iOrder", seoDescription: "Tải phần mềm điều khiển từ xa để được kỹ thuật viên iOrder hỗ trợ trực tiếp." });

  const listingHeroes: Array<[string, string, string, string, string | null]> = [
    ["listing-news", "Tin tức", "Tin tức & kinh nghiệm kinh doanh", "Cập nhật sản phẩm, ưu đãi và kinh nghiệm vận hành cửa hàng.", img.news1],
    ["listing-equipment", "Thiết bị", "Thiết bị bán hàng chính hãng", "Máy POS, máy in, máy quét và phụ kiện đã kiểm thử với iOrder.", img.iod86],
    ["listing-support", "Hỗ trợ", "Hỗ trợ cài đặt", "Tải driver, phần mềm và tài liệu cài đặt iOrder.", img.printer],
    ["listing-guides", "Hỗ trợ", "Hướng dẫn sử dụng", "Hướng dẫn từng bước sử dụng phần mềm và thiết bị iOrder.", img.computer],
    ["listing-software", "Sản phẩm", "Phần mềm iOrder", "Phần mềm bán hàng, trạm sạc xe điện và hóa đơn điện tử.", img.hero1],
    ["listing-solution", "Giải pháp", "Giải pháp hạ tầng", "Mạng, camera, máy chủ và kiểm soát ra vào cho doanh nghiệp.", img.pos],
    ["listing-service", "Dịch vụ", "Dịch vụ công nghệ", "Tư vấn chuyển đổi số và phát triển phần mềm theo yêu cầu.", img.hero3],
  ];
  for (const [slug, eyebrow, title, description, mediaId] of listingHeroes) {
    await updatePage(slug, (current) => replaceHero(current, { type: "hero", isEnabled: true, data: { eyebrow, title, description, primaryAction: action("Nhận tư vấn", "/lien-he"), secondaryAction: null, mediaId, layout: "split", highlights: [], footnote: null, slides: [], extraMediaIds: [], tone: null, panels: [] } }), { seoTitle: title.slice(0, 70), seoDescription: description.slice(0, 180) });
  }
  log("Trang: trang chủ, giới thiệu, liên hệ, chính sách, điều khoản, hỗ trợ từ xa, 7 trang danh sách");

  // ---------- Cài đặt (chỉ điền ô trống) ----------
  const { profile, version: profileVersion } = await getSiteProfileWithVersion();
  if (profile && !profile.legalName) {
    await updateSiteProfile({ companyName: profile.companyName, legalName: `Công ty TNHH Công nghệ iOrder (${demoNote})`, hotline: profile.hotline, supportEmail: profile.supportEmail, salesEmail: profile.salesEmail, address: profile.address, workingHours: profile.workingHours, logoMediaId: profile.logoMediaId }, uid, profileVersion);
  }
  const { config, version: publishingVersion } = await getPublishingConfigWithVersion();
  if (!config.defaultOgMediaId) await updatePublishingConfig({ ...config, defaultOgMediaId: img.hero1 }, uid, publishingVersion);
  const { links, version: linksVersion } = await getExternalLinksWithVersion();
  if (links && (!links.youtube || !links.appStore || !links.googlePlay)) {
    await updateExternalLinks({ ...links, youtube: links.youtube ?? "https://www.youtube.com/results?search_query=iorder", appStore: links.appStore ?? "https://apps.apple.com/vn/search?term=iorder", googlePlay: links.googlePlay ?? "https://play.google.com/store/search?q=iorder&c=apps" }, uid, linksVersion);
  }
  log("Cài đặt: điền tên pháp lý, ảnh chia sẻ mặc định, YouTube/App Store/Google Play nếu đang trống");

  // ---------- Menu chân trang ----------
  const footer = await getAdminNavigation("footer");
  if (!footer.items.length) {
    const item = (key: string, label: string, url: string, parentKey: string | null = null) => ({ key, parentKey, label, url, linkType: "custom" as const, contentId: null, target: "_self" as const, isEnabled: true });
    await saveNavigation("footer", [
      item("products", "Sản phẩm", "/phan-mem"), item("p1", "Phần mềm bán hàng", "/phan-mem/phan-mem-quan-ly-ban-hang-iorder", "products"), item("p2", "Trạm sạc xe điện", "/phan-mem/phan-mem-quan-ly-tram-sac-xe-dien-iorder-ev", "products"), item("p3", "Hóa đơn điện tử", "/phan-mem/hoa-don-dien-tu-chu-ky-so", "products"), item("p4", "Thiết bị", "/thiet-bi", "products"),
      item("support", "Hỗ trợ", "/ho-tro/cai-dat"), item("s1", "Hỗ trợ cài đặt", "/ho-tro/cai-dat", "support"), item("s2", "Hướng dẫn sử dụng", "/ho-tro/huong-dan", "support"), item("s3", "Hỗ trợ từ xa", "/ho-tro-tu-xa", "support"), item("s4", "Liên hệ", "/lien-he", "support"),
      item("company", "Công ty", "/gioi-thieu"), item("c1", "Về chúng tôi", "/gioi-thieu", "company"), item("c2", "Tin tức", "/tin-tuc", "company"), item("c3", "Chính sách bảo mật", "/chinh-sach-bao-mat", "company"), item("c4", "Điều khoản dịch vụ", "/dieu-khoan", "company"),
    ], uid, { expectedVersion: footer.version, changeNote: "Menu chân trang mẫu" });
  }
  log("Menu chân trang: 3 nhóm");
  console.log("Xong. Nội dung mẫu có thể sửa trong CMS.");
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

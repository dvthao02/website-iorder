// Thêm trang giới thiệu "Phần mềm quản lý bán hàng cho trạm dừng nghỉ" vào Phần mềm (/software), mục menu và một khối giới thiệu ở Trang chủ.
// Chỉ thêm, không ghi đè: chạy lại an toàn (bỏ qua ảnh, sản phẩm, mục menu, khối trang chủ đã có). Ảnh chụp màn hình đã làm mờ số liệu và tên cửa hàng (scripts/data/rest-stop).
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { mediaAssets, offerings, users } from "../packages/shared/src/db/schema";
import { editAdminMedia, uploadAdminMedia } from "../packages/shared/src/server/media/media.service";
import { getAdminNavigation, saveNavigation } from "../packages/shared/src/server/navigation/navigation.service";
import { createAdminOffering, getAdminOfferingById } from "../packages/shared/src/server/offerings/offerings.service";
import { getAdminPageBySlug, saveAdminPage } from "../packages/shared/src/server/pages/pages.service";
import type { PageBlock } from "../packages/shared/src/server/pages/pages.contract";

const slug = "phan-mem-ban-hang-tram-dung-nghi";
const path = `/software/${slug}`;
const anchor = "tram-dung-nghi"; // khối ảnh động đã thêm trước đây, nay được thay
const gridAnchor = "phan-mem-theo-mo-hinh";
const sliderAnchor = "hinh-anh-thuc-te";
const dataDir = resolve(process.cwd(), "scripts/data/rest-stop");
const log = (message: string) => console.log(message);
const action = (label: string, href: string) => ({ label, href });

async function image(userId: string, file: string, altText: string, caption: string) {
  const [existing] = await getDb().select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.originalName, file), isNull(mediaAssets.deletedAt))).limit(1);
  if (existing) return existing.id;
  const asset = await uploadAdminMedia(new File([await readFile(resolve(dataDir, file))], file), userId);
  await editAdminMedia(asset.id, { altText, caption, expectedVersion: asset.version }, userId);
  return asset.id;
}

async function run() {
  const db = getDb();
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!admin) throw new Error("Chưa có tài khoản quản trị để ghi nhận thay đổi.");
  const uid = admin.id;

  const hub = await image(uid, "tram-dung-nghi-trung-tam-dieu-hanh-an-danh.png", "Trung tâm điều hành và danh sách cửa hàng trong trạm dừng nghỉ trên iOrder", "Trung tâm điều hành: chi nhánh trung tâm và danh sách cửa hàng của trạm");
  const overview = await image(uid, "tram-dung-nghi-tong-quan-an-danh.png", "Màn hình Tổng quan: kết quả bán hàng, biểu đồ doanh thu theo cửa hàng và hoạt động gần đây", "Tổng quan bán hàng toàn trạm theo thời gian thực");
  const goods = await image(uid, "tram-dung-nghi-hang-hoa-an-danh.png", "Danh mục hàng hóa với nhóm hàng, tồn kho và phạm vi áp dụng theo cửa hàng", "Quản lý hàng hóa tập trung cho nhiều cửa hàng");
  const report = await image(uid, "tram-dung-nghi-bao-cao-an-danh.png", "Báo cáo chi tiết bán hàng với bộ lọc chi nhánh, thời gian và hàng hóa", "Báo cáo bán hàng nhiều góc nhìn, xuất file và in báo cáo");

  const blocks: PageBlock[] = [
    { type: "media_text", isEnabled: true, data: { layout: "image_right", tone: "light", eyebrow: "Trung tâm điều hành", title: "Một nơi quản lý toàn bộ cửa hàng trong trạm", description: "Trạm dừng nghỉ thường có nhiều hộ kinh doanh và cửa hàng hoạt động cạnh nhau. iOrder gom tất cả về một trung tâm điều hành: quản trị viên và kế toán vào chi nhánh trung tâm, người bán vào đúng cửa hàng của mình.", bullets: ["Chi nhánh trung tâm dành cho quản trị viên và kế toán", "Danh sách cửa hàng, tìm nhanh theo tên", "Mỗi cửa hàng bán và đối soát độc lập"], mediaId: hub, extraMediaIds: [], primaryAction: action("Nhận tư vấn", "/contact"), secondaryAction: null } },
    { type: "media_text", isEnabled: true, data: { layout: "image_left", tone: "tinted", eyebrow: "Tổng quan", title: "Theo dõi bán hàng toàn trạm theo thời gian thực", description: "Màn hình Tổng quan cho biết ngay số hóa đơn, doanh thu và đơn hủy trong ngày. Biểu đồ chia doanh thu theo từng cửa hàng, kèm dòng hoạt động gần đây để biết ai vừa bán hay vừa đăng nhập.", bullets: ["Số hóa đơn, doanh thu và đơn hủy trong ngày", "Biểu đồ doanh thu theo cửa hàng và theo chi nhánh", "Dòng hoạt động gần đây của nhân viên"], mediaId: overview, extraMediaIds: [], primaryAction: null, secondaryAction: null } },
    { type: "media_text", isEnabled: true, data: { layout: "image_right", tone: "light", eyebrow: "Hàng hóa", title: "Quản lý hàng hóa tập trung, áp dụng theo từng cửa hàng", description: "Một danh mục hàng hóa dùng chung cho cả trạm: nhóm hàng, đơn vị tính, giá bán, thuế và tồn kho. Mỗi mặt hàng chọn được phạm vi áp dụng cho từng cửa hàng.", bullets: ["Hàng hóa, combo, hàng chứa nguyên liệu và vé xe", "Cây nhóm hàng, lọc theo tồn kho và tỷ lệ thuế", "Nhập file và xuất file hàng loạt"], mediaId: goods, extraMediaIds: [], primaryAction: null, secondaryAction: null } },
    { type: "media_text", isEnabled: true, data: { layout: "image_left", tone: "tinted", eyebrow: "Báo cáo", title: "Báo cáo bán hàng nhiều góc nhìn", description: "Xem báo cáo theo chi nhánh, danh mục, chi tiết hoặc tổng hợp, lọc theo khoảng thời gian, cửa hàng và hàng hóa. Xuất file hoặc in báo cáo ngay trên màn hình.", bullets: ["Báo cáo theo chi nhánh, danh mục, chi tiết và theo ngày", "Lọc theo thời gian, cửa hàng và hàng hóa", "Xuất file và in báo cáo"], mediaId: report, extraMediaIds: [], primaryAction: null, secondaryAction: null } },
    { type: "features", isEnabled: true, data: { cardStyle: "compact", eyebrow: "Chức năng", title: "Đủ nghiệp vụ để vận hành cả trạm", description: "Các phân hệ chính trong menu của phần mềm.", items: [
      { title: "Tổng quan", description: "Kết quả bán hàng, biểu đồ doanh thu và hoạt động gần đây.", href: null },
      { title: "Hàng hóa", description: "Danh mục, nhóm hàng, giá bán, thuế và tồn kho.", href: null },
      { title: "Giao dịch", description: "Hóa đơn và các giao dịch bán hàng tại từng cửa hàng.", href: null },
      { title: "Đối tác", description: "Quản lý khách hàng và nhà cung cấp.", href: null },
      { title: "Người dùng", description: "Tài khoản và phân quyền theo vai trò, theo cửa hàng.", href: null },
      { title: "Sổ quỹ", description: "Theo dõi thu chi phục vụ đối soát và kế toán.", href: null },
      { title: "Báo cáo", description: "Báo cáo bán hàng, xuất file và in báo cáo.", href: null },
    ] } },
    { type: "faq", isEnabled: true, data: { eyebrow: "Hỏi đáp", title: "Câu hỏi thường gặp", items: [
      { question: "Một trạm có nhiều hộ kinh doanh thì quản lý thế nào?", answer: "Mỗi cửa hàng là một chi nhánh trong hệ thống. Quản trị viên và kế toán xem toàn bộ ở chi nhánh trung tâm, người bán chỉ thao tác trong cửa hàng của mình." },
      { question: "Có nhập hàng hóa từ file được không?", answer: "Có. Danh mục hàng hóa hỗ trợ nhập file và xuất file để thêm hoặc cập nhật nhiều mặt hàng cùng lúc." },
      { question: "Có xuất hoặc in báo cáo được không?", answer: "Có. Các báo cáo bán hàng có thể xuất file hoặc in trực tiếp, lọc theo chi nhánh, thời gian và hàng hóa." },
      { question: "Muốn triển khai cho trạm của tôi thì liên hệ ở đâu?", answer: "Để lại thông tin ở trang Liên hệ, iOrder sẽ khảo sát số cửa hàng, nhóm hàng và đề xuất phương án triển khai phù hợp." },
    ] } },
    { type: "cta", isEnabled: true, data: { id: "tu-van", eyebrow: "Triển khai cho trạm dừng nghỉ", title: "Nhận tư vấn phần mềm bán hàng cho trạm của bạn", action: action("Nhận tư vấn", "/contact") } },
  ];

  // ---------- Sản phẩm (chỉ tạo nếu chưa có) ----------
  const [existing] = await db.select({ id: offerings.id }).from(offerings).where(and(eq(offerings.slug, slug), isNull(offerings.deletedAt))).limit(1);
  if (existing) {
    log("Sản phẩm: đã có, bỏ qua");
  } else {
    const summary = "Quản lý bán hàng cho trạm dừng nghỉ nhiều cửa hàng: trung tâm điều hành, hàng hóa, giao dịch, sổ quỹ và báo cáo trên một hệ thống.";
    await createAdminOffering({
      coverMediaId: goods, type: "software", title: "Phần mềm quản lý bán hàng cho trạm dừng nghỉ", slug, summary,
      content: {
        description: "Giải pháp bán hàng cho trạm dừng nghỉ có nhiều cửa hàng và hộ kinh doanh: một trung tâm điều hành cho quản trị viên và kế toán, danh mục hàng hóa dùng chung, theo dõi doanh thu theo từng cửa hàng và báo cáo bán hàng nhiều góc nhìn.",
        tags: ["Trạm dừng nghỉ", "Nhiều cửa hàng", "Bán lẻ"], category: "Trạm dừng nghỉ",
        bestFor: "Trạm dừng nghỉ, trạm xăng dầu và khu dịch vụ có nhiều cửa hàng, quán cà phê, minimart",
        keyValue: "Quản lý cả trạm trên một hệ thống, mỗi cửa hàng vẫn bán độc lập",
        metrics: ["Nhiều cửa hàng, một trung tâm điều hành", "Báo cáo theo thời gian thực"],
        features: ["Trung tâm điều hành đa chi nhánh", "Danh mục hàng hóa, combo và vé xe", "Theo dõi doanh thu theo từng cửa hàng", "Sổ quỹ và báo cáo bán hàng"],
        benefits: ["Nhìn toàn trạm trên một màn hình", "Đối soát nhanh cho kế toán"],
        faq: blocks.flatMap((block) => block.type === "faq" ? block.data.items.map((item) => [item.question, item.answer] as [string, string]) : []),
        items: [{ title: "Phần mềm quản lý bán hàng iOrder", href: "/software/phan-mem-quan-ly-ban-hang-iorder" }, { title: "Thiết bị bán hàng", href: "/equipment" }, { title: "Liên hệ tư vấn", href: "/contact" }],
        pricing: null, appearance: {}, blocks,
      },
      icon: "store", status: "published", scheduledAt: null, sortOrder: 3, isFeatured: true,
      seoTitle: "Phần mềm quản lý bán hàng trạm dừng nghỉ - iOrder", seoDescription: summary.slice(0, 175), canonicalUrl: null,
    }, uid);
    log("Sản phẩm: đã tạo và xuất bản");
  }

  // ---------- Menu đầu trang và chân trang (thêm mục con dưới "Sản phẩm", ngay sau phần mềm bán hàng iOrder) ----------
  for (const [location, label] of [["header", "Phần mềm bán hàng cho trạm dừng nghỉ"], ["footer", "Bán hàng cho trạm dừng nghỉ"]] as const) {
    const current = await getAdminNavigation(location);
    if (current.items.some((entry) => entry.url === path)) { log(`Menu ${location}: đã có, bỏ qua`); continue; }
    const parent = current.items.find((entry) => entry.parentKey === null && entry.url === "/software");
    if (!parent) { log(`Menu ${location}: không thấy mục "Sản phẩm", bỏ qua`); continue; }
    const items = current.items.map(({ key, label: name, url, parentKey, linkType, contentId, target, isEnabled }) => ({ key, label: name, url, parentKey, linkType, contentId, target, isEnabled }));
    const created = { key: `${location}-${slug}`, label, url: path, parentKey: parent.key, linkType: "custom" as const, contentId: null, target: "_self" as const, isEnabled: true };
    const firstChild = items.findIndex((entry) => entry.parentKey === parent.key);
    items.splice(firstChild >= 0 ? firstChild + 1 : items.length, 0, created);
    await saveNavigation(location, items, uid, { expectedVersion: current.version, changeNote: "Thêm phần mềm bán hàng cho trạm dừng nghỉ" });
    log(`Menu ${location}: đã thêm`);
  }

  // ---------- Trang chủ: phần "Hệ sinh thái" + khối "Phần mềm theo mô hình kinh doanh" ----------
  // Thẻ Phần mềm ở vòng tròn rút còn một câu; ngay sau đó là lưới thẻ ảnh, mỗi phần mềm một thẻ có liên kết riêng.
  // Khối ảnh động trạm dừng nghỉ đã thêm trước đó (mã neo "tram-dung-nghi") được thay bằng lưới thẻ này.
  const home = await getAdminPageBySlug("home");
  if (!home) return log("Trang chủ: chưa có, bỏ qua");
  const coverOf = async (offeringSlug: string) => {
    const [row] = await db.select({ id: offerings.id }).from(offerings).where(and(eq(offerings.slug, offeringSlug), isNull(offerings.deletedAt))).limit(1);
    return row ? (await getAdminOfferingById(row.id))?.coverMediaId ?? null : null;
  };
  const card = (title: string, description: string, href: string, mediaId: string | null) => ({ title, description, href, mediaId, icon: null, background: null });
  const grid: PageBlock = {
    type: "features", isEnabled: true,
    data: {
      cardStyle: "visual", eyebrow: "Phần mềm theo mô hình kinh doanh", title: "Chọn phần mềm phù hợp với cách bạn kinh doanh",
      description: "Mỗi mô hình có một phần mềm riêng, cùng một nền tảng và đội ngũ hỗ trợ iOrder.",
      items: [
        card("Quản lý bán hàng iOrder", "Cho nhà hàng, quán cà phê, cửa hàng bán lẻ và chuỗi: bán hàng, gọi món, kho và báo cáo.", "/software/phan-mem-quan-ly-ban-hang-iorder", await coverOf("phan-mem-quan-ly-ban-hang-iorder")),
        card("Bán hàng cho trạm dừng nghỉ", "Cho trạm có nhiều cửa hàng, hộ kinh doanh: trung tâm điều hành, hàng hóa dùng chung, doanh thu theo cửa hàng.", path, goods),
        card("Quản lý trạm sạc xe điện", "Cho chủ trạm sạc, bãi đỗ xe: theo dõi trụ sạc, phiên sạc, thanh toán và doanh thu.", "/software/phan-mem-quan-ly-tram-sac-xe-dien-iorder-ev", await coverOf("phan-mem-quan-ly-tram-sac-xe-dien-iorder-ev")),
        card("Hóa đơn điện tử, chữ ký số", "Cho doanh nghiệp và hộ kinh doanh: xuất hóa đơn ngay khi bán, ký số và gửi cho khách.", "/software/hoa-don-dien-tu-chu-ky-so", await coverOf("hoa-don-dien-tu-chu-ky-so")),
      ],
    },
    appearance: { anchor: gridAnchor, tone: "auto", spacing: "auto", width: null, backgroundColor: null, backgroundMediaId: null, backgroundOverlay: 80 },
  } as PageBlock;

  // Phần "Hệ sinh thái": kiểu quỹ đạo → ảnh ghép; thẻ Phần mềm liệt kê bốn phần mềm (mỗi dòng một ý).
  const isEcosystem = (item: PageBlock) => item.type === "features" && ["orbit", "mosaic"].includes((item.data as { cardStyle?: string }).cardStyle ?? "");
  const softwareLines = ["Quản lý bán hàng iOrder", "Bán hàng cho trạm dừng nghỉ", "Quản lý trạm sạc xe điện", "Hóa đơn điện tử, chữ ký số"].join("\n");
  let changed = false;
  const next = home.blocks.map((item): PageBlock => {
    if (!isEcosystem(item)) return item;
    const data = item.data as { cardStyle?: string; items: { title: string; description: string }[] };
    const first = data.items[0];
    const softwareCard = first && first.title === "Phần mềm" && !first.description.includes("\n");
    if (data.cardStyle === "mosaic" && !softwareCard) return item;
    changed = true;
    return { ...item, data: { ...data, cardStyle: "mosaic", items: softwareCard ? [{ ...first, description: softwareLines }, ...data.items.slice(1)] : data.items } } as PageBlock;
  });
  if (!next.some((item) => item.appearance?.anchor === gridAnchor)) {
    const old = next.findIndex((item) => item.appearance?.anchor === anchor);
    if (old >= 0) next[old] = grid;
    else next.splice(Math.max(next.findIndex(isEcosystem) + 1, 0) || next.length, 0, grid);
    changed = true;
  }
  // Phần đánh giá (dữ liệu mẫu) được thay bằng dải ảnh trượt tự động. Ảnh tạm là ảnh sản phẩm trong thư viện (thay bằng ảnh cửa hàng thật trong CMS);
  // không có đủ ảnh thì dùng các màn hình hệ thống đã che thông tin. Khối đã có chỉ bị thay khi vẫn còn nội dung tạm do script này tạo (thẻ đầu "Trung tâm điều hành").
  const productImageIds = ["32c35f63-0180-418f-acbd-90b3139ab155", "c989e473-051a-446b-af15-ee53f464c97b", "7c7eea26-f915-490a-ad0b-bba4afeb5dac", "b7c6af00-12ae-49cf-b05e-c1755f7236e7", "f2bedba7-b043-4f84-831f-f7b33b5f2f1a", "99c91bf8-c895-48aa-a323-462a3bce2833"];
  const present = new Set((await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, productImageIds), isNull(mediaAssets.deletedAt)))).map((row) => row.id));
  const product = productImageIds.every((id) => present.has(id));
  const posPage = "/software/phan-mem-quan-ly-ban-hang-iorder";
  const slide = (title: string, description: string, mediaId: string, href: string = path) => ({ title, description, href, mediaId, icon: null, background: null });
  const sliderItems = product
    ? [
      slide("Bán hàng tại quầy", "Chọn món, thu ngân, in bếp và in hóa đơn ngay trên một màn hình.", productImageIds[0], posPage),
      slide("Ứng dụng trên điện thoại", "Chủ cửa hàng xem doanh thu, đơn hàng và lợi nhuận mọi lúc.", productImageIds[4], posPage),
      slide("Báo cáo doanh thu", "Doanh thu, hàng bán chạy và nhân viên nổi bật trên một màn hình.", productImageIds[3], posPage),
      slide("Bộ thiết bị bán hàng", "Máy POS, máy in hóa đơn, máy in bếp và két tiền.", productImageIds[5], "/equipment"),
      slide("Quản lý bàn", "Theo dõi bàn trống và bàn đang phục vụ theo từng khu vực.", productImageIds[1], posPage),
      slide("Quản lý hóa đơn", "Tra cứu, lọc và xem lại hóa đơn theo thời gian và trạng thái.", productImageIds[2], posPage),
    ]
    : [
      slide("Trung tâm điều hành", "Quản lý toàn bộ cửa hàng trong trạm từ một nơi.", hub),
      slide("Tổng quan bán hàng", "Doanh thu và hoạt động từng cửa hàng theo thời gian thực.", overview),
      slide("Hàng hóa tập trung", "Một danh mục dùng chung, áp dụng theo từng cửa hàng.", goods),
      slide("Báo cáo nhiều góc nhìn", "Theo chi nhánh, danh mục, chi tiết; xuất file và in.", report),
    ];
  const slider = {
    type: "features", isEnabled: true,
    data: {
      cardStyle: "slider", eyebrow: product ? "Trải nghiệm iOrder" : "Hình ảnh thực tế", title: product ? "iOrder trên mọi thiết bị" : "iOrder trong vận hành thực tế",
      description: product ? "Bán hàng, quản lý bàn, hóa đơn và báo cáo trên máy tính, máy POS và điện thoại." : "Một số hình ảnh từ hệ thống đang vận hành tại các cửa hàng và trạm dừng nghỉ.",
      items: sliderItems,
    },
    appearance: { anchor: sliderAnchor, tone: "tinted", spacing: "auto", width: null, backgroundColor: null, backgroundMediaId: null, backgroundOverlay: 80 },
  } as unknown as PageBlock;
  const existingSlider = next.findIndex((item) => item.appearance?.anchor === sliderAnchor);
  if (existingSlider >= 0) {
    const first = (next[existingSlider].data as { items?: { title?: string }[] }).items?.[0]?.title;
    if (first === "Trung tâm điều hành" && product) { next[existingSlider] = slider; changed = true; }
  } else {
    const index = next.findIndex((item) => item.type === "testimonials");
    if (index >= 0) { next[index] = slider; changed = true; }
  }
  if (!changed) return log("Trang chủ: đã đúng, bỏ qua");
  const { id, draftVersion, publishedAt, updatedAt, ...values } = home;
  void publishedAt; void updatedAt;
  await saveAdminPage(id, { ...values, blocks: next }, uid, { expectedVersion: draftVersion });
  log("Trang chủ: đã cập nhật phần Hệ sinh thái và thêm lưới phần mềm");
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

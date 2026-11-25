import "dotenv/config";

import { and, eq, ilike, isNull } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { offerings, posts, salesEquipment, users } from "../packages/shared/src/db/schema";
import { getEquipmentById, writeEquipment } from "../packages/shared/src/server/equipment/equipment.service";
import { editAdminMedia, getMediaById } from "../packages/shared/src/server/media/media.service";
import { adminPostInputSchema } from "../packages/shared/src/server/posts/posts.contract";
import { getAdminPostById, updateAdminPost } from "../packages/shared/src/server/posts/posts.service";
import { adminOfferingInputSchema } from "../packages/shared/src/server/offerings/offering-content.contract";
import { getAdminOfferingById, updateAdminOffering } from "../packages/shared/src/server/offerings/offerings.service";
import { pageInputSchema } from "../packages/shared/src/server/pages/pages.contract";
import { getAdminPageBySlug, saveAdminPage } from "../packages/shared/src/server/pages/pages.service";
import { equipmentInputSchema } from "../packages/shared/src/server/equipment/equipment.contract";
import { seoDescriptionLimit, seoDescriptionMin, seoTitleLimit, seoTitleMin, withBrand } from "../packages/shared/src/server/shared/seo";

// Bổ sung SEO còn thiếu hoặc chưa đủ chuẩn cho trang, thiết bị, offering, từ khóa chính của bài (hết trùng cụm từ giữa hai nội dung), mô tả ảnh bìa và đưa liên kết thiết bị hỏng ở trang /equipment về đúng thiết bị.
// Chỉ ghi đè trường SEO khi đang TRỐNG hoặc ngoài chuẩn Google (tiêu đề hiển thị 30–60 ký tự, mô tả 70–155); trường đã đạt chuẩn giữ nguyên,
// nên chạy lại nhiều lần an toàn (lần sau không còn gì để đổi). Lưu qua CMS nên có phiên bản mới kèm lịch sử, bản cũ khôi phục được.
//   pnpm db:fill:seo-gaps              ghi vào CMS
//   pnpm db:fill:seo-gaps --dry-run    chỉ cho biết sẽ đổi gì
// Website lưu nội dung công khai tối đa vài chục giây nên trang công khai cập nhật chậm một chút.
// Nội dung dưới đây bám đúng chữ đang có trên từng trang; người vận hành chỉnh lại trong CMS khi cần.
const dryRun = process.argv.includes("--dry-run");
const changeNote = "Bổ sung SEO còn thiếu";

type Seo = { seoTitle?: string; seoDescription?: string };

const pageSeo: Record<string, Seo> = {
  "listing-guides": { seoTitle: "Hướng dẫn sử dụng iOrder: bán hàng, kết ca, báo cáo", seoDescription: "Tài liệu hướng dẫn thiết lập, bán hàng, kho, hóa đơn điện tử, kết ca, thu chi và báo cáo để vận hành cửa hàng với iOrder từng bước." },
  terms: { seoTitle: "Điều khoản dịch vụ iOrder: phạm vi, bảo mật, trách nhiệm", seoDescription: "Điều khoản áp dụng khi sử dụng dịch vụ iOrder: phạm vi áp dụng, sử dụng hợp pháp, quyền sở hữu trí tuệ, bảo mật dữ liệu, hỗ trợ và giới hạn trách nhiệm." },
  "support-faq": { seoTitle: "Câu hỏi thường gặp khi bắt đầu dùng iOrder", seoDescription: "Giải đáp các câu hỏi phổ biến khi bắt đầu dùng iOrder: dùng thử trước khi đăng ký, nhập dữ liệu ban đầu, nhiều chi nhánh và vận hành hằng ngày." },
  "listing-news": { seoDescription: "Cập nhật sản phẩm, ưu đãi và kinh nghiệm vận hành cửa hàng, nhà hàng, quán cà phê: thực đơn, kết ca, tồn kho, báo cáo doanh thu từ iOrder." },
  "listing-equipment": { seoTitle: "Thiết bị bán hàng: máy POS, máy in, máy quét | iOrder", seoDescription: "Máy POS, máy in hóa đơn, máy quét mã vạch, két đựng tiền và vật tư in đã kiểm thử với iOrder; tư vấn cấu hình theo mô hình cửa hàng của bạn." },
  "listing-software": { seoTitle: "Phần mềm bán hàng, trạm sạc, hóa đơn điện tử | iOrder", seoDescription: "Phần mềm bán hàng cho nhà hàng, cà phê, bán lẻ; quản lý trạm sạc xe điện; hóa đơn điện tử và chữ ký số. iOrder tư vấn triển khai theo nhu cầu." },
  "listing-support": { seoTitle: "Hỗ trợ cài đặt iOrder: driver, máy in, kết nối thiết bị", seoDescription: "Tải driver máy in, tài liệu cài đặt và làm theo hướng dẫn kết nối máy in hóa đơn với iOrder; chưa tự cài được thì nhờ hỗ trợ từ xa." },
  "listing-solution": { seoTitle: "Giải pháp hạ tầng, camera, chuyển đổi số | iOrder" },
  "remote-support": { seoTitle: "Hỗ trợ từ xa iOrder: tải phần mềm điều khiển từ xa" },
  contact: { seoTitle: "Liên hệ tư vấn phần mềm, thiết bị bán hàng | iOrder" },
  "privacy-policy": { seoTitle: "Chính sách bảo mật iOrder: dữ liệu và quyền khách hàng" },
};

const equipmentSeo: Record<string, Seo> = {
  "may-pos-mini-cam-tay": { seoTitle: "Máy POS Mini Cầm Tay – Gọi Món Tại Bàn, Thanh Toán Ngay", seoDescription: "Máy POS mini cầm tay có máy in tích hợp để gọi món tại bàn và thanh toán ngay tại chỗ. Bảo hành 12 tháng, iOrder tư vấn và cài đặt." },
  "may-quet-ma-vach": { seoTitle: "Máy Quét Mã Vạch 1D, 2D, QR – Quét Giấy Và Điện Thoại", seoDescription: "Máy quét mã vạch SC-2D đọc mã 1D, 2D và QR trên giấy lẫn màn hình điện thoại, dùng được với phần mềm bán hàng iOrder. Bảo hành 12 tháng." },
};

const offeringSeo: Record<string, Seo> = {
  "hoa-don-dien-tu-chu-ky-so": { seoTitle: "Hóa đơn điện tử tích hợp bán hàng: VNPT, Viettel, BKAV", seoDescription: "Xuất hóa đơn điện tử ngay từ đơn bán hàng trên iOrder. Kết nối VNPT, Viettel, MobiFone, BKAV, MeInvoice, VietInvoice và theo dõi trạng thái hóa đơn." },
};

// Từ khóa chính (chỉ để trợ lý SEO của CMS chấm điểm, website không in ra). Đổi khi từ khóa cũ trùng với nội dung khác (hai nội dung cùng nhắm một cụm sẽ
// cạnh tranh nhau) hoặc không có trong tiêu đề/đoạn mở đầu của chính bài. Chỉ đổi khi từ khóa hiện tại còn đúng giá trị cũ ghi ở đây.
// `intro`: sửa đúng một câu mở đầu (chỉ đổi khi câu cũ còn nguyên) để từ khóa chính xuất hiện ngay đoạn đầu bài mà không phải dùng từ khóa quá chung.
const postKeywords: Record<string, { from: string | string[]; to: string; intro?: [string, string] }> = {
  "phan-quyen-nhan-vien-ban-hang": { from: "phân quyền nhân viên", to: "phân quyền nhân viên bán hàng" },
  "quan-ly-cong-no-khach-hang-quen": { from: "công nợ khách hàng", to: "quản lý công nợ khách hàng" },
  "iorder-ra-mat-giao-dien-ban-hang-moi": { from: "Phần mềm quản lý bán hàng", to: "giao diện bán hàng" },
  "ket-ca": { from: ["kết ca bán hàng", "kết ca"], to: "kết ca bán hàng", intro: ["Kết ca dùng để ghi nhận", "Kết ca bán hàng dùng để ghi nhận"] },
  "kho-hang": { from: "quản lý kho hàng", to: "kho hàng" },
  "thu-chi": { from: "quản lý thu chi", to: "thu chi" },
};

// Mô tả SEO của thiết bị nêu "Bảo hành N tháng" khác số tháng bảo hành đang hiện trên chính trang thiết bị (và trong dữ liệu) thì khách thấy hai con số
// mâu thuẫn. Chưa biết số nào đúng nên chỉ bỏ câu bảo hành khỏi mô tả SEO (bản cũ khôi phục được từ lịch sử); số tháng của thiết bị do người vận hành chốt.
function withoutConflictingWarranty(description: string, warrantyMonths: number) {
  const claim = description.match(/bảo hành (\d+) tháng/i);
  if (!claim || Number(claim[1]) === warrantyMonths) return description;
  return description.replace(/,\s*bảo hành \d+ tháng\.$/i, ".").replace(/\s+Bảo hành \d+ tháng(?:, giá [^.]+)?\.$/, "");
}

// Mô tả ảnh bìa (alt) cho Google Hình ảnh và trình đọc màn hình; chỉ ghi khi ảnh chưa có mô tả. Ảnh đã được xem trực tiếp trước khi viết.
const coverAlt: Record<string, string> = {
  "phan-mem-quan-ly-tram-sac-xe-dien-iorder-ev": "Trụ sạc xe điện nhanh iOrder EV với hai đầu sạc và màn hình điều khiển ở giữa",
};

// Liên kết ở khối "Bộ thiết bị gợi ý" của /equipment trỏ tới hai thiết bị mẫu đã không còn (404): đưa về thiết bị thật tương ứng và
// sửa chữ mô tả cho khớp thiết bị đó (bỏ thông số của máy mẫu cũ như "250 mm/giây", "5 ngăn giấy").
const equipmentLinkFix: Record<string, string> = {
  "/equipment/may-in-hoa-don-nhiet-80mm": "/equipment/may-in-hoa-don-iorder-iod86",
  "/equipment/ket-dung-tien": "/equipment/ket-dung-tien-at-410",
};
const equipmentLabelFix: Record<string, string> = {
  "Máy in hóa đơn nhiệt 80mm: hóa đơn, phiếu bếp/bar": "Máy in hóa đơn iOrder IOD86: hóa đơn, phiếu bếp/bar",
  "Két đựng tiền: tự mở khi in hóa đơn": "Két đựng tiền AT-410: tự mở khi in hóa đơn",
  "Máy in hóa đơn nhiệt 80mm: in hóa đơn, báo bếp": "Máy in hóa đơn iOrder IOD86: in hóa đơn, báo bếp",
  "Két đựng tiền: 5 ngăn giấy, 4 ngăn xu": "Két đựng tiền AT-410: dùng cùng máy POS và máy in hóa đơn",
  "Máy in hóa đơn nhiệt 80mm: 250 mm/giây, tự cắt giấy": "Máy in hóa đơn iOrder IOD86: in nhanh, nét rõ",
  "Két đựng tiền: thép sơn tĩnh điện": "Két đựng tiền AT-410: chắc chắn, tự mở khi in hóa đơn",
};

const titleOk = (value: string | null | undefined) => {
  const effective = value ? withBrand(value) : "";
  return effective.length >= seoTitleMin && effective.length <= seoTitleLimit;
};
const descriptionOk = (value: string | null | undefined) => Boolean(value) && value!.length >= seoDescriptionMin && value!.length <= seoDescriptionLimit;

// Nội dung đề xuất cũng phải đạt chuẩn, để chạy xong không còn cảnh báo.
function checkProposal(label: string, seo: Seo) {
  if (seo.seoTitle && !titleOk(seo.seoTitle)) throw new Error(`${label}: tiêu đề đề xuất ngoài chuẩn (${withBrand(seo.seoTitle).length} ký tự).`);
  if (seo.seoDescription && !descriptionOk(seo.seoDescription)) throw new Error(`${label}: mô tả đề xuất ngoài chuẩn (${seo.seoDescription.length} ký tự).`);
}

function pick<T extends Record<string, unknown>>(source: T, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}

// Chỉ trả về phần cần đổi: trường đang đạt chuẩn thì bỏ qua.
function neededSeo(current: { seoTitle: string | null; seoDescription: string | null }, proposal: Seo): Seo {
  return {
    ...(proposal.seoTitle && !titleOk(current.seoTitle) ? { seoTitle: proposal.seoTitle } : {}),
    ...(proposal.seoDescription && !descriptionOk(current.seoDescription) ? { seoDescription: proposal.seoDescription } : {}),
  };
}

const describe = (label: string, current: { seoTitle: string | null; seoDescription: string | null }, change: Seo) => {
  for (const [field, value] of Object.entries(change) as [keyof Seo, string][]) console.log(`  ${label} ${field}: "${current[field] ?? ""}" -> "${value}"`);
};

async function run() {
  for (const [slug, seo] of [...Object.entries(pageSeo), ...Object.entries(equipmentSeo), ...Object.entries(offeringSeo)]) checkProposal(slug, seo);

  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const [administrator] = username ? await getDb().select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1) : [];
  if (!administrator && !dryRun) throw new Error("Không tìm thấy tài khoản quản trị (INITIAL_ADMIN_USERNAME) để lưu.");
  const editorId = administrator?.id ?? "";
  let changed = 0;

  for (const [slug, proposal] of Object.entries(pageSeo)) {
    const page = await getAdminPageBySlug(slug);
    if (!page) { console.log(`Bỏ qua trang ${slug}: chưa có trong CMS.`); continue; }
    const change = neededSeo(page, proposal);
    let linksFixed = 0;
    const blocks = slug !== "listing-equipment" ? page.blocks : page.blocks.map((block) => {
      if (block.type !== "grouped_list") return block;
      const groups = block.data.groups.map((group) => ({ ...group, items: group.items.map((item) => {
        const href = item.href ? equipmentLinkFix[item.href] : undefined;
        if (!href) return item;
        linksFixed += 1;
        return { ...item, href, label: equipmentLabelFix[item.label] ?? item.label };
      }) }));
      return { ...block, data: { ...block.data, groups } };
    });
    if (!Object.keys(change).length && !linksFixed) continue;
    changed += 1;
    console.log(`Trang ${slug}:`);
    describe("SEO", page, change);
    if (linksFixed) console.log(`  Sửa ${linksFixed} liên kết thiết bị hỏng ở khối "Bộ thiết bị gợi ý".`);
    if (dryRun) continue;
    const input = pageInputSchema.parse({ ...pick(page, Object.keys(pageInputSchema.shape)), ...change, blocks });
    await saveAdminPage(page.id, input, editorId, { expectedVersion: page.draftVersion, changeNote: linksFixed ? `${changeNote} và sửa liên kết thiết bị` : changeNote });
  }

  for (const [slug, proposal] of Object.entries(equipmentSeo)) {
    const [row] = await getDb().select({ id: salesEquipment.id }).from(salesEquipment).where(and(eq(salesEquipment.slug, slug), isNull(salesEquipment.deletedAt))).limit(1);
    const item = row ? await getEquipmentById(row.id) : undefined;
    if (!item) { console.log(`Bỏ qua thiết bị ${slug}: chưa có trong CMS.`); continue; }
    const change = neededSeo(item, proposal);
    if (!Object.keys(change).length) continue;
    changed += 1;
    console.log(`Thiết bị ${slug}:`);
    describe("SEO", item, change);
    if (dryRun) continue;
    await writeEquipment("items", item.id, { ...pick(item, Object.keys(equipmentInputSchema.shape)), ...change }, editorId, changeNote, item.version);
  }

  const warrantyRows = await getDb().select({ id: salesEquipment.id }).from(salesEquipment).where(and(ilike(salesEquipment.seoDescription, "%bảo hành%"), isNull(salesEquipment.deletedAt)));
  for (const row of warrantyRows) {
    const item = await getEquipmentById(row.id);
    if (!item?.seoDescription) continue;
    const fixed = withoutConflictingWarranty(item.seoDescription, item.warrantyMonths);
    if (fixed === item.seoDescription) continue;
    if (!descriptionOk(fixed)) { console.log(`Bỏ qua mô tả bảo hành của ${item.slug}: sau khi bỏ câu bảo hành không còn đạt 70–155 ký tự.`); continue; }
    changed += 1;
    console.log(`Thiết bị ${item.slug} (bảo hành ${item.warrantyMonths} tháng):`);
    describe("SEO", item, { seoDescription: fixed });
    if (dryRun) continue;
    await writeEquipment("items", item.id, { ...pick(item, Object.keys(equipmentInputSchema.shape)), seoDescription: fixed }, editorId, "Bỏ số tháng bảo hành mâu thuẫn khỏi mô tả SEO", item.version);
  }

  for (const [slug, proposal] of Object.entries(offeringSeo)) {
    const [row] = await getDb().select({ id: offerings.id }).from(offerings).where(and(eq(offerings.slug, slug), isNull(offerings.deletedAt))).limit(1);
    const offering = row ? await getAdminOfferingById(row.id) : undefined;
    if (!offering) { console.log(`Bỏ qua offering ${slug}: chưa có trong CMS.`); continue; }
    const change = neededSeo(offering, proposal);
    if (!Object.keys(change).length) continue;
    changed += 1;
    console.log(`Offering ${slug}:`);
    describe("SEO", offering, change);
    if (dryRun) continue;
    await updateAdminOffering(offering.id, adminOfferingInputSchema.parse({ ...pick(offering, Object.keys(adminOfferingInputSchema.shape)), ...change }), editorId, changeNote, offering.draftVersion);
  }

  for (const [slug, keyword] of Object.entries(postKeywords)) {
    const rows = await getDb().select({ id: posts.id }).from(posts).where(and(eq(posts.slug, slug), isNull(posts.deletedAt)));
    for (const row of rows) {
      const post = await getAdminPostById(row.id);
      if (!post) continue;
      const current = post.seo?.focusKeyword;
      const needKeyword = current !== keyword.to && (Array.isArray(keyword.from) ? keyword.from : [keyword.from]).includes(current ?? "");
      const serialized = JSON.stringify(post.content);
      const needIntro = Boolean(keyword.intro) && serialized.split(keyword.intro![0]).length === 2 && !serialized.includes(keyword.intro![1]);
      if (!needKeyword && !needIntro) continue;
      changed += 1;
      console.log(`Bài ${slug}:`);
      if (needKeyword) console.log(`  Từ khóa chính: "${current}" -> "${keyword.to}"`);
      if (needIntro) console.log(`  Câu mở đầu: "${keyword.intro![0]}…" -> "${keyword.intro![1]}…"`);
      if (dryRun) continue;
      const content = needIntro ? JSON.parse(serialized.replace(keyword.intro![0], keyword.intro![1])) : post.content;
      const input = adminPostInputSchema.parse({ ...pick(post, Object.keys(adminPostInputSchema.shape)), content, seo: { ...post.seo, ...(needKeyword ? { focusKeyword: keyword.to } : {}) } });
      try {
        await updateAdminPost(post.id, input, editorId, changeNote, post.draftVersion);
      } catch (error) {
        console.log(`  Bỏ qua (${error instanceof Error ? error.message : "không lưu được"}); bài có thể đang bị khóa.`);
        changed -= 1;
      }
    }
  }

  for (const [slug, altText] of Object.entries(coverAlt)) {
    const [row] = await getDb().select({ coverMediaId: offerings.coverMediaId }).from(offerings).where(and(eq(offerings.slug, slug), isNull(offerings.deletedAt))).limit(1);
    const media = row?.coverMediaId ? await getMediaById(row.coverMediaId) : null;
    if (!media || media.altText?.trim()) continue;
    changed += 1;
    console.log(`Ảnh bìa của ${slug}:
  Mô tả ảnh (alt): "" -> "${altText}"`);
    if (!dryRun) await editAdminMedia(media.id, { altText, caption: media.caption ?? null, expectedVersion: media.version }, editorId);
  }

  console.log(changed ? (dryRun ? `Sẽ đổi ${changed} mục (chạy không có --dry-run để ghi).` : `Đã bổ sung SEO cho ${changed} mục.`) : "SEO đã đủ chuẩn, không có gì để đổi.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể bổ sung SEO.");
  process.exit(1);
});

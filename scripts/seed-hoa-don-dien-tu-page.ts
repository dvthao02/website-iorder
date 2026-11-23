// Dựng trang "Hóa đơn điện tử - Chữ ký số" (/software/hoa-don-dien-tu-chu-ky-so) từ hai màn hình thật của iOrder:
// Thiết lập kết nối hóa đơn điện tử (VNPT, Viettel, MobiFone, BKAV, MeInvoice, VietInvoice) và màn hình Hóa đơn (cột Hoá đơn điện tử, bộ lọc Xuất HDDT).
// Ảnh nằm ở scripts/data/hoa-don-dien-tu; ảnh màn hình Hóa đơn đã làm mờ tên cửa hàng, doanh thu, mã đơn, tên bàn và khách hàng.
// Nội dung chỉ nêu những gì nhìn thấy trên màn hình và những gì trang đã nói trước đó. Chỉ thêm, không ghi đè: trang đã có phần "Kết nối" thì bỏ qua.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { mediaAssets, users } from "../packages/shared/src/db/schema";
import { editAdminMedia, uploadAdminMedia } from "../packages/shared/src/server/media/media.service";
import { getAdminOfferings, updateAdminOffering } from "../packages/shared/src/server/offerings/offerings.service";
import { pageBlockInputSchema, type PageBlock } from "../packages/shared/src/server/pages/pages.contract";

const slug = "hoa-don-dien-tu-chu-ky-so";
const connectTitle = "Chọn nhà cung cấp hóa đơn ngay trong iOrder";
const dataDir = resolve(process.cwd(), "scripts/data/hoa-don-dien-tu");
const providers = ["VNPT", "Viettel", "MobiFone", "BKAV", "MeInvoice", "VietInvoice"];

async function image(userId: string, file: string, altText: string, caption: string) {
  const [existing] = await getDb().select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.originalName, file), isNull(mediaAssets.deletedAt))).limit(1);
  if (existing) return existing.id;
  const asset = await uploadAdminMedia(new File([await readFile(resolve(dataDir, file))], file, { type: "image/png" }), userId);
  await editAdminMedia(asset.id, { altText, caption, expectedVersion: asset.version }, userId);
  return asset.id;
}

const card = (icon: string, title: string, description: string) => ({ title, description, href: null, icon, mediaId: null, extraMediaIds: [] as string[] });

async function run() {
  const [admin] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!admin) throw new Error("Chưa có tài khoản quản trị để ghi nhận thay đổi.");
  const offering = (await getAdminOfferings()).find((item) => item.slug === slug);
  if (!offering) throw new Error("Chưa có sản phẩm Hóa đơn điện tử.");
  const blocks = offering.content.blocks ?? [];
  if (blocks.some((block) => block.type === "media_text" && block.data.title === connectTitle)) return console.log("Trang hóa đơn điện tử: đã dựng, bỏ qua");

  const connect = await image(admin.id, "hoa-don-dien-tu-thiet-lap-ket-noi.png", "Màn hình Thiết lập kết nối hóa đơn điện tử trên iOrder với các nhà cung cấp VNPT, Viettel, MobiFone, BKAV, MeInvoice, VietInvoice", "Thiết lập kết nối hóa đơn điện tử: chọn nhà cung cấp");
  const list = await image(admin.id, "hoa-don-dien-tu-danh-sach-hoa-don.png", "Màn hình Hóa đơn của iOrder với cột Hoá đơn điện tử và bộ lọc Xuất HDDT (đã làm mờ dữ liệu cửa hàng)", "Danh sách hóa đơn với trạng thái hóa đơn điện tử");

  const [heroBlock, ...rest] = blocks;
  if (!heroBlock || heroBlock.type !== "hero") throw new Error("Cần chạy db:seed:offering-hero-blocks trước.");
  const find = (type: PageBlock["type"], title: string) => rest.find((block) => block.type === type && "title" in block.data && block.data.title === title);
  const overview = rest.find((block) => block.type === "media_text");
  const features = find("features", "Tính năng chính");
  const benefits = find("features", "Lợi ích mang lại");
  const faqBlock = rest.find((block) => block.type === "faq");
  if (!overview || !features || !benefits || !faqBlock || faqBlock.type !== "faq") throw new Error("Trang không còn đủ các phần cơ bản (Tổng quan, Tính năng, Lợi ích, Hỏi đáp).");

  const hero = { ...heroBlock, data: { ...heroBlock.data,
    description: "Xuất hóa đơn điện tử ngay từ đơn bán hàng trên iOrder. Kết nối VNPT, Viettel, MobiFone, BKAV, MeInvoice hoặc VietInvoice trong một màn hình thiết lập.",
    mediaId: list,
    extraMediaIds: [connect] } };
  const next = [
    hero,
    overview,
    { type: "media_text", isEnabled: true, data: { layout: "image_right", tone: "light", eyebrow: "Kết nối", title: connectTitle, description: "iOrder có màn hình Thiết lập kết nối hóa đơn điện tử: chọn nhà cung cấp doanh nghiệp đang dùng rồi kết nối để xuất hóa đơn từ đơn bán hàng.", bullets: ["Chọn nhà cung cấp ngay trong màn hình Thiết lập kết nối hóa đơn điện tử", `Hỗ trợ ${providers.length} nhà cung cấp: ${providers.join(", ")}`], mediaId: connect, extraMediaIds: [], primaryAction: null, secondaryAction: null } },
    { type: "features", isEnabled: true, data: { cardStyle: "compact", eyebrow: "Nhà cung cấp", title: `${providers.length} nhà cung cấp hóa đơn điện tử được hỗ trợ`, description: "Doanh nghiệp đang dùng nhà cung cấp nào thì chọn đúng nhà cung cấp đó trong iOrder.", items: providers.map((name) => card("receipt", name, `Chọn ${name} trong màn hình Thiết lập kết nối để xuất hóa đơn điện tử từ iOrder.`)) } },
    { type: "process", isEnabled: true, data: { eyebrow: "Quy trình", title: "Từ đơn bán hàng đến hóa đơn điện tử", description: null, items: [
      card("settings", "Thiết lập kết nối", "Vào Thiết lập kết nối hóa đơn điện tử và chọn nhà cung cấp đang dùng."),
      card("shopping-cart", "Bán hàng như bình thường", "Thu ngân tạo đơn và thanh toán trên màn hình Bán hàng."),
      card("receipt", "Xuất hóa đơn điện tử", "Hóa đơn điện tử được tạo từ đơn bán hàng, không phải nhập lại thông tin."),
      card("clock", "Theo dõi trạng thái", "Xem hóa đơn ở trạng thái Chưa xuất, Đã xuất, Đã phát hành hoặc Lỗi trong màn hình Hóa đơn."),
    ] } },
    { type: "media_text", isEnabled: true, data: { layout: "image_left", tone: "light", eyebrow: "Quản lý hóa đơn", title: "Biết hóa đơn nào đã xuất, hóa đơn nào còn chờ", description: "Màn hình Hóa đơn có cột Hoá đơn điện tử cho từng đơn và bộ lọc Xuất HDDT, giúp chủ cửa hàng và kế toán tìm nhanh hóa đơn cần xử lý.", bullets: ["Bốn trạng thái hóa đơn điện tử: Chưa xuất, Đã xuất, Đã phát hành, Lỗi", "Lọc theo thời gian, trạng thái đơn, người tạo, người bán và phương thức thanh toán", "Xuất danh sách hóa đơn ra file"], mediaId: list, extraMediaIds: [], primaryAction: null, secondaryAction: null } },
    features,
    benefits,
    { ...faqBlock, data: { ...faqBlock.data, items: [
      { question: "iOrder kết nối được với những nhà cung cấp hóa đơn điện tử nào?", answer: `iOrder hỗ trợ kết nối ${providers.join(", ")}. Doanh nghiệp chọn nhà cung cấp đang dùng trong màn hình Thiết lập kết nối hóa đơn điện tử.` },
      { question: "Làm sao biết hóa đơn nào đã xuất?", answer: "Màn hình Hóa đơn có cột Hoá đơn điện tử và bộ lọc Xuất HDDT với bốn trạng thái: Chưa xuất, Đã xuất, Đã phát hành và Lỗi." },
      ...faqBlock.data.items,
    ] } },
  ].map((block) => pageBlockInputSchema.parse(block));

  const { id, draftVersion, publishedAt, updatedAt, ...input } = offering;
  void publishedAt; void updatedAt;
  await updateAdminOffering(id, {
    ...input,
    seoTitle: "Hóa đơn điện tử tích hợp bán hàng, kết nối VNPT, Viettel, BKAV",
    seoDescription: "Xuất hóa đơn điện tử ngay từ đơn bán hàng trên iOrder. Kết nối VNPT, Viettel, MobiFone, BKAV, MeInvoice, VietInvoice và theo dõi trạng thái hóa đơn trong một màn hình.",
    content: { ...offering.content, blocks: next },
  }, admin.id, "Dựng trang Hóa đơn điện tử: kết nối nhà cung cấp, quy trình, trạng thái hóa đơn", draftVersion);
  console.log(`Trang hóa đơn điện tử: đã dựng ${next.length} thành phần`);
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

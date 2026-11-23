// Ảnh minh họa có chú thích cho trang Hóa đơn điện tử (/software/hoa-don-dien-tu-chu-ky-so), dựng từ hai ảnh chụp màn hình iOrder (ảnh ở scripts/data/hoa-don-dien-tu):
//  - sơ đồ đơn bán hàng → nhà cung cấp hóa đơn điện tử → hóa đơn (thêm khối Hình ảnh ngay sau phần Tổng quan);
//  - màn hình Thiết lập kết nối và màn hình Hóa đơn có đánh số vùng cần chú ý (thay ảnh trong hai phần tương ứng; ảnh gốc vẫn dùng ở phần đầu trang).
// Chỉ thêm, không ghi đè nội dung khác; chạy lại an toàn. Cần chạy `pnpm db:seed:hoa-don-dien-tu` trước.
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
const statusTitle = "Biết hóa đơn nào đã xuất, hóa đơn nào còn chờ";
const dataDir = resolve(process.cwd(), "scripts/data/hoa-don-dien-tu");

async function image(userId: string, file: string, altText: string, caption: string) {
  const [existing] = await getDb().select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.originalName, file), isNull(mediaAssets.deletedAt))).limit(1);
  if (existing) return existing.id;
  const asset = await uploadAdminMedia(new File([await readFile(resolve(dataDir, file))], file, { type: "image/png" }), userId);
  await editAdminMedia(asset.id, { altText, caption, expectedVersion: asset.version }, userId);
  return asset.id;
}

async function run() {
  const [admin] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!admin) throw new Error("Chưa có tài khoản quản trị để ghi nhận thay đổi.");
  const offering = (await getAdminOfferings()).find((item) => item.slug === slug);
  if (!offering) throw new Error("Chưa có sản phẩm Hóa đơn điện tử.");
  const blocks = offering.content.blocks ?? [];
  const connectIndex = blocks.findIndex((block) => block.type === "media_text" && block.data.title === connectTitle);
  const statusIndex = blocks.findIndex((block) => block.type === "media_text" && block.data.title === statusTitle);
  if (connectIndex < 0 || statusIndex < 0) throw new Error("Cần chạy db:seed:hoa-don-dien-tu trước.");

  const diagram = await image(admin.id, "hoa-don-dien-tu-so-do-ket-noi.png", "Sơ đồ: đơn bán hàng trên iOrder, kết nối nhà cung cấp hóa đơn điện tử (VNPT, Viettel, MobiFone, BKAV, MeInvoice, VietInvoice), hóa đơn điện tử với các trạng thái Chưa xuất, Đã xuất, Đã phát hành, Lỗi", "Từ đơn bán hàng đến hóa đơn điện tử");
  const connect = await image(admin.id, "hoa-don-dien-tu-thiet-lap-ket-noi-chu-thich.png", "Màn hình Thiết lập kết nối hóa đơn điện tử, vùng chọn nhà cung cấp được đánh dấu", "Chọn nhà cung cấp hóa đơn điện tử đang dùng");
  const list = await image(admin.id, "hoa-don-dien-tu-danh-sach-hoa-don-chu-thich.png", "Màn hình Hóa đơn của iOrder: bộ lọc Xuất HDDT và cột Hoá đơn điện tử được đánh dấu (đã làm mờ dữ liệu cửa hàng)", "Bộ lọc Xuất HDDT và cột Hoá đơn điện tử");

  const next = blocks.map((block, index) => (index === connectIndex || index === statusIndex) && block.type === "media_text"
    ? { ...block, data: { ...block.data, mediaId: index === connectIndex ? connect : list } }
    : block);
  const hasDiagram = next.some((block) => block.type === "image" && block.data.mediaId === diagram);
  if (!hasDiagram) {
    const overviewIndex = next.findIndex((block, index) => index > 0 && block.type === "media_text");
    const diagramBlock = pageBlockInputSchema.parse({ type: "image", isEnabled: true, data: { mediaId: diagram, extraMediaIds: [], alt: null, caption: "Từ đơn bán hàng đến hóa đơn điện tử trên iOrder" } });
    next.splice(overviewIndex + 1, 0, diagramBlock);
  }
  const unchanged = JSON.stringify(next) === JSON.stringify(blocks);
  if (unchanged) return console.log("Ảnh minh họa hóa đơn điện tử: đã có, bỏ qua");

  const { id, draftVersion, publishedAt, updatedAt, ...input } = offering;
  void publishedAt; void updatedAt;
  await updateAdminOffering(id, { ...input, content: { ...offering.content, blocks: next as PageBlock[] } }, admin.id, "Thêm ảnh minh họa có chú thích cho trang Hóa đơn điện tử", draftVersion);
  console.log(`Ảnh minh họa hóa đơn điện tử: đã thêm (${next.length} thành phần)`);
}

run().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

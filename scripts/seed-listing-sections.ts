import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { users } from "../packages/shared/src/db/schema";
import { getAdminOfferings } from "../packages/shared/src/server/offerings/offerings.service";
import { buildCatalogSections, catalogListingTypes, type CatalogChild, type CatalogListingSlug } from "../packages/shared/src/server/pages/catalog-sections";
import { catalogSectionsNote, defaultListingSections, legacyCatalogSectionsNotes, legacyListingSectionsNotes, listingBaseBlockTypes, listingSectionsNote } from "../packages/shared/src/server/pages/listing-sections";
import { getAdminPageBySlug, saveAdminPage } from "../packages/shared/src/server/pages/pages.service";
import { listRevisions } from "../packages/shared/src/server/revisions/revisions.repository";

// Tạo sẵn phần nội dung cho các trang danh sách "cha":
//   - Phần mềm, Giải pháp, Dịch vụ: SINH TỪ CHÍNH CÁC MỤC CON đã xuất bản (CMS › Sản phẩm). Mỗi phần mềm / giải pháp / dịch vụ một phần
//     hoàn chỉnh, ngang hàng nhau (tên, mô tả, đối tượng phù hợp, lợi ích, tính năng, ảnh bìa, nút sang trang con), rồi hỏi đáp gộp.
//     Chi tiết đầy đủ nằm ở trang con. Xem packages/shared/src/server/pages/catalog-sections.ts.
//   - Thiết bị, Hướng dẫn, Hỗ trợ cài đặt: nội dung mẫu ở packages/shared/src/server/pages/listing-sections.ts.
//
// Không xóa hay sửa khối đầu trang và khối danh sách. Với các khối khác của trang:
//   - trang chưa có khối nào ngoài "Mở đầu" và "Danh sách nội dung": nối thêm;
//   - bản lưu gần nhất của trang do chính lệnh này tạo (ghi chú phiên bản khớp một bản của lệnh này): chưa ai sửa kể từ đó, nên thay bằng
//     bản mới (bản cũ vẫn khôi phục được từ lịch sử phiên bản trong CMS); đã đúng bản mới nhất thì giữ nguyên;
//   - còn lại (người vận hành đã lưu trang, hoặc tự thêm khối): bỏ qua, giữ nguyên.
// Nên chạy lại nhiều lần an toàn. Nội dung phần mềm/giải pháp/dịch vụ đổi trong CMS thì chạy lại sẽ KHÔNG tự cập nhật trang cha
// nếu người vận hành đã lưu trang cha; muốn lấy lại bản sinh từ mục con thì sửa tay trong CMS hoặc khôi phục phiên bản do lệnh này tạo.
//   pnpm db:seed:listing-sections              ghi vào CMS
//   pnpm db:seed:listing-sections --dry-run    chỉ in kết quả dự kiến, không ghi gì
// Website lưu nội dung công khai tối đa vài chục giây nên trang công khai cập nhật chậm một chút.
const dryRun = process.argv.includes("--dry-run");

type Plan = { slug: string; sections: unknown[]; note: string; legacyNotes: ReadonlyArray<string>; source: string };

async function catalogChildren(slug: CatalogListingSlug): Promise<CatalogChild[]> {
  const type = catalogListingTypes[slug];
  return (await getAdminOfferings())
    .filter(offering => offering.type === type && offering.status === "published")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "vi"))
    .map(offering => ({ type, title: offering.title, slug: offering.slug, coverMediaId: offering.coverMediaId, content: offering.content }));
}

async function plans(): Promise<Plan[]> {
  const result: Plan[] = [];
  for (const slug of Object.keys(catalogListingTypes) as CatalogListingSlug[]) {
    const children = await catalogChildren(slug);
    if (!children.length) { console.log(`- ${slug}: chưa có ${catalogListingTypes[slug]} nào đã xuất bản để tạo nội dung, bỏ qua.`); continue; }
    result.push({ slug, sections: buildCatalogSections(children), note: catalogSectionsNote, legacyNotes: legacyCatalogSectionsNotes, source: `${children.length} mục con` });
  }
  for (const [slug, sections] of Object.entries(defaultListingSections)) {
    if (sections?.length) result.push({ slug, sections, note: listingSectionsNote, legacyNotes: legacyListingSectionsNotes, source: "nội dung mẫu" });
  }
  return result;
}

async function run() {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const [administrator] = username ? await getDb().select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1) : [];
  if (!administrator && !dryRun) throw new Error("Không tìm thấy tài khoản quản trị (INITIAL_ADMIN_USERNAME) để lưu các phần nội dung.");

  let written = 0;
  for (const { slug, sections, note, legacyNotes, source } of await plans()) {
    const page = await getAdminPageBySlug(slug);
    if (!page) { console.log(`- ${slug}: chưa có trang (chạy pnpm db:backfill-listing-pages trước), bỏ qua.`); continue; }

    const baseBlocks = page.blocks.filter(block => listingBaseBlockTypes.includes(block.type));
    const customised = page.blocks.length - baseBlocks.length;
    const [latest] = await listRevisions("pages", page.id);
    const lastNote = latest?.changeNote ?? null;

    let action: "add" | "replace";
    if (customised === 0) action = "add";
    else if (lastNote === note) { console.log(`- ${slug}: đã là bản nội dung dựng sẵn mới nhất, giữ nguyên.`); continue; }
    else if (lastNote && legacyNotes.includes(lastNote)) action = "replace";
    else { console.log(`- ${slug}: đã có ${customised} khối khác do người vận hành chỉnh, giữ nguyên.`); continue; }

    const summary = (sections as Array<{ type: string }>).map(block => block.type).join(", ");
    const verb = action === "add" ? `thêm ${sections.length} khối` : `thay ${customised} khối dựng sẵn cũ bằng ${sections.length} khối mới`;
    if (dryRun) { console.log(`- ${slug}: sẽ ${verb} từ ${source} (${summary}).`); continue; }
    await saveAdminPage(page.id, {
      title: page.title, slug: page.slug, template: page.template, status: page.status, seoTitle: page.seoTitle, seoDescription: page.seoDescription,
      canonicalUrl: page.canonicalUrl, seo: page.seo, scheduledAt: page.scheduledAt, blocks: [...baseBlocks, ...sections],
    }, administrator!.id, { expectedVersion: page.draftVersion, changeNote: note });
    written += 1;
    console.log(`- ${slug}: đã ${verb} từ ${source} (${summary}).`);
  }
  console.log(dryRun ? "Chạy thử: chưa ghi gì vào CMS." : written ? `Hoàn tất: cập nhật nội dung cho ${written} trang.` : "Không có trang nào cần cập nhật; giữ nguyên dữ liệu CMS.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể thêm các phần nội dung cho trang danh sách.");
  process.exit(1);
});

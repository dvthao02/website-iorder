import { sql } from "drizzle-orm";
import { getDb } from "@iorder/shared/db/client";
import { describeScriptError } from "./lib/script-error";

// Dọn lịch sử phiên bản (các bảng *_revisions): mỗi nội dung giữ N phiên bản MỚI NHẤT, xóa các bản cũ hơn.
// Mặc định chỉ ĐẾM (dry-run); thêm --apply mới xóa thật. --keep N đổi số phiên bản giữ lại (mặc định 50, từ 5 đến 1000).
//   pnpm db:cleanup-revisions                 đếm những gì sẽ dọn
//   pnpm db:cleanup-revisions --apply         dọn thật
//   pnpm db:cleanup-revisions --keep 30 --apply
// Phiên bản đang dùng (mới nhất) luôn được giữ. Số phiên bản kế tiếp lấy từ chính nội dung (draft_version), không từ bảng lịch sử,
// nên xóa bản cũ không làm lệch đánh số. Xóa là vĩnh viễn: các bản bị xóa không khôi phục được nữa.
const apply = process.argv.includes("--apply");
const keepIndex = process.argv.indexOf("--keep");
const keep = keepIndex >= 0 ? Number(process.argv[keepIndex + 1]) : 50;
if (!Number.isInteger(keep) || keep < 5 || keep > 1000) {
  console.error("--keep phải là số nguyên từ 5 đến 1000.");
  process.exit(1);
}

// Tên bảng và cột cố định trong code (không nhận từ người dùng) nên ghép thẳng vào câu lệnh là an toàn.
const revisionTables = [
  ["page_revisions", "page_id", "trang"],
  ["post_revisions", "post_id", "bài viết"],
  ["offering_revisions", "offering_id", "sản phẩm / giải pháp"],
  ["sales_equipment_revisions", "sales_equipment_id", "thiết bị"],
  ["menu_revisions", "menu_id", "menu"],
  ["support_download_revisions", "support_download_id", "tệp cài đặt"],
] as const;

async function main() {
  const db = getDb();
  const lines: string[] = [];
  await db.transaction(async (tx) => {
    for (const [table, ownerColumn, label] of revisionTables) {
      const target = sql.raw(table);
      const owner = sql.raw(ownerColumn);
      const stale = sql`select id from (select id, row_number() over (partition by ${owner} order by version_number desc) as newest_first from ${target}) ranked where newest_first > ${keep}::int`;
      const result = apply
        ? await tx.execute(sql`delete from ${target} where id in (${stale}) returning 1`)
        : await tx.execute(sql`select 1 from ${target} where id in (${stale})`);
      lines.push(`${label}: ${result.length}`);
    }
  });
  console.log(`${apply ? "Đã dọn" : "Sẽ dọn (chưa xóa, thêm --apply để xóa)"} — phiên bản cũ hơn ${keep} bản mới nhất của mỗi nội dung:`);
  for (const line of lines) console.log(`  ${line}`);
}

void main().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(`Không thể dọn lịch sử phiên bản: ${describeScriptError(error, "cleanup-old-revisions")}`);
  process.exit(1);
});

import { sql } from "drizzle-orm";
import { getDb } from "@iorder/shared/db/client";
import { recordJobRun } from "@iorder/shared/server/system/job-runs";
import { describeScriptError } from "./lib/script-error";

// Dọn "thùng rác" của CMS: nội dung đã xóa mềm (deleted_at) quá hạn và các dòng tạm đã hết hạn.
// Mặc định chỉ ĐẾM (dry-run); thêm --apply mới xóa thật. --days N đổi số ngày giữ lại (mặc định 30).
//   pnpm db:cleanup-content                 đếm những gì sẽ dọn
//   pnpm db:cleanup-content --apply         dọn thật
// Xóa mềm giữ lại để khôi phục nhầm lẫn; quá hạn thì xóa hẳn (bản sửa đổi, khối, phân loại đi kèm tự xóa theo khóa ngoại CASCADE).
// Media không nằm ở đây: dùng pnpm db:cleanup-media (cần xóa cả tệp trong S3).
const apply = process.argv.includes("--apply");
const daysIndex = process.argv.indexOf("--days");
const days = daysIndex >= 0 ? Number(process.argv[daysIndex + 1]) : 30;
if (!Number.isInteger(days) || days < 1 || days > 3650) {
  console.error("--days phải là số nguyên từ 1 đến 3650.");
  process.exit(1);
}

// Tên bảng cố định trong code (không nhận từ người dùng) nên ghép thẳng vào câu lệnh là an toàn.
const softDeleted = [
  ["pages", "trang"],
  ["posts", "bài viết"],
  ["offerings", "sản phẩm / giải pháp / dịch vụ"],
  ["sales_equipment", "thiết bị"],
  ["redirects", "chuyển hướng"],
  ["partners", "đối tác"],
] as const;

async function main() {
  const db = getDb();
  // Tham số thời gian truyền dạng chuỗi ISO rồi ép kiểu: câu lệnh thô của driver không nhận Date trực tiếp.
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const lines: string[] = [];
  await db.transaction(async (tx) => {
    for (const [table, label] of softDeleted) {
      const target = sql.raw(table);
      const result = apply
        ? await tx.execute(sql`delete from ${target} where deleted_at is not null and deleted_at < ${cutoff}::timestamptz returning 1`)
        : await tx.execute(sql`select 1 from ${target} where deleted_at is not null and deleted_at < ${cutoff}::timestamptz`);
      lines.push(`${label}: ${result.length}`);
    }
    for (const [table, label] of [["sessions", "phiên đăng nhập hết hạn"], ["builder_previews", "bản xem trước hết hạn"]] as const) {
      const target = sql.raw(table);
      const result = apply
        ? await tx.execute(sql`delete from ${target} where expires_at < ${now}::timestamptz returning 1`)
        : await tx.execute(sql`select 1 from ${target} where expires_at < ${now}::timestamptz`);
      lines.push(`${label}: ${result.length}`);
    }
  });
  console.log(`${apply ? "Đã dọn" : "Sẽ dọn (chưa xóa, thêm --apply để xóa)"} — nội dung xóa mềm quá ${days} ngày và dòng tạm hết hạn:`);
  for (const line of lines) console.log(`  ${line}`);
  // Chỉ lần dọn thật (--apply) mới tính là một lần chạy; chạy đếm thử không ghi gì.
  if (apply) await recordJobRun("content-cleanup", { ok: true, summary: `Đã dọn (xóa mềm quá ${days} ngày) — ${lines.join("; ")}` });
}

void main().then(() => process.exit(0)).catch(async (error: unknown) => {
  console.error(`Không thể dọn nội dung đã xóa: ${describeScriptError(error, "cleanup-deleted-content")}`);
  if (apply) await recordJobRun("content-cleanup", { ok: false, summary: "Không thể dọn nội dung đã xóa." });
  process.exit(1);
});

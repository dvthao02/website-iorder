import "dotenv/config";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { salesEquipment } from "../packages/shared/src/db/schema";
import { inferEquipmentBrand } from "../packages/shared/src/server/equipment/equipment-brand";

// Điền thương hiệu cho thiết bị cũ chưa có, chỉ khi tên/mã model ghi rõ hãng (xem equipment-brand.ts); còn lại để trống cho người vận hành.
// Mặc định chỉ liệt kê (chạy thử). Thêm --apply để ghi. Chỉ ghi cột brand của dòng đang trống: không đổi phiên bản, không tạo lịch sử phiên bản
// (là siêu dữ liệu), không ghi đè thương hiệu người vận hành đã nhập. Chạy lại nhiều lần an toàn. Website cập nhật trong tối đa 60 giây.
async function run() {
  const apply = process.argv.includes("--apply");
  const rows = await getDb()
    .select({ id: salesEquipment.id, name: salesEquipment.name, modelCode: salesEquipment.modelCode })
    .from(salesEquipment)
    .where(and(isNull(salesEquipment.deletedAt), isNull(salesEquipment.brand)));

  let matched = 0;
  const unknown: string[] = [];
  for (const row of rows) {
    const brand = inferEquipmentBrand(row.name, row.modelCode);
    if (!brand) { unknown.push(row.name); continue; }
    matched += 1;
    console.log(`${apply ? "Ghi " : "Sẽ ghi"}  ${brand.padEnd(10)}  ${row.name}`);
    if (apply) await getDb().update(salesEquipment).set({ brand }).where(and(eq(salesEquipment.id, row.id), isNull(salesEquipment.brand)));
  }
  console.log(`\n${apply ? "Đã điền" : "Sẽ điền"} ${matched}/${rows.length} thiết bị chưa có thương hiệu.`);
  if (unknown.length) console.log(`Không rõ hãng, để trống cho bạn tự điền trong CMS (${unknown.length}):\n  - ${unknown.join("\n  - ")}`);
  if (!apply && matched) console.log("\nChưa ghi gì. Chạy lại với --apply để ghi.");
}

void run().then(() => process.exit(0), (error) => { console.error("Không thể điền thương hiệu thiết bị.", error instanceof Error ? error.message : error); process.exit(1); });

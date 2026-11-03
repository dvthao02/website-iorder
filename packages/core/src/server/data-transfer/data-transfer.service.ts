import type { CmsActor } from "../auth/permissions";
import { buildXlsx } from "../shared/xlsx";
import type { TransferDatasetId } from "./data-transfer.contract";
import { equipmentGroupTransfer, equipmentTransfer } from "./equipment.transfer";
import { offeringTransfer } from "./offerings.transfer";
import { categoryTransfer, postTransfer, tagTransfer } from "./posts.transfer";
import { buildCsv, readTable } from "./tabular";
import { applyImport, exportRows, planImport, type TransferDataset, type TransferItem } from "./transfer";

// Mỗi request một bộ dữ liệu mới (bộ dữ liệu giữ bảng tra nạp trong load(), không dùng chung giữa request).
function withDataset<R>(id: TransferDatasetId, run: <TItem extends TransferItem, TContext>(dataset: TransferDataset<TItem, TContext>) => R): R {
  switch (id) {
    case "equipment": return run(equipmentTransfer());
    case "equipment-groups": return run(equipmentGroupTransfer());
    case "offerings-software": return run(offeringTransfer("software"));
    case "offerings-solution": return run(offeringTransfer("solution"));
    case "offerings-service": return run(offeringTransfer("service"));
    case "posts": return run(postTransfer("posts"));
    case "guides": return run(postTransfer("guides"));
    case "categories": return run(categoryTransfer());
    case "tags": return run(tagTransfer());
  }
}

export async function exportDataset(id: TransferDatasetId, format: "xlsx" | "csv") {
  return withDataset(id, async (dataset) => {
    const { items } = await dataset.load();
    const table = exportRows(dataset.fields, items);
    const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    const fileName = `${dataset.fileName}-${day}.${format}`;
    return format === "xlsx"
      ? { body: buildXlsx(dataset.label, table.headers.map((header, index) => ({ header, width: table.widths[index] })), table.rows), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName, rows: items.length }
      : { body: buildCsv(table.headers, table.rows), contentType: "text/csv; charset=utf-8", fileName, rows: items.length };
  });
}

export async function previewImport(id: TransferDatasetId, file: { name: string; bytes: Buffer }, actor: CmsActor) {
  const table = readTable(file);
  return withDataset(id, async (dataset) => (await planImport(dataset, table, actor)).plan);
}

export async function applyImportFile(id: TransferDatasetId, file: { name: string; bytes: Buffer }, expected: Record<string, number | null>, actor: CmsActor & { userId: string }) {
  const table = readTable(file);
  return withDataset(id, (dataset) => applyImport(dataset, table, expected, actor));
}

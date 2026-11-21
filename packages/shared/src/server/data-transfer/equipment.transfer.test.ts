import assert from "node:assert/strict";
import test from "node:test";
import { equipmentTransfer, formatSpecifications, parseSpecifications } from "./equipment.transfer";
import { applyImport, exportRows, ImportBlockedError, planImport } from "./transfer";
import { buildXlsx } from "../shared/xlsx";
import { readTable } from "./tabular";
import { getEquipment, getEquipmentGroups, writeEquipment } from "../equipment/equipment.service";

const publisher = { userId: "user", permissions: ["equipment.create", "equipment.update", "equipment.publish"] };
const editor = { userId: "user", permissions: ["equipment.create", "equipment.update"] };
const table = [["Đường dẫn (slug)", "Tên thiết bị", "Nhóm", "Giá (VNĐ)"], ["giay-a", "Giấy A", "Vật tư in", "1000"], ["giay-b", "Giấy B", "vật tư in", "2000"]];
const groupId = "44e0a072-95ec-4d1f-a3a5-8af3fe5ff1e2";

function fixture() {
  const writes: { kind: string; input: unknown }[] = [];
  const groups: Awaited<ReturnType<typeof getEquipmentGroups>> = [];
  const services = {
    getEquipment: (async () => []) as typeof getEquipment,
    getEquipmentGroups: (async () => groups) as typeof getEquipmentGroups,
    writeEquipment: (async (kind: string, _id: string | null, input: unknown) => { writes.push({ kind, input }); return kind === "groups" ? groupId : "item"; }) as typeof writeEquipment,
  };
  return { services, writes, groups };
}

test("xem trước nhóm thiếu, tạo một lần khi xác nhận và gắn vào từng thiết bị", async () => {
  const { services, writes } = fixture();
  const { plan } = await planImport(equipmentTransfer(publisher, services), table, publisher);
  assert.deepEqual(plan.newGroups, [{ name: "Vật tư in", slug: "vat-tu-in", isEnabled: true }]);
  assert.equal(plan.counts.error, 0);
  assert.equal(writes.length, 0);
  const result = await applyImport(equipmentTransfer(publisher, services), table, { "giay-a": null, "giay-b": null }, publisher, plan.newGroups);
  assert.deepEqual(result.createdGroups, ["Vật tư in"]);
  assert.deepEqual(writes.map((write) => write.kind), ["groups", "items", "items"]);
  assert.equal((writes[1].input as { groupId: string }).groupId, groupId);
  assert.equal((writes[2].input as { groupId: string }).groupId, groupId);
});

test("nhóm ẩn khi không có quyền xuất bản; không có quyền tạo thì báo lỗi", async () => {
  const { services } = fixture();
  const { plan } = await planImport(equipmentTransfer(editor, services), table, editor);
  assert.equal(plan.newGroups?.[0].isEnabled, false);
  const noCreate = { permissions: ["equipment.update"] };
  const denied = await planImport(equipmentTransfer(noCreate, services), table, noCreate);
  assert.match(denied.plan.rows[0].errors.join(" "), /quyền tạo/);
});

test("không tạo nhóm khi kế hoạch thay đổi hoặc hai tên sinh cùng đường dẫn", async () => {
  const { services, writes } = fixture();
  await assert.rejects(applyImport(equipmentTransfer(publisher, services), table, { "giay-a": null, "giay-b": null }, publisher, []), (error: unknown) => error instanceof ImportBlockedError && error.status === 409);
  const collision = [table[0], table[1], ["giay-b", "Giấy B", "Vat tu in", "2000"]];
  const { plan } = await planImport(equipmentTransfer(publisher, services), collision, publisher);
  assert.match(plan.rows[1].errors.join(" "), /trùng/);
  assert.equal(writes.length, 0);
});

test("báo nhóm đã tạo nếu ghi thiết bị sau đó thất bại", async () => {
  const { services } = fixture();
  const baseWrite = services.writeEquipment;
  services.writeEquipment = (async (kind, id, input, actorId) => {
    if (kind === "items") throw new Error("Không ghi được thiết bị.");
    return baseWrite(kind, id, input, actorId);
  }) as typeof writeEquipment;
  const { plan } = await planImport(equipmentTransfer(publisher, services), table, publisher);
  const result = await applyImport(equipmentTransfer(publisher, services), table, { "giay-a": null, "giay-b": null }, publisher, plan.newGroups);
  assert.deepEqual(result.createdGroups, ["Vật tư in"]);
  assert.equal(result.failed?.row, 2);
  assert.equal(result.created, 0);
});

test("thông số xuất Excel và nhập lại giữ nhóm, ký tự đặc biệt và xuống dòng", async () => {
  const specs = [{ title: "Kết nối", items: [{ label: "Cổng: chính", value: "USB: C\\A\nDòng 2" }] }, { title: "Khác", items: [] }];
  assert.deepEqual(parseSpecifications(formatSpecifications(specs)), { ok: true, value: specs });
  const { services, writes } = fixture();
  const dataset = equipmentTransfer(publisher, services);
  const column = dataset.fields.find((item) => item.key === "specificationGroups")!;
  const headers = ["Đường dẫn (slug)", "Tên thiết bị", "Nhóm", "Giá (VNĐ)", column.header];
  const file = buildXlsx("Thiết bị", headers.map((header) => ({ header })), [["giay-a", "Giấy A", "Vật tư in", 1000, formatSpecifications(specs)]]);
  const rows = readTable({ name: "thiet-bi.xlsx", bytes: file });
  const { plan } = await planImport(equipmentTransfer(publisher, services), rows, publisher);
  const result = await applyImport(equipmentTransfer(publisher, services), rows, { "giay-a": null }, publisher, plan.newGroups);
  assert.equal(result.failed, null);
  assert.deepEqual((writes[1].input as { specificationGroups: typeof specs }).specificationGroups, specs);
  assert.deepEqual(exportRows([column], [{ specificationGroups: specs } as Awaited<ReturnType<typeof getEquipment>>[number]]).rows, [[formatSpecifications(specs)]]);
});

test("thông số sai định dạng bị chặn; ô trống xóa và thiếu cột giữ nguyên", async () => {
  assert.equal(parseSpecifications("").ok && (parseSpecifications("") as { value: unknown }).value instanceof Array, true);
  assert.equal(parseSpecifications("Cổng: USB").ok, false);
  assert.equal(parseSpecifications("[Kết nối]\nCổng:").ok, false);
  const { services } = fixture();
  const dataset = equipmentTransfer(publisher, services);
  const specs = [{ title: "Kết nối", items: [{ label: "Cổng", value: "USB" }] }];
  const existing = { slug: "giay-a", name: "Giấy A", groupId, groupName: "Vật tư in", priceVnd: 1000, specificationGroups: specs } as Awaited<ReturnType<typeof getEquipment>>[number];
  assert.deepEqual((dataset.build({}, existing, { groups: [] }).input as { specificationGroups: typeof specs }).specificationGroups, specs);
  assert.deepEqual((dataset.build({ specificationGroups: [] }, existing, { groups: [] }).input as { specificationGroups: typeof specs }).specificationGroups, []);
});

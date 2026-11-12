import { equipmentGroupInputSchema, equipmentInputSchema, type EquipmentGroupInput, type EquipmentInput } from "../equipment/equipment.contract";
import { getEquipment, getEquipmentGroups, writeEquipment } from "../equipment/equipment.service";
import { contentStatuses, field, integer, slugCell, statusCell, text, yesNo, type ContentStatus, type TransferDataset } from "./transfer";

type EquipmentRow = Awaited<ReturnType<typeof getEquipment>>[number];
type GroupRow = Awaited<ReturnType<typeof getEquipmentGroups>>[number];

const importNote = "Nhập từ file Excel/CSV";
const liveStatuses = new Set<ContentStatus>(["published", "scheduled"]);
const normalize = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
const optional = <T>(value: T | null | undefined) => value ?? null;

function pick<T extends object>(row: object, keys: (keyof T)[]) {
  return Object.fromEntries(keys.map((key) => [key, (row as Record<string, unknown>)[key as string]])) as T;
}

/** Thiết bị: cột "Nhóm" xuất theo tên, nhập nhận tên hoặc slug của nhóm đã có. Thông số kỹ thuật và ảnh không nằm trong file (giữ nguyên). */
export function equipmentTransfer(): TransferDataset<EquipmentRow, { groups: GroupRow[] }> {
  // Tra nhóm theo slug hoặc tên (không phân biệt hoa thường/khoảng trắng); nạp trong load() của từng request.
  const groupByKey = new Map<string, GroupRow | null>();
  const resolveGroup = (value: string) => groupByKey.get(normalize(value));
  const groupName = (value: string) => resolveGroup(value)?.name ?? value;
  return {
    id: "equipment",
    label: "Thiết bị",
    fileName: "thiet-bi",
    module: "equipment",
    fields: [
      field({ key: "slug", header: "Đường dẫn (slug)", width: 30, get: (item) => item.slug, format: (value) => value, parse: slugCell }),
      field({ key: "name", header: "Tên thiết bị", width: 34, requiredOnCreate: true, get: (item) => item.name, format: (value) => value, parse: text(220, { required: true }) }),
      field({ key: "group", header: "Nhóm", width: 20, requiredOnCreate: true, get: (item) => item.groupName, format: (value: string | null) => value === null ? null : groupName(value), parse: text(180, { required: true }) }),
      field({ key: "modelCode", header: "Model", width: 16, get: (item) => item.modelCode, format: (value) => value, parse: text(80) }),
      field({ key: "priceVnd", header: "Giá (VNĐ)", width: 16, requiredOnCreate: true, get: (item) => item.priceVnd, format: (value) => value, parse: integer({ min: 0, max: Number.MAX_SAFE_INTEGER, unit: "VNĐ" }) }),
      field({ key: "warrantyMonths", header: "Bảo hành (tháng)", width: 16, get: (item) => item.warrantyMonths, format: (value) => value, parse: integer({ min: 0, max: 1200, unit: "tháng" }) }),
      field({ key: "summary", header: "Tóm tắt", width: 50, get: (item) => item.summary, format: (value) => value, parse: text(20_000) }),
      field({ key: "status", header: "Trạng thái", width: 14, get: (item) => item.status, format: (value: ContentStatus) => contentStatuses[value], parse: statusCell }),
      field({ key: "isFeatured", header: "Nổi bật", width: 10, get: (item) => item.isFeatured, format: (value: boolean) => value ? "Có" : "Không", parse: yesNo }),
      field({ key: "sortOrder", header: "Thứ tự", width: 10, get: (item) => item.sortOrder, format: (value) => value, parse: integer({ min: 0, max: 10_000 }) }),
      field({ key: "seoTitle", header: "Tiêu đề SEO", width: 34, get: (item) => item.seoTitle, format: (value) => value, parse: text(70) }),
      field({ key: "seoDescription", header: "Mô tả SEO", width: 50, get: (item) => item.seoDescription, format: (value) => value, parse: text(180) }),
    ],
    async load() {
      const [items, groups] = await Promise.all([getEquipment(), getEquipmentGroups()]);
      for (const group of groups) {
        groupByKey.set(normalize(group.slug), group);
        // Hai nhóm trùng tên: đánh dấu mơ hồ để yêu cầu ghi slug.
        const key = normalize(group.name);
        groupByKey.set(key, groupByKey.has(key) && groupByKey.get(key)?.id !== group.id ? null : group);
      }
      return { items, context: { groups } };
    },
    build(changes, existing) {
      const errors: string[] = [];
      const base: EquipmentInput = existing
        ? pick<EquipmentInput>(existing, Object.keys(equipmentInputSchema.shape) as (keyof EquipmentInput)[])
        : { groupId: "", name: "", slug: "", modelCode: null, coverMediaId: null, priceVnd: 0, warrantyMonths: 12, summary: null, specificationGroups: [], status: "draft", scheduledAt: null, sortOrder: 0, isFeatured: false, seoTitle: null, seoDescription: null, canonicalUrl: null };
      const input: EquipmentInput = { ...base };
      if (typeof changes.slug === "string" && !existing) input.slug = changes.slug;
      if (typeof changes.name === "string") input.name = changes.name;
      if (typeof changes.group === "string") {
        const group = resolveGroup(changes.group);
        if (group === null) errors.push(`Có nhiều nhóm tên "${changes.group}"; hãy ghi đường dẫn (slug) của nhóm.`);
        else if (!group) errors.push(`Nhóm "${changes.group}" chưa có. Tạo nhóm ở tab Nhóm thiết bị (hoặc nhập file nhóm) trước.`);
        else input.groupId = group.id;
      }
      if ("modelCode" in changes) input.modelCode = optional(changes.modelCode as string | null);
      if (typeof changes.priceVnd === "number") input.priceVnd = changes.priceVnd;
      if (typeof changes.warrantyMonths === "number") input.warrantyMonths = changes.warrantyMonths;
      if ("summary" in changes) input.summary = optional(changes.summary as string | null);
      if (typeof changes.isFeatured === "boolean") input.isFeatured = changes.isFeatured;
      if (typeof changes.sortOrder === "number") input.sortOrder = changes.sortOrder;
      if ("seoTitle" in changes) input.seoTitle = optional(changes.seoTitle as string | null);
      if ("seoDescription" in changes) input.seoDescription = optional(changes.seoDescription as string | null);
      if (typeof changes.status === "string") {
        const status = changes.status as ContentStatus;
        // Hẹn giờ cần thời điểm đăng: chỉ giữ được khi mục đang hẹn giờ sẵn; đặt mới thì làm trong màn sửa.
        if (status === "scheduled" && !(existing?.status === "scheduled" && existing.scheduledAt)) errors.push("Đặt hẹn giờ trong màn sửa thiết bị (cần chọn thời điểm đăng).");
        input.status = status;
        if (status !== "scheduled") input.scheduledAt = null;
      }
      return { input, errors, live: { before: Boolean(existing && liveStatuses.has(existing.status)), after: liveStatuses.has(input.status) } };
    },
    schema: equipmentInputSchema,
    async write(input, existing, actorId) {
      const id = await writeEquipment("items", existing?.id ?? null, input, actorId, importNote, existing?.version);
      if (!id) throw new Error("Không tìm thấy thiết bị hoặc nhóm (có thể vừa bị xóa).");
      return id;
    },
  };
}

/** Nhóm thiết bị: bật "Hiển thị trên website" là đưa cả nhóm lên website, nên cần quyền xuất bản. Ảnh nhóm giữ nguyên. */
export function equipmentGroupTransfer(): TransferDataset<GroupRow, null> {
  return {
    id: "equipment-groups",
    label: "Nhóm thiết bị",
    fileName: "nhom-thiet-bi",
    module: "equipment",
    fields: [
      field({ key: "slug", header: "Đường dẫn (slug)", width: 28, get: (item) => item.slug, format: (value) => value, parse: slugCell }),
      field({ key: "name", header: "Tên nhóm", width: 28, requiredOnCreate: true, get: (item) => item.name, format: (value) => value, parse: text(180, { required: true }) }),
      field({ key: "description", header: "Mô tả", width: 50, get: (item) => item.description, format: (value) => value, parse: text(10_000) }),
      field({ key: "sortOrder", header: "Thứ tự", width: 10, get: (item) => item.sortOrder, format: (value) => value, parse: integer({ min: 0, max: 10_000 }) }),
      field({ key: "isEnabled", header: "Hiển thị trên website", width: 20, get: (item) => item.isEnabled, format: (value: boolean) => value ? "Có" : "Không", parse: yesNo }),
    ],
    async load() {
      return { items: await getEquipmentGroups(), context: null };
    },
    build(changes, existing) {
      const base: EquipmentGroupInput = existing
        ? pick<EquipmentGroupInput>(existing, Object.keys(equipmentGroupInputSchema.shape) as (keyof EquipmentGroupInput)[])
        : { name: "", slug: "", description: null, coverMediaId: null, sortOrder: 0, isEnabled: false };
      const input: EquipmentGroupInput = { ...base };
      if (typeof changes.slug === "string" && !existing) input.slug = changes.slug;
      if (typeof changes.name === "string") input.name = changes.name;
      if ("description" in changes) input.description = optional(changes.description as string | null);
      if (typeof changes.sortOrder === "number") input.sortOrder = changes.sortOrder;
      if (typeof changes.isEnabled === "boolean") input.isEnabled = changes.isEnabled;
      return { input, errors: [], live: { before: Boolean(existing?.isEnabled), after: input.isEnabled } };
    },
    schema: equipmentGroupInputSchema,
    async write(input, existing, actorId) {
      const id = await writeEquipment("groups", existing?.id ?? null, input, actorId, undefined, existing?.version);
      if (!id) throw new Error("Không tìm thấy nhóm thiết bị (có thể vừa bị xóa).");
      return id;
    },
  };
}

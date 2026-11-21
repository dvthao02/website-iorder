import { randomUUID } from "node:crypto";
import { hasCmsPermission, type CmsActor } from "../auth/permissions";
import { toSlug } from "../shared/slug";
import { equipmentAvailabilityLabels, equipmentGroupInputSchema, equipmentInputSchema, type EquipmentAvailability, type EquipmentGroupInput, type EquipmentInput } from "../equipment/equipment.contract";
import { getEquipment, getEquipmentGroups, writeEquipment } from "../equipment/equipment.service";
import { contentStatuses, field, integer, slugCell, statusCell, text, yesNo, type ContentStatus, type Parsed, type TransferDataset } from "./transfer";

type EquipmentRow = Awaited<ReturnType<typeof getEquipment>>[number];
type GroupRow = Awaited<ReturnType<typeof getEquipmentGroups>>[number];

const importNote = "Nhập từ file Excel/CSV";
const liveStatuses = new Set<ContentStatus>(["published", "scheduled"]);
const normalize = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
const optional = <T>(value: T | null | undefined) => value ?? null;

// Cột "Tình trạng hàng": nhận nhãn tiếng Việt (Còn hàng, Hết hàng…) hoặc mã (in_stock…); để trống thì giữ nguyên giá trị hiện có.
const availabilityCell = (raw: string): Parsed<EquipmentAvailability> => {
  const value = raw.normalize("NFC").trim().toLocaleLowerCase("vi");
  if (!value) return { ok: true, value: undefined };
  const match = (Object.entries(equipmentAvailabilityLabels) as [EquipmentAvailability, string][]).find(([code, label]) => value === code || value === label.toLocaleLowerCase("vi"));
  return match ? { ok: true, value: match[0] } : { ok: false, error: `"${raw}" — dùng một trong: ${Object.values(equipmentAvailabilityLabels).join(", ")}.` };
};

function pick<T extends object>(row: object, keys: (keyof T)[]) {
  return Object.fromEntries(keys.map((key) => [key, (row as Record<string, unknown>)[key as string]])) as T;
}

type Specifications = EquipmentInput["specificationGroups"];
const escapeSpec = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/:/g, "\\:");
const unescapeSpec = (value: string) => value.replace(/\\([\\nr:])/g, (_match, char: string) => char === "n" ? "\n" : char === "r" ? "\r" : char);

export function formatSpecifications(groups: Specifications) {
  return groups.map((group) => [`[${escapeSpec(group.title)}]`, ...group.items.map((item) => `${escapeSpec(item.label)}: ${escapeSpec(item.value)}`)].join("\n")).join("\n\n");
}

export function parseSpecifications(raw: string): Parsed<Specifications> {
  if (!raw.trim()) return { ok: true, value: [] };
  const groups: Specifications = [];
  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const text = line.trim();
    if (!text) continue;
    if (text.startsWith("[") && text.endsWith("]")) {
      groups.push({ title: unescapeSpec(text.slice(1, -1)).trim(), items: [] });
      continue;
    }
    const current = groups.at(-1);
    let separator = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\\" && i + 1 < text.length) { i++; continue; }
      if (text[i] === ":") { separator = i; break; }
    }
    if (!current || separator < 0) return { ok: false, error: `dòng ${index + 1}: ghi [Tên nhóm] rồi từng thông số theo dạng Tên: Giá trị.` };
    current.items.push({ label: unescapeSpec(text.slice(0, separator)).trim(), value: unescapeSpec(text.slice(separator + 1)).trim() });
  }
  const parsed = equipmentInputSchema.shape.specificationGroups.safeParse(groups);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "Nhóm cần tên (tối đa 180 ký tự); mỗi thông số cần tên và giá trị (tối đa 180 và 2.000 ký tự), tối đa 50 nhóm và 100 thông số mỗi nhóm." };
}

/** Thiết bị: nhóm và thông số có thể xuất/nhập; ảnh giữ nguyên. */
export function equipmentTransfer(actor?: CmsActor, services = { getEquipment, getEquipmentGroups, writeEquipment }): TransferDataset<EquipmentRow, { groups: GroupRow[] }> {
  // Tra nhóm theo slug hoặc tên (không phân biệt hoa thường/khoảng trắng); nạp trong load() của từng request.
  const groupByKey = new Map<string, GroupRow | null>();
  const resolveGroup = (value: string) => groupByKey.get(normalize(value));
  const groupName = (value: string) => resolveGroup(value)?.name ?? value;
  const pending = new Map<string, { name: string; slug: string; isEnabled: boolean; placeholder: string; id?: string }>();
  const created: string[] = [];
  const existingSlugs = new Set<string>();
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
      field({ key: "specificationGroups", header: "Thông số kỹ thuật", width: 50, get: (item) => item.specificationGroups, format: formatSpecifications, parse: parseSpecifications }),
      field({ key: "availability", header: "Tình trạng hàng", width: 18, get: (item) => item.availability ?? "in_stock", format: (value: EquipmentAvailability) => equipmentAvailabilityLabels[value], parse: availabilityCell }),
      field({ key: "status", header: "Trạng thái", width: 14, get: (item) => item.status, format: (value: ContentStatus) => contentStatuses[value], parse: statusCell }),
      field({ key: "isFeatured", header: "Nổi bật", width: 10, get: (item) => item.isFeatured, format: (value: boolean) => value ? "Có" : "Không", parse: yesNo }),
      field({ key: "sortOrder", header: "Thứ tự", width: 10, get: (item) => item.sortOrder, format: (value) => value, parse: integer({ min: 0, max: 10_000 }) }),
      field({ key: "seoTitle", header: "Tiêu đề SEO", width: 34, get: (item) => item.seoTitle, format: (value) => value, parse: text(70) }),
      field({ key: "seoDescription", header: "Mô tả SEO", width: 50, get: (item) => item.seoDescription, format: (value) => value, parse: text(180) }),
    ],
    async load() {
      const [items, groups] = await Promise.all([services.getEquipment(), services.getEquipmentGroups()]);
      for (const group of groups) {
        existingSlugs.add(group.slug);
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
        else if (!group) {
          const name = changes.group.replace(/\s+/g, " ").trim();
          const key = normalize(name);
          const slug = toSlug(name);
          const sameSlug = [...pending.values()].find((item) => item.slug === slug && normalize(item.name) !== key);
          if (!actor || !hasCmsPermission(actor, "equipment.create")) errors.push(`Nhóm "${name}" chưa có; cần quyền tạo thiết bị để tạo nhóm.`);
          else if (!slug || existingSlugs.has(slug) || sameSlug) errors.push(`Không thể tạo nhóm "${name}" vì đường dẫn nhóm không hợp lệ hoặc trùng. Hãy tạo hoặc chọn nhóm phù hợp trước.`);
          else {
            let planned = pending.get(key);
            if (!planned) { planned = { name, slug, isEnabled: hasCmsPermission(actor, "equipment.publish"), placeholder: randomUUID() }; pending.set(key, planned); }
            input.groupId = planned.placeholder;
          }
        }
        else input.groupId = group.id;
      }
      if ("modelCode" in changes) input.modelCode = optional(changes.modelCode as string | null);
      if (typeof changes.priceVnd === "number") input.priceVnd = changes.priceVnd;
      if (typeof changes.warrantyMonths === "number") input.warrantyMonths = changes.warrantyMonths;
      if ("summary" in changes) input.summary = optional(changes.summary as string | null);
      if ("specificationGroups" in changes) input.specificationGroups = changes.specificationGroups as Specifications;
      if (typeof changes.availability === "string") input.availability = changes.availability as EquipmentAvailability;
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
    newGroups: () => [...pending.values()].map(({ name, slug, isEnabled }) => ({ name, slug, isEnabled })),
    createdGroups: () => [...created],
    async write(input, existing, actorId) {
      const values = input as EquipmentInput;
      const group = [...pending.values()].find((item) => item.placeholder === values.groupId);
      if (group && !group.id) {
        const current = await services.getEquipmentGroups();
        if (current.some((item) => item.slug === group.slug || normalize(item.name) === normalize(group.name))) throw new Error(`Nhóm "${group.name}" vừa thay đổi. Hãy kiểm tra lại file.`);
        try {
          const id = await services.writeEquipment("groups", null, { name: group.name, slug: group.slug, isEnabled: group.isEnabled, description: null, coverMediaId: null, sortOrder: 0 }, actorId);
          if (!id) throw new Error();
          group.id = id;
          created.push(group.name);
        } catch {
          throw new Error(`Không tạo được nhóm "${group.name}". Hãy kiểm tra lại nhóm và thử lại.`);
        }
      }
      const id = await services.writeEquipment("items", existing?.id ?? null, group?.id ? { ...values, groupId: group.id } : values, actorId, importNote, existing?.version);
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

import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { applyImport, field, ImportBlockedError, integer, lines, planImport, slugCell, statusCell, text, yesNo, type TransferDataset } from "./transfer";

type Item = { id: string; slug: string; version: number; name: string; price: number; status: "draft" | "published"; featured: boolean };
const schema = z.object({ slug: z.string(), name: z.string().min(1), price: z.number().int().min(0), status: z.enum(["draft", "review", "scheduled", "published", "archived"]), featured: z.boolean() }).strict();

function fakeDataset(items: Item[], writes: unknown[]) {
  const dataset: TransferDataset<Item, null> = {
    id: "fake", label: "Thử", fileName: "thu", module: "equipment",
    fields: [
      field({ key: "slug", header: "Đường dẫn (slug)", get: (item) => item.slug, format: (value) => value, parse: slugCell }),
      field({ key: "name", header: "Tên", requiredOnCreate: true, get: (item) => item.name, format: (value) => value, parse: text(50, { required: true }) }),
      field({ key: "price", header: "Giá (VNĐ)", requiredOnCreate: true, get: (item) => item.price, format: (value) => value, parse: integer({ min: 0, max: 1e12 }) }),
      field({ key: "status", header: "Trạng thái", get: (item) => item.status, format: (value: string) => value === "published" ? "Đã xuất bản" : "Bản nháp", parse: statusCell }),
      field({ key: "featured", header: "Nổi bật", get: (item) => item.featured, format: (value: boolean) => value ? "Có" : "Không", parse: yesNo }),
    ],
    load: async () => ({ items: structuredClone(items), context: null }),
    build: (changes, existing) => {
      const input = { slug: existing?.slug ?? changes.slug, name: existing?.name ?? "", price: existing?.price ?? 0, status: existing?.status ?? "draft", featured: existing?.featured ?? false, ...Object.fromEntries(Object.entries(changes).filter(([key]) => key !== "slug")) };
      return { input, errors: [], live: { before: existing?.status === "published", after: input.status === "published" } };
    },
    schema,
    write: async (input, existing) => { writes.push({ input, existingId: existing?.id ?? null }); },
  };
  return dataset;
}

const items: Item[] = [
  { id: "1", slug: "may-in", version: 3, name: "Máy in", price: 1_650_000, status: "published", featured: false },
  { id: "2", slug: "ket", version: 1, name: "Két", price: 850_000, status: "draft", featured: true },
];
const editor = { role: "editor", permissions: ["equipment.view", "equipment.create", "equipment.update"] };
const publisher = { role: "publisher", userId: "u1", permissions: [...editor.permissions, "equipment.publish"] };

test("Chỉ cột có trong file được so: file 'slug + giá' cập nhật giá, dòng giống hệt là không đổi", async () => {
  const { plan } = await planImport(fakeDataset(items, []), [["Đường dẫn (slug)", "Giá (VNĐ)"], ["may-in", "1.700.000"], ["ket", "850000"]], publisher);
  assert.deepEqual(plan.counts, { create: 0, update: 1, unchanged: 1, error: 0 });
  assert.deepEqual(plan.rows[0].changes, [{ field: "price", header: "Giá (VNĐ)", before: "1650000", after: "1700000" }]);
  assert.equal(plan.rows[0].version, 3);
});

test("Dòng mới thiếu cột bắt buộc, slug sai định dạng, trùng slug trong file và cột lạ đều được báo theo dòng", async () => {
  const { plan } = await planImport(fakeDataset(items, []), [["slug", "Tên", "Cột lạ"], ["moi-1", "Thiết bị mới", "x"], ["Sai Slug", "A", ""], ["moi-1", "Lặp", ""], ["", "", ""]], publisher);
  assert.deepEqual(plan.ignoredHeaders, ["Cột lạ"]);
  assert.equal(plan.total, 3); // dòng trống bị bỏ qua
  assert.match(plan.rows[0].errors.join(" "), /Bản ghi mới cần cột "Giá \(VNĐ\)"/);
  assert.match(plan.rows[1].errors.join(" "), /chữ thường không dấu/);
  assert.match(plan.rows[2].errors.join(" "), /Trùng "Đường dẫn \(slug\)" với dòng 2/);
});

test("Không có slug thì tự tạo từ tên; ô trống ở cột số/Có-Không giữ nguyên giá trị", async () => {
  const { plan } = await planImport(fakeDataset(items, []), [["Tên", "Giá (VNĐ)", "Nổi bật"], ["Máy quét mã vạch", "950000", ""], ["Két", "", ""]], publisher);
  assert.equal(plan.rows[0].slug, "may-quet-ma-vach");
  assert.equal(plan.rows[0].action, "create");
  assert.equal(plan.rows[1].action, "unchanged");
});

test("Quyền theo dòng: không có publish thì không sửa được mục đang hiện hay xuất bản mục mới", async () => {
  const { plan } = await planImport(fakeDataset(items, []), [["slug", "Giá (VNĐ)", "Trạng thái"], ["may-in", "1", ""], ["ket", "2", ""], ["ket-2", "3", "Đã xuất bản"]], editor);
  assert.equal(plan.rows[0].action, "error");
  assert.match(plan.rows[0].errors[0], /quyền xuất bản/);
  assert.equal(plan.rows[1].action, "update");
  assert.match(plan.rows[2].errors.join(" "), /Bản ghi mới cần cột "Tên"/);
});

test("Áp dụng: từ chối khi file còn lỗi hoặc phiên bản khác lúc xem trước; đúng thì ghi từng dòng", async () => {
  const writes: unknown[] = [];
  const table = [["slug", "Tên", "Giá (VNĐ)"], ["may-in", "Máy in nhiệt", "1650000"], ["moi", "Mới", "10"]];
  await assert.rejects(applyImport(fakeDataset(items, writes), table, { "may-in": 2, moi: null }, publisher), (error: unknown) => error instanceof ImportBlockedError && error.status === 409);
  await assert.rejects(applyImport(fakeDataset(items, writes), [["slug", "Giá (VNĐ)"], ["may-in", "abc"]], {}, publisher), (error: unknown) => error instanceof ImportBlockedError && error.status === 400);
  assert.equal(writes.length, 0);
  const result = await applyImport(fakeDataset(items, writes), table, { "may-in": 3, moi: null }, publisher);
  assert.deepEqual(result, { created: 1, updated: 1, unchanged: 0, failed: null });
  assert.deepEqual(writes.map((write) => (write as { existingId: string | null }).existingId), ["1", null]);
});

test("Danh sách trong một ô: mỗi dòng một mục, bỏ dòng trống, giới hạn số mục và độ dài", () => {
  const parse = lines({ maxItems: 3, maxLength: 20 });
  assert.deepEqual(parse("Gọi món QR\r\n\n  Báo cáo  \nKho"), { ok: true, value: ["Gọi món QR", "Báo cáo", "Kho"] });
  assert.deepEqual(parse(""), { ok: true, value: [] });
  assert.equal(parse("a\nb\nc\nd").ok, false);
  assert.equal(parse("x".repeat(21)).ok, false);
});

test("Bộ đọc ô: số kiểu Việt Nam, Có/Không, trạng thái tiếng Việt", () => {
  const price = integer({ min: 0, max: 1e12 });
  for (const raw of ["8900000", "8.900.000", "8,900,000", "8 900 000 ₫", "8.9E6"]) assert.deepEqual(price(raw), { ok: true, value: 8_900_000 });
  assert.equal(price("8.9").ok, false);
  assert.deepEqual(yesNo("Có"), { ok: true, value: true });
  assert.deepEqual(yesNo(""), { ok: true, value: undefined });
  assert.deepEqual(statusCell("Đã xuất bản"), { ok: true, value: "published" });
  assert.deepEqual(statusCell("Đang hiển thị"), { ok: true, value: "published" });
  assert.equal(statusCell("bán").ok, false);
});

test("Bảng không có slug khớp theo tên (không phân biệt hoa thường/khoảng trắng); trùng tên trong file bị báo", async () => {
  const writes: unknown[] = [];
  const base = fakeDataset(items, writes);
  const byName: TransferDataset<Item, null> = {
    ...base,
    matchKey: (key) => key.replace(/\s+/g, " ").trim().toLocaleLowerCase("vi"),
    fields: [field({ key: "name", header: "Tên", requiredOnCreate: true, get: (item) => item.name, format: (value) => value, parse: text(50, { required: true }) }), ...base.fields.slice(2)],
    load: async () => ({ items: structuredClone(items).map((item) => ({ ...item, slug: item.name })), context: null }),
    build: (changes, existing, context) => base.build({ ...changes, slug: existing?.slug ?? changes.name }, existing, context),
  };
  const { plan } = await planImport(byName, [["Tên", "Giá (VNĐ)"], ["  MÁY   IN ", "1700000"], ["Máy quét", "5"], ["máy quét", "6"]], publisher);
  assert.equal(plan.rows[0].action, "update");
  assert.equal(plan.rows[0].version, 3);
  assert.equal(plan.rows[1].action, "create");
  assert.match(plan.rows[2].errors.join(" "), /Trùng "Tên" với dòng 3/);
});

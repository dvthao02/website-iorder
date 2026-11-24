import assert from "node:assert/strict";
import { test } from "node:test";

import { leadsToCsv } from "./leads.csv";

const base = { email: null, businessModel: null, branches: null, need: null, message: null, status: "new" as const, createdAt: new Date("2026-10-17T03:00:00Z"), handledAt: null, context: null };

test("CSV có BOM, tiêu đề tiếng Việt, giờ Việt Nam và trạng thái dễ đọc", () => {
  const csv = leadsToCsv([{ ...base, name: "Nguyễn Văn A", phone: "0901234567" }]);
  assert.ok(csv.startsWith("﻿Thời điểm gửi,Họ tên,Điện thoại"));
  const row = csv.split("\r\n")[1];
  assert.equal(row, ["2026-10-17 10:00", "Nguyễn Văn A", "0901234567", "", "", "", "", "", "", "", "", "", "Mới", ""].join(","));
});

test("Liên hệ hỏi mua thiết bị ghi tên, mã, tình trạng và giá lúc hỏi", () => {
  const context = { kind: "equipment" as const, equipmentId: "6f1f2c9e-1a3b-4c5d-8e7f-0a1b2c3d4e5f", slug: "may-pos-x1", name: "Máy POS X1", modelCode: "X1-2026", brand: "iOrder", groupName: "Máy POS", priceVnd: 12500000, availability: "pre_order" as const, capturedAt: "2026-10-17T03:00:00.000Z" };
  const row = leadsToCsv([{ ...base, name: "Lê B", phone: "0912345678", context }]).split("\r\n")[1].split(",");
  assert.deepEqual(row.slice(7, 11), ["Máy POS X1", "X1-2026", "Đặt trước", "12500000"]);
});

test("Ô có dấu phẩy, ngoặc kép, xuống dòng được bọc; ô như công thức bị vô hiệu", () => {
  const csv = leadsToCsv([{ ...base, name: "=HYPERLINK(\"x\")", phone: "+84901234567", message: "Dòng 1\nDòng 2, \"gấp\"" }]);
  const row = csv.split("\r\n").slice(1).join("\r\n");
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.includes(",0901234567,"));
  // Số cũ sai quy tắc giữ nguyên; bắt đầu bằng + thì vẫn bị vô hiệu như công thức.
  assert.ok(leadsToCsv([{ ...base, name: "Lê B", phone: "+1 202 555 0143" }]).includes("'+1 202 555 0143"));
  assert.ok(row.includes(`"Dòng 1\nDòng 2, ""gấp"""`));
});

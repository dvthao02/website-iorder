import assert from "node:assert/strict";
import { test } from "node:test";

import { leadsToCsv } from "./leads.csv";

const base = { email: null, businessModel: null, branches: null, need: null, message: null, status: "new" as const, createdAt: new Date("2026-10-17T03:00:00Z"), handledAt: null };

test("CSV có BOM, tiêu đề tiếng Việt, giờ Việt Nam và trạng thái dễ đọc", () => {
  const csv = leadsToCsv([{ ...base, name: "Nguyễn Văn A", phone: "0901234567" }]);
  assert.ok(csv.startsWith("﻿Thời điểm gửi,Họ tên,Điện thoại"));
  const row = csv.split("\r\n")[1];
  assert.equal(row, "2026-10-17 10:00,Nguyễn Văn A,0901234567,,,,,,Mới,");
});

test("Ô có dấu phẩy, ngoặc kép, xuống dòng được bọc; ô như công thức bị vô hiệu", () => {
  const csv = leadsToCsv([{ ...base, name: "=HYPERLINK(\"x\")", phone: "+84901234567", message: "Dòng 1\nDòng 2, \"gấp\"" }]);
  const row = csv.split("\r\n").slice(1).join("\r\n");
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.includes("'+84901234567"));
  assert.ok(row.includes(`"Dòng 1\nDòng 2, ""gấp"""`));
});

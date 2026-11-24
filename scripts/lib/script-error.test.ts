import assert from "node:assert/strict";
import test from "node:test";

import { describeScriptError } from "./script-error";

test("Thiếu DATABASE_URL: nêu lý do và gợi ý nạp .env", () => {
  const text = describeScriptError(new Error("DATABASE_URL is required before accessing the database."), "cleanup-deleted-leads");
  assert.match(text, /DATABASE_URL is required/);
  assert.match(text, /node --env-file=\.env --import tsx scripts\/cleanup-deleted-leads\.ts/);
});

test("Lỗi kết nối: có mã và nguyên nhân gốc, địa chỉ kết nối chứa mật khẩu bị che", () => {
  const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
  const text = describeScriptError(new Error("Failed query on postgres://iorder:bi-mat-123@db:5432/iorder", { cause }));
  assert.match(text, /ECONNREFUSED/);
  assert.match(text, /127\.0\.0\.1:5432/);
  assert.doesNotMatch(text, /bi-mat-123|iorder:bi-mat/);
  assert.match(text, /<địa chỉ đã ẩn>/);
});

test("Lỗi truy vấn của Drizzle không in câu SQL và tham số (có thể chứa dữ liệu khách), chỉ in nguyên nhân gốc", () => {
  const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
  const text = describeScriptError(new Error('Failed query: update "contact_leads" set "name" = $1\nparams: Nguyễn Văn A,0912345678', { cause }));
  assert.equal(text, "truy vấn SQL thất bại ← [ECONNREFUSED] connect ECONNREFUSED 127.0.0.1:5432");
});

test("Giá trị không phải Error, vòng lặp nguyên nhân và lỗi rỗng không làm hỏng", () => {
  assert.equal(describeScriptError("hỏng rồi"), "hỏng rồi");
  assert.equal(describeScriptError(undefined), "lỗi không rõ");
  const loop = new Error("vòng lặp");
  loop.cause = loop;
  assert.equal(describeScriptError(loop), "vòng lặp");
});

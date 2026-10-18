import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { desc } from "drizzle-orm";

import { posts } from "@iorder/core/db/schema";
import { adminListQuerySchema, listDateSchema, vietnamDayRange } from "./admin-list.contract";
import { listOrder, vietnameseText, workflowStatusRank } from "./list-order";

const dialect = new PgDialect();
const render = (parts: ReturnType<typeof listOrder>) => parts.map((part) => dialect.sqlToQuery(part).sql).join(", ");

test("Chỉ khóa sắp xếp trong danh sách trắng được dùng; khóa lạ giữ thứ tự mặc định", () => {
  const sortable = { title: vietnameseText(posts.title), status: workflowStatusRank(posts.status) };
  const fallback = [desc(posts.updatedAt)];
  assert.equal(render(listOrder(sortable, { sort: "title", dir: "asc" }, fallback)), `"posts"."title" collate "vi-x-icu" asc, "posts"."updated_at" desc`);
  assert.match(render(listOrder(sortable, { sort: "status" }, fallback)), /^case "posts"."status" when 'draft' then 1 .* end desc, "posts"."updated_at" desc$/);
  for (const sort of ["password_hash", "constructor", "__proto__", undefined]) assert.equal(render(listOrder(sortable, { sort, dir: "asc" }, fallback)), `"posts"."updated_at" desc`);
});

test("Tham số sort/dir/ngày sai bị bỏ qua thay vì làm hỏng trang", () => {
  const parsed = adminListQuerySchema.parse({ sort: "title; drop table", dir: "sideways" });
  assert.equal(parsed.sort, undefined);
  assert.equal(parsed.dir, undefined);
  assert.equal(listDateSchema.parse("2026-02-30x"), undefined);
  assert.equal(listDateSchema.parse("2026-10-18"), "2026-10-18");
});

test("Khoảng ngày tính theo giờ Việt Nam, ngày kết thúc lấy trọn ngày", () => {
  const { start, end } = vietnamDayRange("2026-10-01", "2026-10-18");
  assert.equal(start?.toISOString(), "2026-09-30T17:00:00.000Z");
  assert.equal(end?.toISOString(), "2026-10-18T17:00:00.000Z");
  assert.deepEqual(vietnamDayRange(), { start: undefined, end: undefined });
});

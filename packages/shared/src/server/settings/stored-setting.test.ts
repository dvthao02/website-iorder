import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { parseStoredSetting } from "./stored-setting";

const schema = z.object({ title: z.string().min(1) }).strict();

test("Giá trị hợp lệ được trả nguyên", () => {
  assert.deepEqual(parseStoredSetting(schema, { title: "iOrder" }, "demo"), { title: "iOrder" });
});

test("Giá trị lệch schema không làm sập, trả dự phòng và ghi log", (context) => {
  const logged = context.mock.method(console, "error", () => undefined);
  assert.equal(parseStoredSetting(schema, { title: "" }, "demo"), null);
  assert.deepEqual(parseStoredSetting(schema, "hỏng", "demo", { title: "Mặc định" }), { title: "Mặc định" });
  assert.equal(logged.mock.callCount(), 2);
});

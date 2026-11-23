import assert from "node:assert/strict";
import test from "node:test";

import { backupKeepDefault, backupKeepMax, backupKeepMin, backupKeepSchema } from "./backup-retention";

test("Số bản giữ lại: số nguyên trong khoảng cho phép, mặc định nằm trong khoảng đó", () => {
  assert.ok(backupKeepDefault >= backupKeepMin && backupKeepDefault <= backupKeepMax);
  for (const value of [backupKeepMin, 14, backupKeepMax]) assert.equal(backupKeepSchema.safeParse(value).success, true, String(value));
  // Dưới mức tối thiểu thì phục hồi (tự sao lưu hiện trạng trước) không còn bản dự phòng.
  for (const value of [0, 1, backupKeepMin - 1, backupKeepMax + 1, 14.5, -3, "14", null, Number.NaN]) assert.equal(backupKeepSchema.safeParse(value).success, false, String(value));
});

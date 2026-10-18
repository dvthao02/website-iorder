import assert from "node:assert/strict";
import test from "node:test";

import { getAdminNotifications } from "./notifications.service";

// Không có DATABASE_URL trong test: nếu service truy vấn module bị thiếu quyền, getDb() sẽ ném lỗi.
test("Thông báo không truy vấn gì khi người xem không có quyền lead hay xuất bản", async () => {
  assert.deepEqual(await getAdminNotifications({ role: "editor", permissions: ["posts.view", "posts.update", "pages.view"] }), []);
});

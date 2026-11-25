import assert from "node:assert/strict";
import test from "node:test";

import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

import { auditLogs } from "@iorder/shared/db/schema";
import { runWithRequestContext } from "../shared/request-context";
import { currentViewerId, hiddenAccountLabel, shownFullName, shownUsername, visibleActor, visibleEntityId, visibleUser } from "./hidden-users";

const dialect = new PgDialect();
const render = (query: SQL) => dialect.sqlToQuery(query);
const viewer = "11111111-1111-4111-8111-111111111111";
const asViewer = <T>(viewerId: string | null, run: () => T) => runWithRequestContext({ ipAddress: null, userAgent: null, requestId: null, viewerId }, run);

test("Không có người xem (script, tác vụ nền): tài khoản ẩn bị che với tất cả", () => {
  assert.equal(currentViewerId(), null);
  const visible = render(visibleUser());
  assert.match(visible.sql, /^not coalesce\("users"\."is_hidden", false\)$/);
  assert.deepEqual(visible.params, []);
  const actor = render(visibleActor(auditLogs.userId));
  assert.match(actor.sql, /hidden_user\.is_hidden and hidden_user\.id is distinct from \$1::uuid/);
  assert.deepEqual(actor.params, [null]);
});

test("Có người xem: chừa lại đúng tài khoản của chính họ, cùng một biểu thức cho mọi truy vấn", () => {
  asViewer(viewer, () => {
    assert.equal(currentViewerId(), viewer);
    const visible = render(visibleUser());
    assert.match(visible.sql, /^not coalesce\("users"\."is_hidden" and "users"\."id" is distinct from \$1::uuid, false\)$/);
    assert.deepEqual(visible.params, [viewer]);
    assert.deepEqual(render(visibleActor(auditLogs.userId)).params, [viewer]);
    assert.deepEqual(render(visibleEntityId(auditLogs.entityId)).params, [viewer]);
  });
  // Ngoài ngữ cảnh người xem trước đó không bị rò sang.
  assert.equal(currentViewerId(), null);
});

test("Tên hiển thị: tài khoản ẩn thành nhãn chung, tên đăng nhập thành null; không rò tên thật vào tham số", () => {
  for (const viewerId of [null, viewer]) {
    asViewer(viewerId, () => {
      const name = render(shownFullName());
      assert.match(name.sql, /^case when .* then \$\d else "users"\."full_name" end$/);
      assert.ok(name.params.includes(hiddenAccountLabel));
      const username = render(shownUsername());
      assert.match(username.sql, /^case when .* then null else "users"\."username" end$/);
    });
  }
  assert.equal(hiddenAccountLabel, "Quản trị hệ thống");
});

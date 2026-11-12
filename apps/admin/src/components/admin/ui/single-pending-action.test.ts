import assert from "node:assert/strict";
import test from "node:test";
import { withSinglePendingAction } from "./single-pending-action";

test("khóa đồng bộ ngăn handler lặp, hoàn tất cho phép thao tác tiếp", async () => {
  const pending = { current: false };
  let calls = 0;
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const first = withSinglePendingAction(pending, async () => { calls++; await wait; });
  assert.equal(pending.current, true);
  assert.equal(await withSinglePendingAction(pending, async () => { calls++; }), false);
  assert.equal(calls, 1);
  finish();
  assert.equal(await first, true);
  assert.equal(pending.current, false);
  assert.equal(await withSinglePendingAction(pending, async () => { calls++; }), true);
  assert.equal(calls, 2);
});

test("thao tác lỗi nhả khóa để người dùng thử lại", async () => {
  const pending = { current: false };
  const error = new Error("Lỗi kiểm thử");
  await assert.rejects(withSinglePendingAction(pending, async () => { throw error; }), error);
  assert.equal(pending.current, false);
  assert.equal(await withSinglePendingAction(pending, async () => undefined), true);
});

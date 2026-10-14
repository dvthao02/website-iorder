import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeMediaAssets } from "./merge-media-assets";

test("Response cũ không làm mất tệp vừa upload", () => {
  assert.deepEqual(mergeMediaAssets([{ id: "old" }], [{ id: "new" }]), [{ id: "new" }, { id: "old" }]);
});
test("Không lặp ID và giữ metadata upload mới", () => {
  assert.deepEqual(mergeMediaAssets([{ id: "a", name: "cũ" }], [{ id: "a", name: "mới" }]), [{ id: "a", name: "mới" }]);
});
test("Không sửa mảng nguồn", () => {
  const remote = [{ id: "a" }];
  const uploaded = [{ id: "b" }];
  mergeMediaAssets(remote, uploaded);
  assert.deepEqual(remote, [{ id: "a" }]);
  assert.deepEqual(uploaded, [{ id: "b" }]);
});

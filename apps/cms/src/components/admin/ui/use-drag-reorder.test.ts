import assert from "node:assert/strict";
import test from "node:test";

import { reorder } from "./use-drag-reorder";

test("reorder đưa phần tử tới trước/sau vị trí đích theo chỉ số ban đầu", () => {
  const items = ["a", "b", "c", "d"];
  assert.deepEqual(reorder(items, 0, 2, "after"), ["b", "c", "a", "d"]);
  assert.deepEqual(reorder(items, 0, 2, "before"), ["b", "a", "c", "d"]);
  assert.deepEqual(reorder(items, 3, 0, "before"), ["d", "a", "b", "c"]);
  assert.deepEqual(reorder(items, 3, 1, "after"), ["a", "b", "d", "c"]);
  assert.deepEqual(reorder(items, 1, 1, "after"), items);
  assert.deepEqual(items, ["a", "b", "c", "d"]);
});

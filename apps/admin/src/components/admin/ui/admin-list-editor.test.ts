import assert from "node:assert/strict";
import test from "node:test";
import { moveListItem } from "./admin-list-editor";

test("Dời mục đi nhiều bước một lần (kéo thả) và một bước (phím tắt)", () => {
  const items = ["a", "b", "c", "d"];
  assert.deepEqual(moveListItem(items, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveListItem(items, 3, -3), ["d", "a", "b", "c"]);
  assert.deepEqual(moveListItem(items, 1, 1), ["a", "c", "b", "d"]);
  assert.deepEqual(items, ["a", "b", "c", "d"]);
});

test("Dời vượt biên bị chặn ở đầu/cuối và không đổi mảng khi không dời", () => {
  const items = ["a", "b", "c"];
  assert.deepEqual(moveListItem(items, 1, 9), ["a", "c", "b"]);
  assert.deepEqual(moveListItem(items, 1, -9), ["b", "a", "c"]);
  assert.equal(moveListItem(items, 2, 1), items);
  assert.equal(moveListItem(items, 1, 0), items);
});

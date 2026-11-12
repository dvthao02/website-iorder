import assert from "node:assert/strict";
import { test } from "node:test";

import { descendantsOf } from "./navigation-tree";

const item = (key: string, parentKey: string | null) => ({ key, parentKey });

test("Gộp mọi cấp con cháu vào dưới mục cha, giữ thứ tự cha trước con", () => {
  const items = [item("san-pham", null), item("phan-mem", "san-pham"), item("thiet-bi", "san-pham"), item("pos", "phan-mem"), item("pos-lite", "pos"), item("tin-tuc", null)];
  assert.deepEqual(descendantsOf(items, "san-pham").map((entry) => entry.key), ["phan-mem", "pos", "pos-lite", "thiet-bi"]);
  assert.deepEqual(descendantsOf(items, "tin-tuc"), []);
});

test("Không lặp vô hạn khi dữ liệu menu có vòng", () => {
  const items = [item("a", "b"), item("b", "a")];
  assert.deepEqual(descendantsOf(items, "a").map((entry) => entry.key), ["b"]);
});

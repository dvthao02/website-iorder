import assert from "node:assert/strict";
import { test } from "node:test";
import { clearTransientDrafts, createTransientDraftStore } from "./transient-draft-store";

test("Draft tách identity và baseline, không đổi snapshot nguồn", () => {
  const store = createTransientDraftStore<{ name: string }>();
  const draft = { name: "Tiếng Việt  " };
  store.write("visit-a:group-a", "saved", draft, 0);
  draft.name = "Đã đổi";
  assert.deepEqual(store.read("visit-a:group-a", "saved", 1), { name: "Tiếng Việt  " });
  assert.equal(store.read("visit-b:group-a", "saved", 1), undefined);
  assert.equal(store.read("visit-a:group-a", "new-server-value", 1), undefined);
  assert.equal(store.read("visit-a:group-a", "saved", 1), undefined);
});
test("Draft hết hạn, giới hạn bộ nhớ và xóa sau discard/save", () => {
  const store = createTransientDraftStore<string>(2, 100);
  store.write("a", "saved", "a", 0);
  store.write("b", "saved", "b", 1);
  store.write("c", "saved", "c", 2);
  assert.equal(store.read("a", "saved", 3), undefined);
  store.remove("b");
  assert.equal(store.read("b", "saved", 3), undefined);
  assert.equal(store.read("c", "saved", 102), undefined);
});

test("Kết thúc phiên xóa tất cả store, không mang bản nhập sang phiên sau", () => {
  const first = createTransientDraftStore<string>();
  const second = createTransientDraftStore<string>();
  first.write("a", "saved", "Một", 0);
  second.write("a", "saved", "Hai", 0);
  clearTransientDrafts();
  assert.equal(first.read("a", "saved", 1), undefined);
  assert.equal(second.read("a", "saved", 1), undefined);
});

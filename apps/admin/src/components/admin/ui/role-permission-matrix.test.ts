import assert from "node:assert/strict";
import test from "node:test";

import { allState, moduleState, setModules, setPermission, type MatrixModule } from "./role-permission-matrix";

const posts: MatrixModule = { key: "posts", name: "Bài viết", actions: ["view", "create", "update", "delete", "publish"] };
const menu: MatrixModule = { key: "navigation", name: "Menu", actions: ["view", "update"] };

test("Trạng thái nhóm: none, some (indeterminate), all", () => {
  assert.equal(moduleState(new Set(), posts), "none");
  assert.equal(moduleState(new Set(["posts.view"]), posts), "some");
  assert.equal(moduleState(new Set(["posts.view", "posts.create", "posts.update", "posts.delete", "posts.publish"]), posts), "all");
  assert.equal(allState(new Set(["posts.view", "navigation.view", "navigation.update"]), [posts, menu]), "some");
});

test("Chọn cả module và bỏ chọn cả module", () => {
  const all = setModules(new Set(), [posts], true);
  assert.equal(moduleState(all, posts), "all");
  assert.equal(setModules(all, [posts], false).size, 0);
});

test("Quyền bất kỳ kéo theo Xem; bỏ Xem thì bỏ hết quyền của module", () => {
  const withPublish = setPermission(new Set(), posts, "publish", true);
  assert.deepEqual([...withPublish].sort(), ["posts.publish", "posts.view"]);
  assert.equal(setPermission(withPublish, posts, "view", false).size, 0);
  assert.deepEqual([...setPermission(withPublish, posts, "publish", false)], ["posts.view"]);
});

test("Quyền không được cấp thì không đổi và không tính vào trạng thái nhóm", () => {
  const canGrant = (code: string) => code !== "posts.publish";
  assert.equal(setPermission(new Set(), posts, "publish", true, canGrant).size, 0);
  const granted = setModules(new Set(), [posts], true, canGrant);
  assert.equal(granted.has("posts.publish"), false);
  assert.equal(moduleState(granted, posts, canGrant), "all");
  assert.equal(setModules(new Set(["posts.publish"]), [posts], false, canGrant).has("posts.publish"), true);
});

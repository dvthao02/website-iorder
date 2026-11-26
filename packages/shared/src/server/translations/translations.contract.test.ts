import assert from "node:assert/strict";
import test from "node:test";

import { translationLocalesUpdateSchema } from "./translations.contract";

test("Cập nhật ngôn ngữ: hidden (ngôn ngữ đang tắt) là tùy chọn; không gửi thì để undefined (giữ nguyên), mã lạ bị từ chối", () => {
  assert.deepEqual(translationLocalesUpdateSchema.parse({ locales: ["en", "ja"], expectedVersion: 2 }), { locales: ["en", "ja"], expectedVersion: 2 });
  assert.deepEqual(translationLocalesUpdateSchema.parse({ locales: ["en", "ja"], hidden: ["ja"], expectedVersion: 2 }), { locales: ["en", "ja"], hidden: ["ja"], expectedVersion: 2 });
  assert.deepEqual(translationLocalesUpdateSchema.parse({ locales: ["en"], hidden: [], expectedVersion: 0 }).hidden, [], "gửi danh sách rỗng là bật lại hết");
  for (const bad of [{ locales: ["en"], hidden: ["xx"], expectedVersion: 1 }, { locales: ["en"], hidden: "ja", expectedVersion: 1 }, { locales: ["en"], hidden: ["ja"], expectedVersion: 1, extra: true }]) {
    assert.equal(translationLocalesUpdateSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

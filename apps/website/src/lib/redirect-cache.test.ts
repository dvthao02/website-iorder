import assert from "node:assert/strict";
import test from "node:test";

import { createRedirectLookupCache } from "./redirect-cache";

function counting(results: Record<string, string | null> = {}) {
  const calls: string[] = [];
  const load = async (path: string) => { calls.push(path); return results[path] ?? null; };
  return { calls, load };
}

test("Cùng đường dẫn trong thời hạn chỉ hỏi Backend một lần, kể cả khi kết quả là không có chuyển hướng", async () => {
  const { calls, load } = counting({ "/cu": "/moi" });
  const cache = createRedirectLookupCache({ load, now: () => 1_000 });
  assert.equal(await cache.lookup("/cu"), "/moi");
  assert.equal(await cache.lookup("/cu"), "/moi");
  assert.equal(await cache.lookup("/lien-he"), null);
  assert.equal(await cache.lookup("/lien-he"), null);
  assert.deepEqual(calls, ["/cu", "/lien-he"]);
});

test("Hết thời hạn thì hỏi lại để thay đổi ở CMS có hiệu lực", async () => {
  let clock = 0;
  const { calls, load } = counting();
  const cache = createRedirectLookupCache({ load, now: () => clock, ttlMs: 30_000 });
  await cache.lookup("/a");
  clock = 29_999;
  await cache.lookup("/a");
  assert.equal(calls.length, 1);
  clock = 30_000;
  await cache.lookup("/a");
  assert.equal(calls.length, 2);
});

test("Nhiều yêu cầu đồng thời cho cùng đường dẫn dùng chung một lần hỏi", async () => {
  const { calls, load } = counting();
  const cache = createRedirectLookupCache({ load, now: () => 0 });
  await Promise.all([cache.lookup("/a"), cache.lookup("/a"), cache.lookup("/a")]);
  assert.equal(calls.length, 1);
});

test("Lỗi không được nhớ: lần sau hỏi lại, và người gọi vẫn nhận lỗi", async () => {
  let fail = true;
  const calls: string[] = [];
  const cache = createRedirectLookupCache<string | null>({ load: async (path) => { calls.push(path); if (fail) throw new Error("Backend lỗi"); return null; }, now: () => 0 });
  await assert.rejects(cache.lookup("/a"), /Backend lỗi/);
  fail = false;
  assert.equal(await cache.lookup("/a"), null);
  assert.equal(calls.length, 2);
});

test("Có trần số khóa: quét nhiều đường dẫn lạ chỉ bỏ khóa cũ nhất, không phình bộ nhớ", async () => {
  const { calls, load } = counting();
  const cache = createRedirectLookupCache({ load, now: () => 0, maxEntries: 3 });
  for (const path of ["/1", "/2", "/3", "/4"]) await cache.lookup(path);
  assert.equal(cache.size(), 3);
  await cache.lookup("/4");
  assert.equal(calls.length, 4, "khóa mới vẫn còn");
  await cache.lookup("/1");
  assert.equal(calls.length, 5, "khóa cũ nhất đã bị bỏ");
});

test("clear() xóa hết để lưu chuyển hướng ở CMS có hiệu lực ngay khi website nhận tín hiệu làm mới", async () => {
  const { calls, load } = counting();
  const cache = createRedirectLookupCache({ load, now: () => 0 });
  await cache.lookup("/a");
  cache.clear();
  await cache.lookup("/a");
  assert.equal(calls.length, 2);
});

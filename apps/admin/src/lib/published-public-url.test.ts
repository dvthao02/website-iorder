import assert from "node:assert/strict";
import test from "node:test";
import { publishedPublicUrl } from "./published-public-url";

test("Địa chỉ website lấy từ tham số; thiếu hoặc sai giao thức thì dùng localhost:3000", () => {
  assert.equal(publishedPublicUrl("/news", "https://iorder.vn"), "https://iorder.vn/news");
  assert.equal(publishedPublicUrl("/news", ""), "http://localhost:3000/news");
  assert.equal(publishedPublicUrl("/news", "ftp://iorder.vn"), "http://localhost:3000/news");
});

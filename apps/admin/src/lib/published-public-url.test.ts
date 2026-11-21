import assert from "node:assert/strict";
import test from "node:test";
import { publishedPublicUrl } from "./published-public-url";

test("Địa chỉ website lấy từ tham số; thiếu hoặc sai giao thức thì dùng localhost:3000", () => {
  assert.equal(publishedPublicUrl("/tin-tuc", "https://iorder.vn"), "https://iorder.vn/tin-tuc");
  assert.equal(publishedPublicUrl("/tin-tuc", ""), "http://localhost:3000/tin-tuc");
  assert.equal(publishedPublicUrl("/tin-tuc", "ftp://iorder.vn"), "http://localhost:3000/tin-tuc");
});

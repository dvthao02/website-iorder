import assert from "node:assert/strict";
import test from "node:test";
import { rebaseLoopbackHost } from "./published-public-url";

test("Website cấu hình localhost được đổi theo IP đang mở CMS, giữ cổng và đường dẫn", () => {
  assert.equal(rebaseLoopbackHost("http://localhost:3000/cms-preview?token=a&version=1", "192.168.1.5"), "http://192.168.1.5:3000/cms-preview?token=a&version=1");
  assert.equal(rebaseLoopbackHost("http://127.0.0.1:3000/", "may-cua-toi.lan"), "http://may-cua-toi.lan:3000/");
});

test("Giữ nguyên khi mở CMS bằng localhost hoặc website đã có tên miền thật", () => {
  assert.equal(rebaseLoopbackHost("http://localhost:3000/", "localhost"), "http://localhost:3000/");
  assert.equal(rebaseLoopbackHost("http://localhost:3000/", "127.0.0.1"), "http://localhost:3000/");
  assert.equal(rebaseLoopbackHost("https://iorder.vn/", "192.168.1.5"), "https://iorder.vn/");
});

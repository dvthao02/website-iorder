import assert from "node:assert/strict";
import test from "node:test";
import { summarizeUserAgent } from "./user-agent";

test("nhận diện trình duyệt, hệ điều hành và loại thiết bị phổ biến", () => {
  const cases: [string, string][] = [
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36", "Chrome 141 · Windows · Máy tính"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0", "Edge 140 · Windows · Máy tính"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) coc_coc_browser/139.0.0 Chrome/133.0.0.0 Safari/537.36", "Cốc Cốc 139 · Windows · Máy tính"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1", "Safari 18 · iOS 18 · Điện thoại"],
    ["Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36", "Chrome 141 · Android 14 · Điện thoại"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15", "Safari 18 · macOS · Máy tính"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox 131 · Linux · Máy tính"],
    ["curl/8.21.0", "Công cụ dòng lệnh (curl)"],
  ];
  for (const [ua, label] of cases) assert.equal(summarizeUserAgent(ua).label, label, ua);
  assert.equal(summarizeUserAgent(null).label, "Không rõ");
});

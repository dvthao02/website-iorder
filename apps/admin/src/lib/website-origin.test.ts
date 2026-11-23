import assert from "node:assert/strict";
import test from "node:test";

import { hostnameOf, isLocalNetworkHostname, resolvePublicOrigin, resolveWebsiteOrigin, websiteUrl } from "./website-origin";

const resolve = (requestHost: string | null, configuredSiteUrl: string | null = null, envOrigin: string | undefined = "http://localhost:3000") => resolveWebsiteOrigin({ requestHost, configuredSiteUrl, envOrigin });

test("Đọc tên máy từ Host: bỏ cổng, lấy giá trị đầu của X-Forwarded-Host, hỗ trợ IPv6", () => {
  assert.equal(hostnameOf("192.168.1.5:3001"), "192.168.1.5");
  assert.equal(hostnameOf("Admin.iOrder.vn, proxy.local"), "admin.iorder.vn");
  assert.equal(hostnameOf("[::1]:3001"), "[::1]");
  assert.equal(hostnameOf(null), "");
});

test("Nhận ra tên máy chỉ có trong mạng nội bộ; tên miền thật và IP công cộng thì không", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]", "10.0.0.7", "192.168.1.5", "172.16.0.1", "172.31.255.1", "169.254.1.1", "may-cua-toi", "pc.local", "nas.lan"]) assert.equal(isLocalNetworkHostname(host), true, host);
  for (const host of ["admin.iorder.vn", "iorder.vn", "8.8.8.8", "172.32.0.1", "172.15.0.1", "192.169.1.1", ""]) assert.equal(isLocalNetworkHostname(host), false, host);
});

test("Mở CMS bằng localhost: website ở localhost cổng cấu hình", () => {
  assert.equal(resolve("localhost:3001"), "http://localhost:3000");
});

test("Mở CMS bằng IP LAN: website đổi sang cùng IP, giữ cổng website; không dùng tên miền đã cấu hình ở Cài đặt", () => {
  assert.equal(resolve("192.168.1.5:3001"), "http://192.168.1.5:3000");
  assert.equal(resolve("192.168.1.5:3001", "https://iorder.vn"), "http://192.168.1.5:3000");
  assert.equal(resolve("may-cua-toi:3001", null, "http://127.0.0.1:8080"), "http://may-cua-toi:8080");
});

test("Mở CMS bằng IP LAN nhưng website đã đặt địa chỉ thật bằng biến môi trường: giữ địa chỉ đó", () => {
  assert.equal(resolve("192.168.1.5:3001", null, "https://iorder.vn"), "https://iorder.vn");
});

test("Mở CMS bằng tên miền thật: ưu tiên địa chỉ website ở Cài đặt, rồi biến môi trường, cuối cùng giá trị cấu hình sẵn", () => {
  assert.equal(resolve("admin.iorder.vn", "https://www.iorder.vn/", "https://iorder.vn"), "https://www.iorder.vn");
  assert.equal(resolve("admin.iorder.vn", null, "https://iorder.vn"), "https://iorder.vn");
  assert.equal(resolve("admin.iorder.vn", "http://localhost:3000", "https://iorder.vn"), "https://iorder.vn");
  assert.equal(resolve("admin.iorder.vn"), "http://localhost:3000");
});

test("Giá trị hỏng hoặc thiếu không làm hỏng: dùng mặc định", () => {
  assert.equal(resolve("localhost:3001", "không phải url", "ftp://x"), "http://localhost:3000");
  assert.equal(resolve(null, null, undefined), "http://localhost:3000");
  assert.equal(resolve("admin.iorder.vn", "javascript:alert(1)", "https://iorder.vn"), "https://iorder.vn");
});

test("Ghép đường dẫn với địa chỉ gốc; URL tuyệt đối giữ nguyên", () => {
  assert.equal(websiteUrl("http://192.168.1.5:3000", "/news/bai"), "http://192.168.1.5:3000/news/bai");
  assert.equal(websiteUrl("http://192.168.1.5:3000", "https://cdn.example.com/a.png"), "https://cdn.example.com/a.png");
});

test("Địa chỉ trong bản xem trước Google ưu tiên Địa chỉ website ở Cài đặt, kể cả khi mở CMS qua LAN; chưa đặt hoặc là localhost thì dùng địa chỉ nút mở trang", () => {
  assert.equal(resolvePublicOrigin("https://www.iorder.vn/", "http://192.168.1.5:3000"), "https://www.iorder.vn");
  assert.equal(resolvePublicOrigin(null, "http://192.168.1.5:3000"), "http://192.168.1.5:3000");
  assert.equal(resolvePublicOrigin("http://localhost:3000", "http://192.168.1.5:3000"), "http://192.168.1.5:3000");
  assert.equal(resolvePublicOrigin("không phải url", "https://iorder.vn"), "https://iorder.vn");
});

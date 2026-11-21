import assert from "node:assert/strict";
import { test } from "node:test";

import { getClientAddress, isInternalAddress } from "./client-address";

test("Nhận ra địa chỉ nội bộ: loopback, mạng riêng, Docker, link-local, ULA, IPv4 nhúng trong IPv6", () => {
  for (const address of ["127.0.0.1", "127.8.8.8", "10.1.2.3", "172.16.0.1", "172.18.0.5", "172.31.255.255", "192.168.100.99", "169.254.1.1", "0.0.0.0",
    "::1", "::", "::ffff:127.0.0.1", "::ffff:172.18.0.5", "::ffff:7f00:1", "fd12:3456::1", "fc00::1", "fe80::1"]) {
    assert.equal(isInternalAddress(address), true, address);
  }
});

test("Địa chỉ công cộng không bị coi là nội bộ (kể cả sát ranh giới dải mạng riêng)", () => {
  for (const address of ["8.8.8.8", "203.0.113.8", "198.51.100.4", "172.15.255.255", "172.32.0.1", "192.167.1.1", "192.169.1.1", "11.0.0.1", "126.0.0.1", "128.0.0.1",
    "2001:db8::8", "2606:4700::1111", "::ffff:8.8.8.8", "::ffff:808:808", "fe00::1", "not-an-ip", ""]) {
    assert.equal(isInternalAddress(address), false, address);
  }
});

test("Lấy IP ngoài cùng do Caddy thêm thay vì giá trị client tự chèn", () => {
  assert.equal(getClientAddress("198.51.100.4, 203.0.113.8", null), "203.0.113.8");
  assert.equal(getClientAddress("198.51.100.4, 2001:db8::8", null), "2001:db8::8");
});

test("Chỉ nhận IP hợp lệ và dùng X-Real-IP khi không có X-Forwarded-For", () => {
  assert.equal(getClientAddress(null, "203.0.113.8"), "203.0.113.8");
  assert.equal(getClientAddress("not-an-ip", "203.0.113.8"), null);
  assert.equal(getClientAddress(null, "not-an-ip"), null);
});

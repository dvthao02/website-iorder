import assert from "node:assert/strict";
import test from "node:test";

import { gmailActionSchema, gmailCallbackPath, gmailConnectionSchema, gmailSettingsSchema, gmailSettingsUpdateSchema, gmailStatusSchema, maxGmailCc } from "./gmail.contract";

test("CC được cắt khoảng trắng, đổi sang chữ thường; trùng, sai định dạng hoặc quá số lượng bị từ chối", () => {
  assert.deepEqual(gmailSettingsSchema.parse({ enabled: true, cc: ["  A@Gmail.com "] }).cc, ["a@gmail.com"]);
  assert.equal(gmailSettingsSchema.safeParse({ enabled: true, cc: ["a@gmail.com", "A@GMAIL.com"] }).success, false);
  assert.equal(gmailSettingsSchema.safeParse({ enabled: true, cc: ["khong-phai-email"] }).success, false);
  assert.equal(gmailSettingsSchema.safeParse({ enabled: true, cc: ["a@x.com\r\nBcc: b@x.com"] }).success, false);
  assert.equal(gmailSettingsSchema.safeParse({ enabled: true, cc: Array.from({ length: maxGmailCc + 1 }, (_, index) => `n${index}@x.com`) }).success, false);
  assert.equal(gmailSettingsSchema.safeParse({ enabled: true, cc: [], extra: 1 }).success, false, "schema chặt: không nhận trường lạ");
});

test("Cập nhật cài đặt bắt buộc có expectedVersion", () => {
  assert.equal(gmailSettingsUpdateSchema.safeParse({ enabled: false, cc: [] }).success, false);
  assert.equal(gmailSettingsUpdateSchema.safeParse({ enabled: false, cc: [], expectedVersion: 0 }).success, true);
});

test("Hành động POST: connect cần mật khẩu và địa chỉ quay lại; finish cần mã và state; hành động lạ bị từ chối", () => {
  assert.equal(gmailActionSchema.safeParse({ action: "connect", password: "p", redirectUri: `https://cms.example.vn${gmailCallbackPath}` }).success, true);
  assert.equal(gmailActionSchema.safeParse({ action: "connect", redirectUri: `https://cms.example.vn${gmailCallbackPath}` }).success, false);
  assert.equal(gmailActionSchema.safeParse({ action: "finish", code: "c", state: "x".repeat(32) }).success, true);
  assert.equal(gmailActionSchema.safeParse({ action: "finish", code: "c", state: "ngan" }).success, false);
  assert.equal(gmailActionSchema.safeParse({ action: "disconnect", password: "" }).success, false);
  assert.equal(gmailActionSchema.safeParse({ action: "test" }).success, true);
  assert.equal(gmailActionSchema.safeParse({ action: "xoa-het" }).success, false);
});

test("Trạng thái trả về CMS không có chỗ cho token: schema chặt từ chối trường lạ", () => {
  const connection = { email: "a@gmail.com", status: "connected", connectedAt: "2026-11-26T03:00:00.000Z", cmsOrigin: "https://cms.example.vn", lastSentAt: null, lastError: null, lastErrorAt: null };
  assert.equal(gmailConnectionSchema.safeParse(connection).success, true);
  assert.equal(gmailConnectionSchema.safeParse({ ...connection, refreshToken: "x" }).success, false);
  assert.equal(gmailStatusSchema.safeParse({ clientConfigured: true, masterKey: "ok", connection, settings: { enabled: true, cc: [] }, version: 1, callbackPath: gmailCallbackPath }).success, true);
});

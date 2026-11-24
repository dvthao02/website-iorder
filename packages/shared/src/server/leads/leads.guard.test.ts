import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkLeadToken, countLinks, equipmentIdOfContext, evaluateLeadCooldown, evaluatePhoneLimit, hasSameDevice, isDuplicateLead, isPlausibleName, issueLeadToken,
  leadMessageKey, leadTokenMaxAgeMs, leadTokenMinAgeMs,
} from "./leads.guard";

const key = "khoa-kiem-thu";
const at = (offsetMs: number) => new Date(Date.UTC(2026, 10, 23, 10, 0, 0) + offsetMs);

test("Mã phiên: đủ tuổi thì hợp lệ, mới cấp là gửi quá nhanh, quá hạn thì hết hạn", () => {
  const token = issueLeadToken(at(0), key);
  assert.deepEqual(checkLeadToken(token, at(leadTokenMinAgeMs), key), { ok: true });
  assert.deepEqual(checkLeadToken(token, at(leadTokenMaxAgeMs), key), { ok: true });
  assert.deepEqual(checkLeadToken(token, at(500), key), { ok: false, reason: "too_fast", retryAfterSeconds: 2 });
  assert.deepEqual(checkLeadToken(token, at(leadTokenMaxAgeMs + 1), key), { ok: false, reason: "expired" });
});

test("Mã phiên: thiếu, sai chữ ký, sai khóa, sửa giờ cấp hay giờ ở tương lai đều không hợp lệ", () => {
  const token = issueLeadToken(at(0), key);
  const [issued, signature] = token.split(".");
  for (const bad of [undefined, "", "abc", `${issued}`, `${issued}.`, `.${signature}`, `${issued}.${signature}.x`, `${Number(issued) - 60_000}.${signature}`, `${issued}.${signature.slice(0, -2)}xx`]) {
    assert.deepEqual(checkLeadToken(bad, at(10_000), key), { ok: false, reason: "invalid" }, String(bad));
  }
  assert.deepEqual(checkLeadToken(token, at(10_000), "khoa-khac"), { ok: false, reason: "invalid" });
  // Giờ cấp sau thời điểm kiểm tra (đồng hồ chạy ngược hoặc mã giả): không hợp lệ.
  assert.deepEqual(checkLeadToken(issueLeadToken(at(60_000), key), at(0), key), { ok: false, reason: "invalid" });
});

test("Họ tên có chữ cái, không phải đường dẫn, email hay chuỗi số", () => {
  for (const ok of ["Nguyễn Văn A", "Lê B", "Trần Thị Hồng Nhung", "Nguyen Van An", "Anh 2"]) assert.equal(isPlausibleName(ok), true, ok);
  for (const bad of ["http://spam.example", "www.spam.vn", "a@b.com", "kiemtien.xyz", "12345", "1a2b3c4d5e", "A"]) assert.equal(isPlausibleName(bad), false, bad);
});

test("Đếm liên kết trong lời nhắn", () => {
  assert.equal(countLinks("Cần tư vấn máy POS"), 0);
  assert.equal(countLinks("Xem https://iorder.vn/equipment/may-pos"), 1);
  assert.equal(countLinks("http://a.example và https://b.example, www.c.example"), 3);
});

test("Giới hạn theo số điện thoại: 5 liên hệ/30 phút, 10 liên hệ/ngày, bị chặn thì biết phải chờ bao lâu", () => {
  const now = at(0);
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  assert.deepEqual(evaluatePhoneLimit([], now), { allowed: true });
  assert.deepEqual(evaluatePhoneLimit([minutesAgo(10), minutesAgo(8), minutesAgo(6), minutesAgo(4)], now), { allowed: true });
  // Năm liên hệ trong 30 phút qua: chờ tới khi liên hệ cũ nhất (25 phút trước) rời cửa sổ, tức 5 phút.
  assert.deepEqual(evaluatePhoneLimit([minutesAgo(25), minutesAgo(20), minutesAgo(15), minutesAgo(10), minutesAgo(5)], now), { allowed: false, retryAfterSeconds: 5 * 60 });
  // Năm liên hệ cũ hơn 30 phút không còn tính theo cửa sổ ngắn.
  assert.deepEqual(evaluatePhoneLimit([minutesAgo(200), minutesAgo(150), minutesAgo(120), minutesAgo(100), minutesAgo(90)], now), { allowed: true });
  // Mười liên hệ trong ngày, mỗi liên hệ cách nhau xa nên không dính giới hạn 30 phút: chờ tới khi liên hệ cũ nhất đủ 24 giờ.
  const day = [23, 21, 19, 17, 15, 13, 11, 9, 7, 5].map((hours) => minutesAgo(hours * 60));
  assert.deepEqual(evaluatePhoneLimit(day, now), { allowed: false, retryAfterSeconds: 60 * 60 });
  assert.deepEqual(evaluatePhoneLimit(day.slice(0, 9), now), { allowed: true });
});

const idA = "e25bfbbb-9961-41e5-886c-74b5ddeb17a2";
const idB = "9f6a5283-1a34-45ee-98db-2dfa341706e0";

test("Liên hệ chung trùng: cùng số, không gắn thiết bị, cùng lời nhắn (bỏ qua hoa thường và khoảng trắng)", () => {
  const recent = [{ message: "Cần tư vấn  máy POS", context: null }, { message: "Giá bao nhiêu?", context: { equipmentId: idA } }];
  assert.equal(isDuplicateLead(recent, { message: "cần tư vấn máy pos ", equipmentId: null }), true);
  // Cùng lời nhắn nhưng một bên gắn thiết bị, bên kia là liên hệ chung (hoặc thiết bị khác): không phải trùng kiểu này.
  assert.equal(isDuplicateLead(recent, { message: "Giá bao nhiêu?", equipmentId: null }), false);
  assert.equal(isDuplicateLead(recent, { message: "Giá bao nhiêu?", equipmentId: idB }), false);
  assert.equal(isDuplicateLead(recent, { message: "Cần tư vấn máy POS", equipmentId: idA }), false);
  assert.equal(isDuplicateLead([], { message: null, equipmentId: null }), false);
  assert.equal(isDuplicateLead([{ message: null, context: null }], { message: "", equipmentId: null }), true);
});

test("Một số chỉ hỏi mua một thiết bị một lần: so theo mã thiết bị, không phụ thuộc lời nhắn hay tên", () => {
  const recent = [{ context: { equipmentId: idA, slug: "slug-cu", name: "Tên cũ" } }, { context: null }];
  assert.equal(hasSameDevice(recent, idA), true);
  assert.equal(hasSameDevice(recent, idB), false);
  assert.equal(hasSameDevice([{ context: null }, { context: { slug: "chi-co-slug" } }], idA), false);
  assert.equal(hasSameDevice([], idA), false);
});

test("Liên hệ liên tiếp: cùng một số phải cách nhau ít nhất 30 giây", () => {
  const now = at(0);
  const secondsAgo = (seconds: number) => new Date(now.getTime() - seconds * 1_000);
  assert.deepEqual(evaluateLeadCooldown([], now), { allowed: true });
  assert.deepEqual(evaluateLeadCooldown([secondsAgo(30)], now), { allowed: true });
  assert.deepEqual(evaluateLeadCooldown([secondsAgo(600), secondsAgo(31)], now), { allowed: true });
  assert.deepEqual(evaluateLeadCooldown([secondsAgo(10)], now), { allowed: false, retryAfterSeconds: 20 });
  assert.deepEqual(evaluateLeadCooldown([secondsAgo(600), secondsAgo(29.5)], now), { allowed: false, retryAfterSeconds: 1 });
  // Vừa gửi xong (cùng mili giây, hoặc đồng hồ DB đi trước vài giây): chờ không vượt quá khoảng giãn cách.
  assert.deepEqual(evaluateLeadCooldown([secondsAgo(0)], now), { allowed: false, retryAfterSeconds: 30 });
  assert.deepEqual(evaluateLeadCooldown([new Date(now.getTime() + 5_000)], now), { allowed: false, retryAfterSeconds: 30 });
});

test("Khóa lời nhắn và mã thiết bị lấy từ ngữ cảnh đã lưu", () => {
  assert.equal(leadMessageKey("  Xin  CHÀO\nbạn "), "xin chào bạn");
  assert.equal(leadMessageKey(null), "");
  assert.equal(equipmentIdOfContext({ equipmentId: idA }), idA);
  for (const bad of [null, undefined, 3, "x", {}, { equipmentId: 5 }, { slug: "may-pos" }]) assert.equal(equipmentIdOfContext(bad), null);
});

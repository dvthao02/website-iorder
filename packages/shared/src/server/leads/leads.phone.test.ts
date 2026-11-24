import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPhoneDisplay, isValidPhone, normalizePhone, phoneRule, sanitizePhoneInput } from "./leads.phone";

test("+84 (hoặc 84, 0084) thay cho số 0 đầu: mọi cách viết cùng một số", () => {
  for (const raw of [
    "0912345678", "0912 345 678", "0912.345.678", "(091) 234-5678", " 0912345678 ",
    "+84912345678", "+84 912 345 678", "+84-912-345-678", "+ 84 912 345 678", "84912345678", "0084912345678",
    // Gõ cả mã nước lẫn số 0 đầu.
    "+84 0912 345 678", "+84 (0) 912 345 678",
  ]) {
    assert.equal(normalizePhone(raw), "0912345678", raw);
    assert.equal(isValidPhone(raw), true, raw);
  }
});

test("Máy bàn có mã vùng là 11 chữ số, +84 vẫn đổi về số 0", () => {
  for (const raw of ["028 7107 3999", "02871073999", "+84 28 7107 3999", "+84 (0)28 7107 3999", "842871073999"]) {
    assert.equal(normalizePhone(raw), "02871073999", raw);
    assert.equal(isValidPhone(raw), true, raw);
  }
});

test("Tổng số chữ số phải là 10 hoặc 11 và bắt đầu bằng 0", () => {
  for (const bad of [
    "", "0", "091234567", "12345678", "912345678", "091234567890", "0123456789012345", "09123456789012",
    // +84 nhưng phần còn lại thiếu hoặc thừa chữ số.
    "+84 12345678", "+84 91234567", "+84 9123456789012", "84123",
  ]) assert.equal(isValidPhone(bad), false, bad);
  // Không có số 0 đầu và không phải +84 thì không tự thêm 0.
  assert.equal(isValidPhone("912345678"), false);
});

test("Chỉ nhận chữ số và + ở đầu đi với mã nước 84; mã nước khác, chữ, ký tự lạ bị từ chối", () => {
  for (const bad of ["+0912345678", "+1 202 555 0143", "+849123+45678", "0912+345678", "090-abc-1234", "0912345678x", "0912/345/678", "＋84912345678", "0912\u0000345678"]) {
    assert.equal(isValidPhone(bad), false, bad);
  }
});

test("Số bịa dạng lặp bị từ chối", () => {
  for (const bad of ["0000000000", "1111111111", "0909090909", "0900000000", "+84 900 000 000"]) assert.equal(isValidPhone(bad), false, bad);
});

test("Số điện thoại chuẩn hóa là chữ số, khóa so sánh giống nhau cho mọi cách viết", () => {
  assert.equal(normalizePhone("84123"), "84123");
  assert.equal(normalizePhone("abc"), "");
  assert.match(phoneRule, /10–11/);
});

test("Ô nhập bỏ ký tự không được gõ và chỉ giữ một dấu + ở đầu", () => {
  assert.equal(sanitizePhoneInput("0912 abc 345-678"), "0912  345-678");
  assert.equal(sanitizePhoneInput("+84 912 345 678"), "+84 912 345 678");
  assert.equal(sanitizePhoneInput("+84+912+345"), "+84912345");
  assert.equal(sanitizePhoneInput("09+12"), "0912");
  assert.equal(sanitizePhoneInput("  +84 9"), "+84 9");
  assert.equal(sanitizePhoneInput("(028) 7107.3999"), "(028) 7107.3999");
  assert.equal(sanitizePhoneInput(""), "");
});

test("Hiển thị trong CMS: số hợp lệ về dạng chuẩn có nhóm chữ số, số cũ sai quy tắc giữ nguyên", () => {
  assert.deepEqual(formatPhoneDisplay("+84964350515"), { text: "0964 350 515", digits: "0964350515", valid: true });
  assert.deepEqual(formatPhoneDisplay("0964350515"), { text: "0964 350 515", digits: "0964350515", valid: true });
  assert.deepEqual(formatPhoneDisplay("+84 28 7107 3999"), { text: "028 7107 3999", digits: "02871073999", valid: true });
  // Liên hệ cũ thiếu số 0 đầu, quá ngắn: không đoán, giữ nguyên và đánh dấu không hợp lệ.
  assert.deepEqual(formatPhoneDisplay(" 9093823823 "), { text: "9093823823", digits: "9093823823", valid: false });
  assert.deepEqual(formatPhoneDisplay("12345"), { text: "12345", digits: "12345", valid: false });
});

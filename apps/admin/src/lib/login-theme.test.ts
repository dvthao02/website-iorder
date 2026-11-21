import assert from "node:assert/strict";
import test from "node:test";

import { isChristmasSeason, resolveLoginTheme } from "./login-theme";

// Mốc giờ Việt Nam (UTC+7) đổi sang UTC để test không phụ thuộc múi giờ máy chạy.
const vietnam = (iso: string) => new Date(`${iso}+07:00`);

test("Mùa Giáng sinh từ 15/11 đến hết 10/01 theo giờ Việt Nam", () => {
  for (const day of ["2026-11-15T00:00:00", "2026-11-30T12:00:00", "2026-12-25T08:00:00", "2026-12-31T23:59:59", "2027-01-01T00:00:00", "2027-01-10T23:59:59"]) assert.equal(isChristmasSeason(vietnam(day)), true, day);
  for (const day of ["2026-11-14T23:59:59", "2026-06-01T12:00:00", "2027-01-11T00:00:00", "2027-02-14T12:00:00"]) assert.equal(isChristmasSeason(vietnam(day)), false, day);
});

test("Ranh giới mùa tính theo giờ Việt Nam, không theo UTC", () => {
  // 00:30 ngày 15/11 giờ Việt Nam vẫn còn là 14/11 (17:30) theo UTC; 23:30 ngày 14/11 giờ Việt Nam (16:30 UTC) thì chưa vào mùa.
  assert.equal(isChristmasSeason(vietnam("2026-11-15T00:30:00")), true);
  assert.equal(isChristmasSeason(new Date("2026-11-14T17:30:00Z")), true);
  assert.equal(isChristmasSeason(new Date("2026-11-14T16:30:00Z")), false);
  // 23:30 ngày 10/01 giờ Việt Nam là 16:30 ngày 10/01 UTC; 00:30 ngày 11/01 giờ Việt Nam đã hết mùa.
  assert.equal(isChristmasSeason(vietnam("2027-01-10T23:30:00")), true);
  assert.equal(isChristmasSeason(vietnam("2027-01-11T00:30:00")), false);
});

test("Tham số xem thử thắng biến môi trường, biến môi trường thắng mùa", () => {
  const summer = vietnam("2026-07-01T12:00:00");
  const winter = vietnam("2026-12-24T12:00:00");
  assert.equal(resolveLoginTheme({ now: summer }), "default");
  assert.equal(resolveLoginTheme({ now: winter }), "christmas");
  assert.equal(resolveLoginTheme({ now: summer, env: "christmas" }), "christmas");
  assert.equal(resolveLoginTheme({ now: winter, env: "default" }), "default");
  assert.equal(resolveLoginTheme({ now: winter, env: "default", query: "christmas" }), "christmas");
  assert.equal(resolveLoginTheme({ now: summer, env: "christmas", query: "default" }), "default");
});

test("Bảng màu đã chọn ở Giao diện CMS (cookie): Giáng sinh thì bật, bảng màu khác thì trang thường, và thắng mùa", () => {
  const winter = vietnam("2026-12-24T12:00:00");
  const summer = vietnam("2026-07-01T12:00:00");
  assert.equal(resolveLoginTheme({ now: summer, cookie: "christmas" }), "christmas");
  assert.equal(resolveLoginTheme({ now: winter, cookie: "dark" }), "default");
  assert.equal(resolveLoginTheme({ now: winter, cookie: "iorder" }), "default");
  // Chưa chọn gì hoặc giá trị lạ thì theo mùa.
  assert.equal(resolveLoginTheme({ now: winter, cookie: "" }), "christmas");
  assert.equal(resolveLoginTheme({ now: winter, cookie: "halloween" }), "christmas");
  assert.equal(resolveLoginTheme({ now: summer, cookie: "halloween" }), "default");
  // Biến môi trường và tham số xem thử vẫn thắng cookie.
  assert.equal(resolveLoginTheme({ now: winter, cookie: "christmas", env: "default" }), "default");
  assert.equal(resolveLoginTheme({ now: winter, cookie: "dark", env: "default", query: "christmas" }), "christmas");
});

test("Giá trị lạ hoặc rỗng bị bỏ qua", () => {
  const winter = vietnam("2026-12-24T12:00:00");
  const summer = vietnam("2026-07-01T12:00:00");
  assert.equal(resolveLoginTheme({ now: winter, query: "halloween", env: "tet" }), "christmas");
  assert.equal(resolveLoginTheme({ now: summer, query: "", env: "" }), "default");
  assert.equal(resolveLoginTheme({ now: summer, query: "Christmas" }), "default");
});

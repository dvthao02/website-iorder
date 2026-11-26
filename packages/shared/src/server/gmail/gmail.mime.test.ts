import assert from "node:assert/strict";
import test from "node:test";

import { buildMimeMessage, cleanHeaderValue, encodeHeaderText, toBase64Url } from "./gmail.mime";

const decodeWords = (header: string) => header.split(/\r\n /).map((word) => Buffer.from(/^=\?UTF-8\?B\?(.+)\?=$/.exec(word)?.[1] ?? "", "base64").toString("utf8")).join("");

test("Tiêu đề toàn ASCII giữ nguyên, tiếng Việt được mã hóa RFC 2047 và giải mã lại đúng", () => {
  assert.equal(encodeHeaderText("[iOrder] New lead"), "[iOrder] New lead");
  const subject = "[iOrder] Liên hệ mới: Nguyễn Văn Ạ · 0901234567 · hỏi mua máy in hóa đơn Ðặc biệt";
  const encoded = encodeHeaderText(subject);
  assert.match(encoded, /^=\?UTF-8\?B\?/);
  assert.equal(decodeWords(encoded), subject);
  for (const word of encoded.split(/\r\n /)) assert.ok(word.length <= 75, `mỗi từ mã hóa tối đa 75 ký tự: ${word.length}`);
});

test("Mã hóa tiêu đề không cắt giữa một ký tự nhiều byte", () => {
  const subject = "Ạ".repeat(80) + "😀".repeat(20);
  assert.equal(decodeWords(encodeHeaderText(subject)), subject);
});

test("Không chèn được tiêu đề khác qua xuống dòng trong tiêu đề", () => {
  assert.equal(cleanHeaderValue("a\r\nBcc: x@y.com"), "a Bcc: x@y.com");
  const message = buildMimeMessage({ from: "me@gmail.com", to: ["me@gmail.com"], subject: "Chào\r\nBcc: ke-xau@x.com", text: "n" });
  const head = message.split("\r\n\r\n")[0].split("\r\n");
  assert.ok(!head.some((line) => /^Bcc:/i.test(line)), "không có dòng Bcc");
});

test("Địa chỉ không phải email trơn bị từ chối (chèn thêm người nhận hay tiêu đề)", () => {
  for (const bad of ["a@b.com\r\nBcc: x@y.com", "a@b.com, c@d.com", '"A B"@c.com', "<a@b.com>", "khong-co-a-cong", ""]) {
    assert.throws(() => buildMimeMessage({ from: "me@gmail.com", to: ["me@gmail.com"], cc: [bad], subject: "s", text: "t" }), /không hợp lệ/, bad);
  }
  assert.throws(() => buildMimeMessage({ from: "me@gmail.com", to: [], subject: "s", text: "t" }), /ít nhất một người nhận/);
});

test("Thư có To, Cc không trùng người nhận chính, thân base64 giải ra đúng văn bản với CRLF", () => {
  const text = "Dòng một\nDòng hai có tiếng Việt: ắ ề ỗ\n" + "x".repeat(200);
  const message = buildMimeMessage({ from: "me@gmail.com", to: ["me@gmail.com"], cc: ["a@x.com", "me@gmail.com", "a@x.com", "b@x.com"], subject: "Thư thử", text });
  const [head, body] = message.split("\r\n\r\n");
  assert.match(head, /^From: me@gmail\.com\r\nTo: me@gmail\.com\r\nCc: a@x\.com, b@x\.com\r\nSubject: =\?UTF-8\?B\?/);
  assert.match(head, /MIME-Version: 1\.0\r\nContent-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64$/);
  for (const line of body.split("\r\n")) assert.ok(line.length <= 76);
  assert.equal(Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8"), text.replace(/\n/g, "\r\n"));
});

test("Không có CC thì không có dòng Cc", () => {
  const message = buildMimeMessage({ from: "me@gmail.com", to: ["me@gmail.com"], subject: "s", text: "t" });
  assert.ok(!/^Cc:/m.test(message));
});

test("toBase64Url dùng bảng chữ URL (không có +, / hay =) và giải ra đúng thư", () => {
  const message = buildMimeMessage({ from: "me@gmail.com", to: ["me@gmail.com"], subject: "Ạ?>>>", text: "???~~~>>>" });
  const raw = toBase64Url(message);
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  assert.equal(Buffer.from(raw, "base64url").toString("utf8"), message);
});

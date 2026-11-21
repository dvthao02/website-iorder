import assert from "node:assert/strict";
import test from "node:test";

import { changeOwnPasswordSchema, ownPasswordMinLength } from "@iorder/shared/server/auth/account.contract";
import { cmsUserInputSchema } from "@iorder/shared/server/users/users.contract";
import { assessPassword } from "./password-strength";

test("Chưa nhập thì không có mức, chỉ nhắc yêu cầu", () => {
  const empty = assessPassword("");
  assert.equal(empty.level, "empty");
  assert.equal(empty.segments, 0);
  assert.equal(empty.acceptable, false);
  assert.match(empty.tip, /Ít nhất 10 ký tự/);
});

test("Dưới độ dài tối thiểu là Quá ngắn và báo còn thiếu bao nhiêu ký tự", () => {
  const short = assessPassword("abc");
  assert.deepEqual([short.level, short.label, short.segments, short.length, short.acceptable], ["too_short", "Quá ngắn", 1, 3, false]);
  assert.equal(short.tip, "Cần thêm 7 ký tự nữa.");
  assert.equal(assessPassword("a".repeat(ownPasswordMinLength - 1)).tip, "Cần thêm 1 ký tự nữa.");
});

test("Đủ độ dài nhưng chỉ một loại ký tự là Yếu (vẫn được chấp nhận)", () => {
  const weak = assessPassword("kiwiapplez");
  assert.deepEqual([weak.level, weak.label, weak.segments, weak.acceptable], ["weak", "Yếu", 1, true]);
  assert.equal(weak.tip, "Dài từ 16 ký tự sẽ an toàn hơn.");
});

test("Mức tăng theo độ dài và độ đa dạng ký tự", () => {
  assert.equal(assessPassword("kiwi-apple9").level, "fair");
  assert.equal(assessPassword("kiwi-Apple-93").level, "good");
  const strong = assessPassword("Cam-Xoai-Dua-Hau-2026!");
  assert.deepEqual([strong.level, strong.label, strong.segments, strong.tip], ["strong", "Mạnh", 4, "Đủ mạnh."]);
});

test("Thêm ký tự cùng loại không bao giờ làm mức giảm", () => {
  const order = ["too_short", "weak", "fair", "good", "strong"];
  let previous = -1;
  for (let length = 1; length <= 30; length += 1) {
    const level = assessPassword("Kx7#".repeat(Math.ceil(length / 4)).slice(0, length) + "q").level;
    const rank = order.indexOf(level);
    assert.ok(rank >= previous, `độ dài ${length}: ${level}`);
    previous = rank;
  }
});

test("Từ dễ đoán, dãy số và ký tự lặp bị hạ mức kèm gợi ý đúng", () => {
  const common = assessPassword("matkhau123456");
  assert.equal(common.level, "weak");
  assert.match(common.tip, /dễ đoán/);
  // Bỏ dấu tiếng Việt và khoảng trắng/ký hiệu trước khi so: "Mật khẩu 2026!!" cũng là "matkhau2026".
  const vietnamese = assessPassword("Mật khẩu 2026!!");
  assert.equal(vietnamese.level, "fair");
  assert.match(vietnamese.tip, /dễ đoán/);
  const repeated = assessPassword("aaaaaaaaaaaaaaaa");
  assert.equal(repeated.level, "weak");
  assert.equal(repeated.tip, "Dùng nhiều ký tự khác nhau hơn.");
});

test("Chứa tên đăng nhập bị hạ mức; tên quá ngắn thì bỏ qua", () => {
  const withUsername = assessPassword("vthao-Cam-Xoai-9!", { username: "vthao" });
  assert.equal(withUsername.tip, "Đừng dùng tên đăng nhập trong mật khẩu.");
  assert.notEqual(withUsername.level, "strong");
  assert.equal(assessPassword("ab-Cam-Xoai-Dua-9!", { username: "ab" }).level, "strong");
});

test("Trùng mật khẩu hiện tại: luôn Yếu và không được chấp nhận, dù mật khẩu đó mạnh", () => {
  const same = assessPassword("Cam-Xoai-Dua-Hau-2026!", { currentPassword: "Cam-Xoai-Dua-Hau-2026!" });
  assert.deepEqual([same.level, same.segments, same.acceptable, same.tip], ["weak", 1, false, "Phải khác mật khẩu hiện tại."]);
});

test("Thanh báo không bao giờ mâu thuẫn với luật của máy chủ", () => {
  const current = "Mat-khau-cu-12345";
  const samples = ["", "a", "123456789", "1234567890", "kiwiapplez", "Cam-Xoai-Dua-Hau-2026!", current, "x".repeat(1_024), "ký-tự-tiếng-Việt-123"];
  for (const newPassword of samples) {
    const server = changeOwnPasswordSchema.safeParse({ currentPassword: current, newPassword }).success;
    assert.equal(assessPassword(newPassword, { currentPassword: current }).acceptable, server, JSON.stringify(newPassword.slice(0, 20)));
  }
});

test("Chế độ lenient (quản trị viên đặt mật khẩu cho người khác): ngắn vẫn chấp nhận nhưng cảnh báo rõ", () => {
  const empty = assessPassword("", { lenient: true });
  assert.deepEqual([empty.level, empty.acceptable], ["empty", false]);
  assert.equal(empty.tip, "Nên dùng từ 10 ký tự trở lên.");
  const short = assessPassword("123", { lenient: true });
  assert.deepEqual([short.level, short.label, short.segments, short.length, short.acceptable], ["too_short", "Quá ngắn", 1, 3, true]);
  assert.match(short.tip, /Rất dễ bị đoán\. Vẫn lưu được/);
  // Từ 10 ký tự trở đi mức và gợi ý y hệt chế độ thường.
  for (const password of ["kiwiapplez", "matkhau123456", "Cam-Xoai-Dua-Hau-2026!"]) {
    const { acceptable: strictOk, ...strict } = assessPassword(password);
    const { acceptable: lenientOk, ...lenient } = assessPassword(password, { lenient: true });
    assert.deepEqual(lenient, strict, password);
    assert.equal(strictOk, lenientOk);
  }
});

test("Chế độ thường vẫn như cũ khi không bật lenient", () => {
  assert.equal(assessPassword("123").acceptable, false);
  assert.equal(assessPassword("123", { lenient: false }).tip, "Cần thêm 7 ký tự nữa.");
});

test("Chế độ lenient khớp luật của máy chủ cho mật khẩu quản trị viên đặt", () => {
  for (const password of ["", "1", "123", "123456789", "kiwiapplez", "Cam-Xoai-Dua-Hau-2026!", "x".repeat(1_024), "x".repeat(1_025)]) {
    const server = cmsUserInputSchema.shape.password.safeParse(password).success;
    // Quá dài là luật riêng của máy chủ (thanh báo không đo); chỉ so các mẫu trong giới hạn.
    if (password.length > 1_024) { assert.equal(server, false); continue; }
    assert.equal(assessPassword(password, { lenient: true }).acceptable, server, JSON.stringify(password.slice(0, 20)));
  }
});

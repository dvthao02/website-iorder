import assert from "node:assert/strict";
import test from "node:test";

import { openPickerOnClick } from "./admin-input";

type FakeInput = { disabled: boolean; readOnly: boolean; clientWidth: number; showPicker?: () => void };
const click = (input: FakeInput, offsetX: number, defaultPrevented = false) => openPickerOnClick({ currentTarget: input, nativeEvent: { offsetX }, defaultPrevented } as never);

test("Ô ngày/giờ: bấm vào chữ của ô mở bảng chọn, bấm vào biểu tượng ở góc phải thì để trình duyệt tự mở", () => {
  let opened = 0;
  const input: FakeInput = { disabled: false, readOnly: false, clientWidth: 300, showPicker: () => { opened++; } };
  assert.equal(click(input, 20), true);
  assert.equal(click(input, 150), true);
  assert.equal(opened, 2);
  assert.equal(click(input, 290), false, "biểu tượng lịch tự mở bảng chọn, không gọi thêm lần nữa");
  assert.equal(opened, 2);
});

test("Ô bị khóa, chỉ đọc, bị chặn bởi trình xử lý khác hoặc trình duyệt không hỗ trợ/từ chối thì không làm gì và không ném lỗi", () => {
  let opened = 0;
  const open = () => { opened++; };
  assert.equal(click({ disabled: true, readOnly: false, clientWidth: 300, showPicker: open }, 20), false);
  assert.equal(click({ disabled: false, readOnly: true, clientWidth: 300, showPicker: open }, 20), false);
  assert.equal(click({ disabled: false, readOnly: false, clientWidth: 300, showPicker: open }, 20, true), false);
  assert.equal(click({ disabled: false, readOnly: false, clientWidth: 300 }, 20), false, "trình duyệt cũ chưa có showPicker");
  assert.equal(click({ disabled: false, readOnly: false, clientWidth: 300, showPicker: () => { throw new DOMException("không cho phép", "NotAllowedError"); } }, 20), false);
  assert.equal(opened, 0);
});

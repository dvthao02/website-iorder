import assert from "node:assert/strict";
import test from "node:test";
import { emptyHistory, historyLimit, recordEdit, redoEdit, undoEdit } from "./edit-history";

test("Các thay đổi liên tiếp trong cửa sổ gộp thành một bước; cách xa thì thành bước riêng", () => {
  let history = emptyHistory<string>();
  history = recordEdit(history, "a", 1000);
  history = recordEdit(history, "ab", 1200);
  history = recordEdit(history, "abc", 1400);
  assert.deepEqual(history.past, ["a"]);
  history = recordEdit(history, "abcd", 5000);
  assert.deepEqual(history.past, ["a", "abcd"]);
});

test("Hoàn tác rồi Làm lại đi đúng thứ tự; thay đổi mới xóa nhánh Làm lại", () => {
  let history = recordEdit(recordEdit(emptyHistory<number>(), 1, 0), 2, 10_000);
  const back = undoEdit(history, 3)!;
  assert.equal(back.value, 2);
  const back2 = undoEdit(back.history, 2)!;
  assert.equal(back2.value, 1);
  assert.equal(undoEdit(back2.history, 1), null);
  const forward = redoEdit(back2.history, 1)!;
  assert.equal(forward.value, 2);
  history = recordEdit(forward.history, 2, 20_000);
  assert.deepEqual(history.future, []);
  assert.equal(redoEdit(history, 9), null);
});

test("Lịch sử bị giới hạn số bước", () => {
  let history = emptyHistory<number>();
  for (let index = 0; index < historyLimit + 20; index++) history = recordEdit(history, index, index * 10_000);
  assert.equal(history.past.length, historyLimit);
  assert.equal(history.past[0], 20);
});

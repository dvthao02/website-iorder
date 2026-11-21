import assert from "node:assert/strict";
import { test } from "node:test";

import { addressLines } from "./address-lines";

test("Mỗi dòng địa chỉ là một chi nhánh; tên chi nhánh tách khỏi địa chỉ khi có dấu hai chấm", () => {
  const lines = addressLines("Đà Nẵng: 21 Phạm Nhữ Tăng, Phường Thanh Khê, Thành phố Đà Nẵng\r\n\nHồ Chí Minh: 756A Âu Cơ, Phường Tân Bình, Thành phố Hồ Chí Minh  ");
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], { text: "Đà Nẵng: 21 Phạm Nhữ Tăng, Phường Thanh Khê, Thành phố Đà Nẵng", branch: "Đà Nẵng", street: "21 Phạm Nhữ Tăng, Phường Thanh Khê, Thành phố Đà Nẵng" });
  assert.equal(lines[1].branch, "Hồ Chí Minh");
  assert.equal(lines[1].street, "756A Âu Cơ, Phường Tân Bình, Thành phố Hồ Chí Minh");
});

test("Dòng không có tên chi nhánh giữ nguyên cả dòng; địa chỉ trống cho danh sách rỗng", () => {
  assert.deepEqual(addressLines("756A Đ. Âu Cơ, Phường Tân Bình TP.HCM"), [{ text: "756A Đ. Âu Cơ, Phường Tân Bình TP.HCM", branch: null, street: "756A Đ. Âu Cơ, Phường Tân Bình TP.HCM" }]);
  assert.equal(addressLines("Tầng 3: 12 Lê Lợi")[0].branch, null);
  assert.deepEqual(addressLines(null), []);
  assert.deepEqual(addressLines("  \n "), []);
});

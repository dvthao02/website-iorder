import assert from "node:assert/strict";
import test from "node:test";

import { formatBackupSize, formatBackupStamp } from "./backup-format";

test("Dung lượng bản sao lưu hiện KB dưới 1 MB (tối thiểu 1 KB), còn lại MB một chữ số thập phân", () => {
  assert.equal(formatBackupSize(0), "1 KB");
  assert.equal(formatBackupSize(105_916), "103 KB");
  assert.equal(formatBackupSize(5 * 1024 * 1024), "5 MB");
  assert.equal(formatBackupSize(1_572_864), "1,5 MB");
});

test("Mã thời gian bản sao lưu hiện theo giờ Việt Nam; mã lạ trả lại nguyên văn thay vì ném lỗi", () => {
  assert.match(formatBackupStamp("20261122T100000Z"), /17:00/, "10:00 UTC = 17:00 giờ Việt Nam");
  assert.equal(formatBackupStamp("ban-chep-tay"), "ban-chep-tay");
  assert.equal(formatBackupStamp(""), "");
});

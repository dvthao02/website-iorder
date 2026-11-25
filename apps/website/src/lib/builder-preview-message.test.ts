import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseHighlightMessage } from "./builder-preview-message";

test("Tin tô sáng hợp lệ trả về chỉ số khối, kể cả khối chung (âm) và biên", () => {
  assert.equal(parseHighlightMessage({ type: "iorder:highlight-block", index: 0 }), 0);
  assert.equal(parseHighlightMessage({ type: "iorder:highlight-block", index: 99 }), 99);
  assert.equal(parseHighlightMessage({ type: "iorder:highlight-block", index: -19 }), -19);
});

test("Tin sai loại, thiếu/thừa khóa, chỉ số ngoài khoảng hoặc không phải số nguyên đều bị bỏ", () => {
  for (const data of [
    null, undefined, "iorder:highlight-block", 5, [], [1, 2],
    { type: "iorder:select-block", index: 1 },
    { index: 1 },
    { type: "iorder:highlight-block" },
    { type: "iorder:highlight-block", index: 1, extra: true },
    { type: "iorder:highlight-block", index: 100 },
    { type: "iorder:highlight-block", index: -20 },
    { type: "iorder:highlight-block", index: 1.5 },
    { type: "iorder:highlight-block", index: "1" },
    { type: "iorder:highlight-block", index: Number.NaN },
    { type: "iorder:highlight-block", index: Number.POSITIVE_INFINITY },
  ]) assert.equal(parseHighlightMessage(data), null, JSON.stringify(data));
});

// Layout import tĩnh BuilderPreviewBridge nên bundle của mọi trang website gồm cả những gì nó import (xem builder-preview-message.ts).
test("Mã chạy trên mọi trang công khai không kéo zod vào trình duyệt", () => {
  const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
  for (const file of ["apps/website/src/components/site/builder-preview-bridge.tsx", "apps/website/src/lib/builder-preview-message.ts"]) {
    assert.ok(!/from "zod"/.test(read(file)), `${file} không được import zod`);
  }
});

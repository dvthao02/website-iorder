import assert from "node:assert/strict";
import test from "node:test";

import { staticPageSectionLabels } from "@iorder/shared/server/pages/static-page-layout";
import { uiMessages } from "@iorder/shared/server/translations/ui-messages";
import { sectionLabelKey, staticSectionLabelKeys } from "./static-section-labels";

test("Tên mục dự phòng của trang tĩnh: mọi loại khối của CMS có khóa chữ cố định, chữ gốc khớp với CMS; loại lạ dùng \"Nội dung\"", () => {
  assert.deepEqual(Object.keys(staticSectionLabelKeys).sort(), Object.keys(staticPageSectionLabels).sort(), "loại khối của CMS và của website phải giống nhau");
  for (const [type, key] of Object.entries(staticSectionLabelKeys)) assert.equal(uiMessages[key], staticPageSectionLabels[type], `${type} → ${key}: chữ gốc website khác CMS`);
  assert.equal(uiMessages[sectionLabelKey("loai-khong-biet")], "Nội dung");
  assert.equal(sectionLabelKey("rich_text"), "section.richText");
});

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardRangeFilter } from "./dashboard-range-filter";

test("Bộ lọc có ba mức, đánh dấu mức đang chọn; mức mặc định trỏ về /admin, mức khác có ?range=", () => {
  const html = renderToStaticMarkup(<DashboardRangeFilter value={90} />);
  assert.equal(html.match(/admin-range-filter__item/g)?.length, 3);
  assert.match(html, /href="\/admin\?range=7"/);
  assert.match(html, /href="\/admin"[^>]*>30 ngày/);
  assert.match(html, /aria-current="true"[^>]*href="\/admin\?range=90"|href="\/admin\?range=90"[^>]*aria-current="true"/);
  assert.equal(html.match(/aria-current/g)?.length, 1);
});

import assert from "node:assert/strict";
import test from "node:test";

import type { NavigationTarget } from "@iorder/shared/server/navigation/navigation.contract";
import { contentEditHref } from "./navigation-content-href";

const pageId = "11111111-1111-4111-8111-111111111111";
const offeringId = "22222222-2222-4222-8222-222222222222";
const targets: NavigationTarget[] = [
  { id: pageId, linkType: "page", label: "Về iOrder", url: "/about", typeLabel: "Trang website" },
  { id: offeringId, linkType: "offering", label: "Data center", url: "/solutions/data-center", typeLabel: "Giải pháp" },
];

test("Mục menu mở đúng nơi sửa nội dung", () => {
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "/about/" }, targets), `/admin/pages/${pageId}`);
  assert.equal(contentEditHref({ linkType: "offering", contentId: offeringId, url: "/solutions/data-center" }, targets), `/admin/solutions/${offeringId}`);
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "/" }, targets), "/admin/homepage");
  // Chưa xuất bản (không có trong danh sách đích): mở danh sách đã lọc theo đường dẫn.
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "/software/iorder-ev" }, targets), "/admin/products?type=software&query=iorder-ev");
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "/support/setup#huong-dan" }, targets), undefined);
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "https://app.iorder.vn/login" }, targets), undefined);
});

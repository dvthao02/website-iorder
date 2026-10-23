import assert from "node:assert/strict";
import test from "node:test";

import type { NavigationTarget } from "@iorder/core/server/navigation/navigation.contract";
import { contentEditHref } from "./navigation-content-href";

const pageId = "11111111-1111-4111-8111-111111111111";
const offeringId = "22222222-2222-4222-8222-222222222222";
const targets: NavigationTarget[] = [
  { id: pageId, linkType: "page", label: "Về iOrder", url: "/gioi-thieu", typeLabel: "Trang website" },
  { id: offeringId, linkType: "offering", label: "Data center", url: "/giai-phap/data-center", typeLabel: "Giải pháp" },
];

test("Mục menu mở đúng nơi sửa nội dung", () => {
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "/gioi-thieu/" }, targets), `/admin/pages/${pageId}`);
  assert.equal(contentEditHref({ linkType: "offering", contentId: offeringId, url: "/giai-phap/data-center" }, targets), `/admin/solutions/${offeringId}`);
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "/" }, targets), "/admin/homepage");
  // Chưa xuất bản (không có trong danh sách đích): mở danh sách đã lọc theo đường dẫn.
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "/phan-mem/iorder-ev" }, targets), "/admin/products?type=software&query=iorder-ev");
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "/ho-tro/cai-dat#huong-dan" }, targets), undefined);
  assert.equal(contentEditHref({ linkType: "custom", contentId: null, url: "https://app.iorder.vn/login" }, targets), undefined);
});

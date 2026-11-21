import assert from "node:assert/strict";
import { test } from "node:test";

import { authorMetaUrl, resolvePostAuthor } from "./author";

const profile = { slug: "nguyen-van-an", name: " Nguyễn Văn An ", jobTitle: "Chuyên viên", profileUrl: "https://www.linkedin.com/in/an", avatarUrl: null, pageEnabled: true };

test("Hồ sơ tác giả được chọn thắng tác giả khách nhập tay", () => {
  const author = resolvePostAuthor({ authorProfile: profile, authorName: "Người khác", authorTitle: "x", authorUrl: "https://x.example" });
  assert.deepEqual(author, { name: "Nguyễn Văn An", jobTitle: "Chuyên viên", pagePath: "/tac-gia/nguyen-van-an", profileUrl: "https://www.linkedin.com/in/an" });
});

test("Hồ sơ chưa bật trang riêng thì không có liên kết tới trang (vẫn ghi tên)", () => {
  assert.equal(resolvePostAuthor({ authorProfile: { ...profile, pageEnabled: false } })?.pagePath, null);
});

test("Không có hồ sơ: dùng tác giả khách; không có tên nào thì null", () => {
  assert.deepEqual(resolvePostAuthor({ authorProfile: null, authorName: " An ", authorTitle: "  ", authorUrl: "https://x.example/an" }), { name: "An", jobTitle: null, pagePath: null, profileUrl: "https://x.example/an" });
  assert.equal(resolvePostAuthor({ authorProfile: null, authorName: "   " }), null);
  assert.equal(resolvePostAuthor({}), null);
  assert.equal(resolvePostAuthor({ authorProfile: { ...profile, name: "  " }, authorName: null }), null);
});

test("Địa chỉ trong thẻ meta author: trang riêng (tuyệt đối) nếu có, không thì hồ sơ ngoài", () => {
  const withPage = { name: "An", jobTitle: null, pagePath: "/tac-gia/an", profileUrl: "https://x.example/an" };
  assert.equal(authorMetaUrl(withPage, "https://iorder.vn"), "https://iorder.vn/tac-gia/an");
  assert.equal(authorMetaUrl(withPage, undefined), "https://x.example/an");
  assert.equal(authorMetaUrl({ ...withPage, pagePath: null }, "https://iorder.vn"), "https://x.example/an");
  assert.equal(authorMetaUrl({ ...withPage, pagePath: null, profileUrl: null }, "https://iorder.vn"), null);
});

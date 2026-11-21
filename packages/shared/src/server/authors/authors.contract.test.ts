import assert from "node:assert/strict";
import test from "node:test";

import { adminPostInputSchema, publicPostDetailSchema } from "../posts/posts.contract";
import { authorInputSchema, authorPublicPath, authorRequestSchema, postAuthorProfileSchema, publicAuthorSchema } from "./authors.contract";

const id = "4d978bed-080c-40d6-9d77-e099e3f3a12c";
const valid = { name: "Nguyễn Văn An", slug: "nguyen-van-an", jobTitle: "Chuyên viên triển khai", bio: "10 năm triển khai POS cho quán cà phê.", avatarMediaId: null, profileUrl: "https://www.linkedin.com/in/an", isEnabled: true };

test("Tác giả hợp lệ; ô chữ trống và khoảng trắng thành null; tên bị cắt khoảng trắng", () => {
  assert.deepEqual(authorInputSchema.parse(valid), valid);
  const parsed = authorInputSchema.parse({ ...valid, name: "  An  ", jobTitle: "   ", bio: "", profileUrl: null });
  assert.deepEqual([parsed.name, parsed.jobTitle, parsed.bio, parsed.profileUrl], ["An", null, null, null]);
});

test("Tác giả: tên bắt buộc, slug không dấu, trang cá nhân chỉ http(s), giới hạn độ dài, không nhận trường lạ", () => {
  for (const bad of [{ name: "  " }, { slug: "Nguyễn Văn An" }, { slug: "-an" }, { slug: "a".repeat(141) }, { profileUrl: "javascript:alert(1)" }, { profileUrl: "ftp://x.example/a" }, { profileUrl: "khong-phai-url" }, { name: "x".repeat(121) }, { jobTitle: "x".repeat(121) }, { bio: "x".repeat(2001) }, { avatarMediaId: "khong-phai-uuid" }, { isEnabled: "yes" }, { script: "alert(1)" }]) {
    assert.equal(authorInputSchema.safeParse({ ...valid, ...bad }).success, false, JSON.stringify(bad));
  }
  assert.equal(authorInputSchema.safeParse({ ...valid, avatarMediaId: id }).success, true);
});

test("Sửa tác giả bắt buộc expectedVersion, tạo mới thì không", () => {
  assert.equal(authorRequestSchema.safeParse({ id: null, values: valid }).success, true);
  assert.equal(authorRequestSchema.safeParse({ id, values: valid }).success, false);
  assert.equal(authorRequestSchema.safeParse({ id, values: valid, expectedVersion: 0 }).success, true);
  assert.equal(authorRequestSchema.safeParse({ id, values: valid, expectedVersion: -1 }).success, false);
  assert.equal(authorRequestSchema.safeParse({ id: "khong-phai-uuid", values: valid, expectedVersion: 1 }).success, false);
});

test("Đường dẫn công khai của trang tác giả", () => {
  assert.equal(authorPublicPath("nguyen-van-an"), "/tac-gia/nguyen-van-an");
});

test("Dữ liệu công khai của tác giả: chặt chẽ, ảnh có thể trống", () => {
  const author = { id, slug: "an", name: "An", jobTitle: null, bio: null, profileUrl: null, avatar: null, updatedAt: new Date() };
  assert.equal(publicAuthorSchema.safeParse(author).success, true);
  assert.equal(publicAuthorSchema.safeParse({ ...author, isEnabled: true }).success, false);
  assert.equal(postAuthorProfileSchema.safeParse({ slug: "an", name: "An", jobTitle: null, profileUrl: null, avatarUrl: null, pageEnabled: false }).success, true);
  assert.equal(postAuthorProfileSchema.safeParse({ slug: "an", name: "An" }).success, false);
});

const doc = { version: 2, doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung bài." }] }] } };
const postInput = { type: "news", title: "Bài", slug: "bai", excerpt: null, content: doc, status: "draft", seoTitle: null, seoDescription: null, canonicalUrl: null, promotionStartAt: null, promotionEndAt: null, ctaLabel: null, ctaUrl: null, badgeText: null, scheduledAt: null };

test("Bài viết chọn tác giả bằng authorProfileId: không gửi thì hợp lệ (giữ giá trị đã lưu), gửi null là bỏ chọn, sai định dạng bị từ chối", () => {
  assert.equal(adminPostInputSchema.parse(postInput).authorProfileId, undefined);
  assert.equal(adminPostInputSchema.parse({ ...postInput, authorProfileId: id }).authorProfileId, id);
  assert.equal(adminPostInputSchema.parse({ ...postInput, authorProfileId: null }).authorProfileId, null);
  assert.equal(adminPostInputSchema.safeParse({ ...postInput, authorProfileId: "abc" }).success, false);
});

test("Bài công khai: không có hồ sơ tác giả thì authorProfile là null; có thì đọc được", () => {
  const detail = { id, type: "news", title: "Bài", slug: "bai", excerpt: null, publishedAt: null, createdAt: new Date(), updatedAt: new Date(), cover: null, content: doc, seoTitle: null, seoDescription: null, canonicalUrl: null };
  assert.equal(publicPostDetailSchema.parse(detail).authorProfile, null);
  const profile = { slug: "an", name: "An", jobTitle: "Chuyên viên", profileUrl: null, avatarUrl: "/media/an.jpg", pageEnabled: true };
  assert.deepEqual(publicPostDetailSchema.parse({ ...detail, authorProfile: profile }).authorProfile, profile);
});

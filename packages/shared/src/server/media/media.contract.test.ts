import assert from "node:assert/strict";
import test from "node:test";
import { mediaListQuerySchema, mediaListResponseSchema } from "./media.contract";

test("query media mặc định và chuẩn hóa từ khóa chỉ khi parse", () => {
  assert.deepEqual(mediaListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "", type: "all" });
  const input = { page: "2", pageSize: "5", query: "  ảnh tiếng Việt %_  ", type: "images" };
  assert.deepEqual(mediaListQuerySchema.parse(input), { page: 2, pageSize: 5, query: "ảnh tiếng Việt %_", type: "images" });
  assert.equal(input.query, "  ảnh tiếng Việt %_  ");
});

test("query media từ chối trang/limit/type/trường lạ", () => {
  for (const input of [{ page: 0 }, { page: 1.5 }, { page: "abc" }, { pageSize: 4 }, { pageSize: 101 }, { type: "videos" }, { query: "a".repeat(161) }, { unknownField: "x" }]) {
    assert.equal(mediaListQuerySchema.safeParse(input).success, false);
  }
  // sort là tham số chung: giá trị sai dạng bị bỏ, khóa không có trong danh sách trắng do repository bỏ qua.
  assert.equal(mediaListQuerySchema.parse({ sort: "name; drop" }).sort, undefined);
});

const asset = { id: "11111111-1111-4111-8111-111111111111", originalName: "Ảnh.png", mimeType: "image/png", fileSize: 1, altText: null, caption: null, url: "/media/test.png", version: 0 };
const page = { assets: [asset], page: 1, pageSize: 25, total: 1, totalPages: 1 };
test("response phân trang nhận trang có dữ liệu và trang rỗng", () => {
  assert.equal(mediaListResponseSchema.safeParse(page).success, true);
  assert.equal(mediaListResponseSchema.safeParse({ ...page, assets: [], total: 0 }).success, true);
});

test("response phân trang từ chối asset hoặc metadata phân trang sai", () => {
  for (const input of [{ ...page, page: 0 }, { ...page, pageSize: 101 }, { ...page, total: -1 }, { ...page, totalPages: 0 }, { ...page, assets: null }, { ...page, assets: [{ ...asset, id: "wrong" }] }, { ...page, assets: [{ ...asset, url: "https://example.com" }] }]) {
    assert.equal(mediaListResponseSchema.safeParse(input).success, false);
  }
});

test("response từ chối tổng/trang không nhất quán và ID trùng", () => {
  for (const input of [{ ...page, total: 0 }, { ...page, total: 26, totalPages: 1 }, { ...page, assets: [asset, asset], total: 2 }]) {
    assert.equal(mediaListResponseSchema.safeParse(input).success, false);
  }
  assert.equal(mediaListResponseSchema.safeParse({ ...page, assets: [], page: 2 }).success, true);
});

test("sửa mô tả ảnh bắt buộc gửi phiên bản đang sửa", async () => {
  const { mediaMetadataUpdateSchema } = await import("./media.contract");
  assert.equal(mediaMetadataUpdateSchema.safeParse({ altText: "Ảnh", caption: null }).success, false);
  assert.deepEqual(mediaMetadataUpdateSchema.parse({ altText: " Ảnh ", caption: null, expectedVersion: 2 }), { altText: "Ảnh", caption: null, expectedVersion: 2 });
});

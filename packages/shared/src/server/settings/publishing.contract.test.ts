import assert from "node:assert/strict";
import test from "node:test";
import { publishingConfigSchema } from "./publishing.contract";

const base = {
  siteUrl: null,
  defaultTitle: null,
  defaultDescription: null,
  defaultOgMediaId: null,
  allowSearchIndexing: false,
};

test("URL website chỉ dùng HTTP(S), không chứa thông tin đăng nhập", () => {
  for (const siteUrl of ["ftp://example.com", "file:///tmp/test", "javascript:alert(1)", "https://user@example.com", "https://user:secret@example.com"]) {
    assert.equal(publishingConfigSchema.safeParse({ ...base, siteUrl }).success, false);
  }
  for (const siteUrl of ["https://example.com", "http://localhost:3000", "https://example.com/base?q=1#section"]) {
    assert.equal(publishingConfigSchema.safeParse({ ...base, siteUrl }).success, true);
  }
});

test("cấu hình tối thiểu không tự bật index hoặc yêu cầu domain", () => {
  assert.deepEqual(publishingConfigSchema.parse(base), base);
  assert.equal(publishingConfigSchema.safeParse({ ...base, allowSearchIndexing: "false" }).success, false);
  const { allowSearchIndexing: _flag, ...missing } = base;
  void _flag;
  assert.equal(publishingConfigSchema.safeParse(missing).success, false);
});

test("chuẩn hóa title/description khi submit, không sửa dữ liệu nguồn", () => {
  const input = { ...base, defaultTitle: "  Tiêu đề tiếng Việt  ", defaultDescription: "  Nội dung mô tả  " };
  const result = publishingConfigSchema.parse(input);
  assert.equal(result.defaultTitle, "Tiêu đề tiếng Việt");
  assert.equal(result.defaultDescription, "Nội dung mô tả");
  assert.equal(input.defaultTitle, "  Tiêu đề tiếng Việt  ");
  assert.equal(input.defaultDescription, "  Nội dung mô tả  ");
});

test("giới hạn độ dài SEO và từ chối text chỉ có khoảng trắng", () => {
  for (const [field, limit] of [["defaultTitle", 220], ["defaultDescription", 180]] as const) {
    assert.equal(publishingConfigSchema.safeParse({ ...base, [field]: "a".repeat(limit) }).success, true);
    for (const value of ["a".repeat(limit + 1), "", "   "]) {
      assert.equal(publishingConfigSchema.safeParse({ ...base, [field]: value }).success, false);
    }
  }
});

test("từ chối URL sai, ID media sai và thuộc tính ngoài hợp đồng", () => {
  for (const siteUrl of ["", "/relative", "không phải URL", `https://example.com/${"a".repeat(1000)}`]) {
    assert.equal(publishingConfigSchema.safeParse({ ...base, siteUrl }).success, false);
  }
  assert.equal(publishingConfigSchema.safeParse({ ...base, siteUrl: "https://example.com" }).success, true);
  assert.equal(publishingConfigSchema.safeParse({ ...base, defaultOgMediaId: "khong-phai-uuid" }).success, false);
  assert.equal(publishingConfigSchema.safeParse({ ...base, defaultOgMediaId: "11111111-1111-4111-8111-111111111111" }).success, true);
  assert.equal(publishingConfigSchema.safeParse({ ...base, extra: true }).success, false);
});

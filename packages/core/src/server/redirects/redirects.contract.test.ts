import assert from "node:assert/strict";
import test from "node:test";
import { redirectInputSchema } from "./redirects.contract";
import { assertNoRedirectCycle } from "./redirect-cycle";

const base = { sourcePath: "/a", destinationPath: "/b", statusCode: 301 as const, isEnabled: true };
test("chỉ nhận URL nội bộ an toàn", () => {
  for (const destinationPath of ["//example.com", "/\\example.com", "/a\nb", "/a b", "https://example.com"]) {
    assert.equal(redirectInputSchema.safeParse({ ...base, destinationPath }).success, false);
  }
  assert.equal(redirectInputSchema.safeParse({ ...base, destinationPath: "/b?q=abc#phan-1" }).success, true);
});

test("nguồn phải khớp pathname website, không query/hash hoặc dot segment", () => {
  for (const sourcePath of ["/a?q=1", "/a#phan-1", "/x/../a", "/x/%2e%2e/a", "/tên"]) {
    assert.equal(redirectInputSchema.safeParse({ ...base, sourcePath }).success, false);
  }
  for (const sourcePath of ["/a", "/a/", "/t%C3%AAn"]) {
    assert.equal(redirectInputSchema.safeParse({ ...base, sourcePath }).success, true);
  }
});

test("đích cùng pathname sau chuẩn hóa bị từ chối cả khi có query/hash", () => {
  for (const destinationPath of ["/a?q=1", "/a#phan-1", "/x/../a", "/x/%2e%2e/a"]) {
    assert.equal(redirectInputSchema.safeParse({ ...base, destinationPath }).success, false);
  }
});
test("chặn vòng nhiều bước và đích URL được chuẩn hóa", () => {
  for (const destinationPath of ["/a", "/x/../a?query=1"]) {
    assert.throws(() => assertNoRedirectCycle([{ ...base, id: "b", sourcePath: "/b", destinationPath }], null, base), /vòng lặp/);
  }
});
test("cho phép chuỗi kết thúc và bỏ qua redirect đang tắt", () => {
  assert.doesNotThrow(() => assertNoRedirectCycle([{ ...base, id: "b", sourcePath: "/b", destinationPath: "/c" }], null, base));
  assert.doesNotThrow(() => assertNoRedirectCycle([{ ...base, id: "b", sourcePath: "/b", destinationPath: "/a", isEnabled: false }], null, base));
});
test("sửa bản ghi thay thế cạnh cũ; bật lại phải kiểm vòng lặp", () => {
  assert.doesNotThrow(() => assertNoRedirectCycle([{ ...base, id: "a", destinationPath: "/a" }], "a", base));
  assert.doesNotThrow(() => assertNoRedirectCycle([{ ...base, id: "b", sourcePath: "/b", destinationPath: "/a" }], null, { ...base, isEnabled: false }));
});

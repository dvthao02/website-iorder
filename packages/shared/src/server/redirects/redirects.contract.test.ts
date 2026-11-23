import assert from "node:assert/strict";
import test from "node:test";
import { redirectInputSchema } from "./redirects.contract";
import { assertNoRedirectCycle, resolveRedirectDestination } from "./redirect-cycle";

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

test("chặn chuyển hướng tạo vòng lặp với chuyển hướng có sẵn trong mã (địa chỉ tiếng Việt cũ về địa chỉ tiếng Anh)", () => {
  const values = { ...base, sourcePath: "/privacy-policy", destinationPath: "/chinh-sach-bao-mat" };
  assert.throws(() => assertNoRedirectCycle([], null, values), /vòng lặp.*\/chinh-sach-bao-mat.*\/privacy-policy/);
  assert.throws(() => assertNoRedirectCycle([], null, { ...values, sourcePath: "/news", destinationPath: "/tin-tuc" }), /vòng lặp/);
  // URL viết hoa được website đưa về chữ thường nên cũng tạo vòng.
  assert.throws(() => assertNoRedirectCycle([], null, { ...base, sourcePath: "/bang-gia", destinationPath: "/Bang-Gia" }), /vòng lặp/);
});
test("đích là địa chỉ tiếng Việt cũ nhưng không quay về nguồn thì vẫn hợp lệ; redirect đang tắt không bị kiểm", () => {
  assert.doesNotThrow(() => assertNoRedirectCycle([], null, { ...base, sourcePath: "/trang-cu", destinationPath: "/chinh-sach-bao-mat" }));
  assert.doesNotThrow(() => assertNoRedirectCycle([], null, { ...base, sourcePath: "/privacy-policy", destinationPath: "/chinh-sach-bao-mat", isEnabled: false }));
});
test("đi hết chuỗi chuyển hướng tới đích cuối, kể cả chuyển hướng có sẵn trong mã", () => {
  const rows = [
    { ...base, id: "1", sourcePath: "/b", destinationPath: "/c" },
    { ...base, id: "2", sourcePath: "/c", destinationPath: "/d" },
    { ...base, id: "3", sourcePath: "/x", destinationPath: "/y", isEnabled: false },
    { ...base, id: "4", sourcePath: "/trang-cu", destinationPath: "/chinh-sach-bao-mat" },
  ];
  assert.equal(resolveRedirectDestination(rows, "/b"), "/d");
  assert.equal(resolveRedirectDestination(rows, "/x"), "/x", "redirect đang tắt không được đi theo");
  assert.equal(resolveRedirectDestination(rows, "/chinh-sach-bao-mat"), "/privacy-policy");
  assert.equal(resolveRedirectDestination(rows, "/trang-cu"), "/privacy-policy");
  assert.equal(resolveRedirectDestination(rows, "/b", "1"), "/b", "bỏ qua bản ghi đang sửa");
  assert.equal(resolveRedirectDestination(rows, "/khong-lien-quan?q=1#neo"), "/khong-lien-quan");
});
test("dữ liệu hỏng có vòng lặp không làm treo việc tìm đích", () => {
  const rows = [{ ...base, id: "1", sourcePath: "/a", destinationPath: "/b" }, { ...base, id: "2", sourcePath: "/b", destinationPath: "/a" }];
  assert.ok(["/a", "/b"].includes(resolveRedirectDestination(rows, "/a")));
});

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { publicLeadInputSchema } from "@iorder/shared/server/leads/leads.contract";
import { LeadForm } from "./lead-form";

// Mọi ô có `name` được trình duyệt gửi đi (FormData); ô trống gửi chuỗi rỗng. Dựng payload đúng như vậy rồi kiểm với hợp đồng của Backend,
// để biểu mẫu và API không lệch nhau: từng có lúc API bắt buộc trường mà biểu mẫu không gửi nên mọi liên hệ bị từ chối mà không ai biết.
function submittedFields(html: string) {
  return [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\sname="([^"]+)"/g)].map((match) => match[1]);
}

const render = (needOptions: string[]) => renderToStaticMarkup(<LeadForm description={null} needOptions={needOptions} submitLabel="Gửi thông tin tư vấn" title="Thông tin tư vấn" />);

test("Biểu mẫu liên hệ gửi đúng các trường mà API chấp nhận", () => {
  for (const needOptions of [["POS bán hàng tại quầy", "Quản lý kho"], []]) {
    const names = submittedFields(render(needOptions));
    assert.deepEqual([...names].sort(), ["email", "message", "name", "need", "phone", "website"]);
    const payload = { ...Object.fromEntries(names.map((name) => [name, ""])), name: "Nguyễn Văn A", phone: "0901 234 567" };
    const parsed = publicLeadInputSchema.safeParse(payload);
    assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  }
});

test("Chỉ họ tên và số điện thoại bắt buộc trên biểu mẫu, ô bẫy bot ẩn khỏi người dùng", () => {
  const html = render(["Quản lý kho"]);
  for (const field of ["name", "phone"]) assert.match(html, new RegExp(`<input[^>]*name="${field}"[^>]*required|<input[^>]*required[^>]*name="${field}"`));
  for (const field of ["email", "message", "need"]) assert.doesNotMatch(html, new RegExp(`<(?:input|select|textarea)[^>]*required[^>]*name="${field}"|<(?:input|select|textarea)[^>]*name="${field}"[^>]*required`));
  assert.match(html, /<label aria-hidden="true" class="hidden">Website<input(?=[^>]*tabindex="-1")(?=[^>]*name="website")/);
});

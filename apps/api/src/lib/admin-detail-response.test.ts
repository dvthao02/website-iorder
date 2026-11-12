import assert from "node:assert/strict";
import test from "node:test";
import { adminDetailResponse } from "./admin-detail-response";

const messages = { missing: "Không tìm thấy nội dung.", failed: "Không thể tải nội dung." };
test("detail trả dữ liệu hoặc 404, không nhầm lỗi đọc thành mất nội dung", async () => {
  for (const key of ["post", "offering"] as const) {
    const success = await adminDetailResponse(key, async () => ({ id: "fixture" }), messages);
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { [key]: { id: "fixture" } });
    const missing = await adminDetailResponse(key, async () => undefined, messages);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: { code: "NOT_FOUND", message: messages.missing } });
    const failed = await adminDetailResponse(key, async () => { throw new Error("không được đưa chi tiết này ra ngoài"); }, messages);
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: { code: "INTERNAL_ERROR", message: messages.failed } });
  }
});

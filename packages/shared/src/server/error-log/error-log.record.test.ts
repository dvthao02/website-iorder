import assert from "node:assert/strict";
import test from "node:test";

import { logger, buildLogEntry, setErrorLogSink } from "../shared/logger";
import { currentRequestContext, runWithRequestContext } from "../shared/request-context";
import { errorLogClearRequestSchema, errorLogDetailsSchema, errorLogItemSchema, errorLogListQuerySchema } from "./error-log.contract";
import { buildErrorLogRecord, createErrorLogSink, normalizeForFingerprint, type ErrorLogRecord } from "./error-log.record";

const entryOf = (message: string, fields: Parameters<typeof buildLogEntry>[2] = {}) => buildLogEntry("error", message, fields, "api");
const request = (path: string, id = "req-12345678") => new Request(`http://backend${path}`, { method: "POST", headers: { "x-request-id": id } });

test("Dấu vân tay bỏ id, số và mã request: cùng một lỗi ở các bản ghi khác nhau gom thành một dòng", () => {
  const first = buildErrorLogRecord(entryOf("Lưu tác giả thất bại.", { request: request("/api/v1/admin/authors/3f2b9c1e-1111-4a2b-9c3d-123456789abc", "req-aaaaaaaa"), error: new Error("Lỗi ở dòng 1234") }));
  const second = buildErrorLogRecord(entryOf("Lưu tác giả thất bại.", { request: request("/api/v1/admin/authors/9a8b7c6d-2222-4a2b-9c3d-abcdefabcdef", "req-bbbbbbbb"), error: new Error("Lỗi ở dòng 5678") }));
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(second.requestId, "req-bbbbbbbb");
  const otherMessage = buildErrorLogRecord(entryOf("Xóa tác giả thất bại.", { request: request("/api/v1/admin/authors/3f2b9c1e-1111-4a2b-9c3d-123456789abc"), error: new Error("Lỗi ở dòng 1234") }));
  assert.notEqual(first.fingerprint, otherMessage.fingerprint);
  assert.equal(normalizeForFingerprint("id 3f2b9c1e-1111-4a2b-9c3d-123456789abc, 15 dòng, a1"), "id :id, # dòng, a1");
});

test("Bản ghi giữ nơi xảy ra, lỗi gốc và thông tin kèm theo, đã che khóa nhạy cảm", () => {
  const cause = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint_name: "users_username_unique" });
  const record = buildErrorLogRecord(entryOf("Đổi mật khẩu thất bại.", { request: request("/api/v1/admin/account/password?token=bi-mat"), error: new Error("Failed query", { cause }), password: "khong-duoc-ghi", dataset: "leads" }));
  assert.equal(record.method, "POST");
  assert.equal(record.path, "/api/v1/admin/account/password");
  assert.equal(record.errorName, "Error");
  assert.equal(record.errorMessage, "Failed query");
  assert.equal(record.details.error?.cause?.code, "23505");
  assert.equal(record.details.error?.cause?.constraint_name, "users_username_unique");
  assert.deepEqual(record.details.context, { password: "[ẩn]", dataset: "leads" });
  assert.ok(!JSON.stringify(record).includes("khong-duoc-ghi"));
  assert.ok(!JSON.stringify(record).includes("bi-mat"));
  assert.ok(errorLogDetailsSchema.safeParse(record.details).success);
});

test("Dòng log không có lỗi tuần tự hóa (route chỉ trả 5xx) lấy câu báo lỗi trong phản hồi", () => {
  const record = buildErrorLogRecord(entryOf("Route trả lỗi máy chủ nhưng không ghi chi tiết.", { request: request("/api/v1/admin/consult-form"), status: 500, errorCode: "INTERNAL_ERROR", errorMessage: "Không thể lưu biểu mẫu tư vấn lúc này." }));
  assert.equal(record.errorMessage, "Không thể lưu biểu mẫu tư vấn lúc này.");
  assert.equal(record.details.error, undefined);
  assert.equal(record.details.context.status, 500);
});

test("Sink không chờ ghi, nuốt lỗi ghi và giới hạn số lần ghi mỗi phút", async () => {
  const written: ErrorLogRecord[] = [];
  const reported: unknown[] = [];
  let clock = 1_000_000;
  const sink = createErrorLogSink({ record: async (record) => { if (record.message === "hỏng") throw new Error("database chết"); written.push(record); }, now: () => clock, maxPerMinute: 2, report: (error) => reported.push(error) });
  sink(entryOf("một"));
  sink(entryOf("hỏng"));
  sink(entryOf("ba (vượt trần)"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(written.map((record) => record.message), ["một"]);
  assert.equal(reported.length, 1);
  clock += 60_000;
  sink(entryOf("hai"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(written.map((record) => record.message), ["một", "hai"]);
});

test("logger.error gọi sink đã đặt (mức thấp hơn thì không), mang mã request đang xử lý và đánh dấu request đã có log lỗi", () => {
  const received: Array<Record<string, unknown>> = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => undefined;
  console.warn = () => undefined;
  setErrorLogSink((entry) => { received.push(entry); });
  try {
    const context = { ipAddress: null, userAgent: null, requestId: "req-context-1" } as NonNullable<ReturnType<typeof currentRequestContext>>;
    runWithRequestContext(context, () => {
      logger.warn("chỉ cảnh báo");
      assert.equal(context.errorLogged, undefined);
      logger.error("lỗi nặng", { error: new Error("boom") });
    });
    assert.equal(context.errorLogged, true);
    assert.deepEqual(received.map((entry) => entry.msg), ["lỗi nặng"]);
    assert.equal(received[0]?.requestId, "req-context-1");
    // Sink ném lỗi cũng không làm hỏng việc ghi log.
    setErrorLogSink(() => { throw new Error("sink hỏng"); });
    assert.doesNotThrow(() => logger.error("vẫn ghi được"));
  } finally {
    setErrorLogSink(undefined);
    console.error = originalError;
    console.warn = originalWarn;
  }
});

test("Hợp đồng: yêu cầu xóa chỉ nhận một dòng theo id hoặc toàn bộ; danh sách dùng phân trang chung", () => {
  assert.ok(errorLogClearRequestSchema.safeParse({ mode: "all" }).success);
  assert.ok(errorLogClearRequestSchema.safeParse({ mode: "one", id: "3f2b9c1e-1111-4a2b-9c3d-123456789abc" }).success);
  for (const bad of [{ mode: "one" }, { mode: "one", id: "x" }, { mode: "all", id: "3f2b9c1e-1111-4a2b-9c3d-123456789abc" }, { mode: "older_than", days: 30 }, {}, null]) assert.equal(errorLogClearRequestSchema.safeParse(bad).success, false);
  assert.deepEqual(errorLogListQuerySchema.parse({}), { page: 1, pageSize: 25, query: "" });
  const item = { id: "3f2b9c1e-1111-4a2b-9c3d-123456789abc", message: "m", errorName: null, errorMessage: null, method: null, path: null, requestId: null, occurrences: 3, firstSeenAt: new Date(), lastSeenAt: new Date(), details: { context: {} } };
  assert.ok(errorLogItemSchema.safeParse(item).success);
  assert.equal(errorLogItemSchema.safeParse({ ...item, occurrences: 0 }).success, false);
});

test("Báo lỗi ghi nhật ký ra console không lộ giá trị tham số SQL", async () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: unknown) => { lines.push(String(line)); };
  try {
    const sink = createErrorLogSink({ record: async () => { throw new Error("Failed query: insert into error_logs (message) values ($1)\nparams: bi-mat-123"); } });
    sink(entryOf("lỗi"));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.error = original;
  }
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Không ghi được nhật ký lỗi vào database/);
  assert.ok(!lines[0].includes("bi-mat-123"));
});

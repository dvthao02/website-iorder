// Log có cấu trúc dùng chung cho 3 app. Production in một dòng JSON mỗi sự kiện để `docker compose logs`
// + jq/grep lọc được theo requestId, level, msg; môi trường dev in dạng dễ đọc.
// Không bao giờ ghi giá trị của khóa nhạy cảm, tham số SQL hay query string (có thể chứa dữ liệu khách hàng).

export type LogLevel = "debug" | "info" | "warn" | "error";
type RequestLike = { headers: Headers; method: string; url: string };
export type LogFields = { request?: RequestLike; error?: unknown; [key: string]: unknown };

const levelRank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
export const requestIdHeader = "x-request-id";
const requestIdPattern = /^[A-Za-z0-9._:-]{8,128}$/;
const sensitiveKey = /pass(word)?|secret|token|cookie|authorization|hash|salt|otp|session|credential|api[-_]?key/i;
const maxString = 2000;
const maxDepth = 4;

// Chỉ nhận mã định danh có dạng an toàn (Caddy dùng UUID); giá trị lạ từ client bị thay bằng mã mới.
export function normalizeRequestId(value: string | null | undefined) {
  return value && requestIdPattern.test(value) ? value : null;
}

export function resolveRequestId(headers: Headers) {
  return normalizeRequestId(headers.get(requestIdHeader)) ?? crypto.randomUUID();
}

// Drizzle gắn "params: ..." (giá trị thật của câu lệnh) vào message; cắt bỏ trước khi ghi log.
function stripQueryParams(message: string) {
  const index = message.search(/\n\s*params:/);
  return index === -1 ? message : `${message.slice(0, index)}\nparams: [ẩn]`;
}

function clip(value: string) {
  return value.length > maxString ? `${value.slice(0, maxString)}…(+${value.length - maxString})` : value;
}

const databaseErrorFields = ["code", "severity", "constraint_name", "table_name", "column_name", "routine"] as const;

export function serializeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) return { message: clip(String(error)) };
  const message = clip(stripQueryParams(error.message));
  const frames = (error.stack ?? "").split("\n").filter(line => /^\s+at /.test(line)).slice(0, 12).map(line => line.trim());
  const result: Record<string, unknown> = { name: error.name, message };
  if (frames.length) result.stack = frames;
  const record = error as unknown as Record<string, unknown>;
  for (const field of databaseErrorFields) {
    if (typeof record[field] === "string" || typeof record[field] === "number") result[field] = record[field];
  }
  if ("digest" in record && typeof record.digest === "string") result.digest = record.digest;
  if (error.cause !== undefined && depth < 3) result.cause = serializeError(error.cause, depth + 1);
  return result;
}

export function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return clip(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (depth >= maxDepth) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitizeLogValue(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKey.test(key) ? "[ẩn]" : sanitizeLogValue(item, depth + 1)]));
  }
  return String(value);
}

function requestFields(request: RequestLike) {
  let path = request.url;
  try { path = new URL(request.url, "http://local").pathname; } catch { /* giữ nguyên */ }
  return { requestId: normalizeRequestId(request.headers.get(requestIdHeader)) ?? undefined, method: request.method, path };
}

export function buildLogEntry(level: LogLevel, msg: string, fields: LogFields = {}, service = process.env.SERVICE_NAME ?? "iorder"): Record<string, unknown> & { time: string; level: LogLevel; service: string; msg: string } {
  const { request, error, ...rest } = fields;
  const extra = sanitizeLogValue(rest) as Record<string, unknown>;
  return {
    time: new Date().toISOString(),
    level,
    service,
    msg,
    ...(request ? requestFields(request) : {}),
    ...extra,
    ...(error !== undefined ? { err: serializeError(error) } : {}),
  };
}

function minimumLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  return configured && configured in levelRank ? configured : process.env.NODE_ENV === "production" ? "info" : "debug";
}

function jsonFormatEnabled() {
  return process.env.LOG_FORMAT ? process.env.LOG_FORMAT === "json" : process.env.NODE_ENV === "production";
}

function formatReadable(entry: ReturnType<typeof buildLogEntry>) {
  const { time, level, service, msg, err, ...rest } = entry;
  const pairs = Object.entries(rest).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
  const head = `${time.slice(11, 19)} ${level.toUpperCase().padEnd(5)} [${service}] ${msg}${pairs.length ? ` ${pairs.join(" ")}` : ""}`;
  if (!err) return head;
  type Serialized = { name?: string; message?: string; code?: string; stack?: string[]; cause?: Serialized };
  const error = err as Serialized;
  const lines = [head, `  ${error.name ?? "Error"}: ${error.message ?? ""}`, ...(error.stack ?? []).map(line => `    ${line}`)];
  for (let cause = error.cause; cause; cause = cause.cause) lines.push(`  ← ${cause.name ?? "Error"}: ${cause.message ?? ""}${cause.code ? ` (code=${cause.code})` : ""}`);
  return lines.join("\n");
}

function write(level: LogLevel, msg: string, fields?: LogFields) {
  if (levelRank[level] < levelRank[minimumLevel()]) return;
  try {
    const entry = buildLogEntry(level, msg, fields);
    const line = jsonFormatEnabled() ? JSON.stringify(entry) : formatReadable(entry);
    if (level === "error" || level === "warn") console.error(line);
    else console.log(line);
  } catch {
    // Log không bao giờ được làm hỏng request.
    console.error(JSON.stringify({ time: new Date().toISOString(), level, msg, logFailure: true }));
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => write("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
};

type RequestErrorInfo = { path: string; method: string; headers: Record<string, string | string[] | undefined> };
type RequestErrorContext = { routePath?: string; routeType?: string; renderSource?: string };

// Dùng trong instrumentation.ts (onRequestError) của từng app: lỗi chưa được route tự xử lý.
export function logUnhandledRequestError(error: unknown, request: RequestErrorInfo, context: RequestErrorContext) {
  const header = request.headers[requestIdHeader];
  logger.error("Lỗi chưa xử lý khi phục vụ request.", {
    error,
    requestId: normalizeRequestId(Array.isArray(header) ? header[0] : header) ?? undefined,
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
}

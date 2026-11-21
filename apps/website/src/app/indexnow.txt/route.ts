import { resolveIndexNowKey } from "@iorder/shared/server/publishing/indexnow";

export const dynamic = "force-dynamic";

// Tệp khóa IndexNow: công cụ tìm kiếm đọc tệp này để xác minh website là của người gửi URL. Khóa vốn công khai theo giao thức.
// Tắt (INDEXNOW_DISABLED) hoặc chưa có secret thì trả 404 (backend cũng không gửi gì).
export function GET() {
  const key = resolveIndexNowKey(process.env);
  return key ? new Response(key, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } }) : new Response("Not found", { status: 404 });
}

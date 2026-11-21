import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublishingConfig } from "@/lib/backend";
import { ogImageSize, ogTitle, ogTitleFontSize, verifyOgTitle } from "@/lib/og-image";

export const dynamic = "force-dynamic";

// Font có đủ dấu tiếng Việt (Be Vietnam Pro, giấy phép OFL; xem public/fonts). Đọc một lần cho cả tiến trình.
const fontPromise = readFile(join(process.cwd(), "public/fonts/BeVietnamPro-Bold.ttf"));

async function siteHost() {
  try {
    const { siteUrl } = await getPublishingConfig();
    return siteUrl ? new URL(siteUrl).host : null;
  } catch { return null; }
}

// Ảnh chia sẻ mặc định 1200×630: tên trang trên nền thương hiệu. Chỉ phục vụ địa chỉ do website tự ký (lib/og-image.ts).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawTitle = params.get("title") ?? "";
  if (!rawTitle.trim() || !verifyOgTitle(ogTitle(rawTitle), params.get("sig"))) return new Response("Not found", { status: 404 });
  const title = ogTitle(rawTitle);
  const [font, host] = await Promise.all([fontPromise, siteHost()]);
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "64px 72px", background: "linear-gradient(135deg, #f4f8ff 0%, #dbe9ff 100%)", fontFamily: "BeVietnamPro", color: "#0d1b33" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 44, color: "#1570e0" }}>
          <div style={{ display: "flex", width: 14, height: 44, marginRight: 18, borderRadius: 7, background: "#1570e0" }} />
          iOrder
        </div>
        <div style={{ display: "flex", fontSize: ogTitleFontSize(title), lineHeight: 1.18, letterSpacing: "-0.01em" }}>{title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, color: "#5b6b82" }}>
          <span>{host ?? "iOrder"}</span>
          <div style={{ display: "flex", width: 160, height: 10, borderRadius: 5, background: "#1570e0" }} />
        </div>
      </div>
    ),
    // Địa chỉ đã ký theo tiêu đề nên nội dung không đổi: trình duyệt và máy chủ chia sẻ được giữ lâu.
    { ...ogImageSize, fonts: [{ name: "BeVietnamPro", data: font, weight: 700, style: "normal" }], headers: { "cache-control": "public, max-age=31536000, immutable" } },
  );
}

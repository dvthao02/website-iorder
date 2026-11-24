import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@iorder/shared/db/client";
import { mediaAssets } from "@iorder/shared/db/schema";
import { getStoredObject } from "@iorder/shared/server/media/storage";

export const runtime = "nodejs";

type MediaRouteProps = {
  params: Promise<{ storageKey: string[] }>;
};

function contentDisposition(mimeType: string, originalName: string) {
  const disposition = mimeType.startsWith("image/") ? "inline" : "attachment";
  // Giá trị header chỉ được chứa ký tự Latin-1: tên tiếng Việt (đ, ơ, ư…) làm `new Response` ném lỗi và ảnh không hiện.
  // `filename` là bản ASCII dự phòng, `filename*` mang tên gốc đã mã hóa (RFC 5987).
  const fallback = originalName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\x20-\x7e]|["\\]/g, "_");

  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(originalName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

export async function GET(_: Request, { params }: MediaRouteProps) {
  const { storageKey: segments } = await params;

  if (segments.length === 0 || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    notFound();
  }

  const storageKey = segments.join("/");
  const [asset] = await getDb()
    .select({ mimeType: mediaAssets.mimeType, originalName: mediaAssets.originalName })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.storageKey, storageKey), isNull(mediaAssets.deletedAt)))
    .limit(1);

  if (!asset) {
    notFound();
  }

  try {
    const object = await getStoredObject(storageKey);

    if (!object.Body) {
      notFound();
    }

    return new Response(object.Body.transformToWebStream(), {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": contentDisposition(asset.mimeType, asset.originalName),
        "content-type": asset.mimeType,
        // Không cho trình duyệt đoán lại loại tệp. SVG là XML: thêm sandbox để script (nếu lọt qua bước kiểm tra lúc tải lên) không chạy khi
        // mở thẳng đường dẫn; nhúng bằng thẻ img (cách website dùng) không bị ảnh hưởng.
        "x-content-type-options": "nosniff",
        ...(asset.mimeType === "image/svg+xml" ? { "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      },
    });
  } catch (error: unknown) {
    const status = typeof error === "object" && error !== null && "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;

    if (status === 404) {
      notFound();
    }

    throw error;
  }
}

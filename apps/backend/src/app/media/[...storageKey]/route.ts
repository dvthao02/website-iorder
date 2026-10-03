import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@iorder/core/db/client";
import { mediaAssets } from "@iorder/core/db/schema";
import { getStoredObject } from "@iorder/core/server/media/storage";

export const runtime = "nodejs";

type MediaRouteProps = {
  params: Promise<{ storageKey: string[] }>;
};

function contentDisposition(mimeType: string, originalName: string) {
  const disposition = mimeType.startsWith("image/") ? "inline" : "attachment";
  const fileName = originalName.replace(/[\r\n"]/g, "_");

  return `${disposition}; filename="${fileName}"`;
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
    .where(eq(mediaAssets.storageKey, storageKey))
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

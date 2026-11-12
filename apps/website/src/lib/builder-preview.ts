import { cache } from "react";
import { headers } from "next/headers";
import { builderPreviewReadSchema } from "@iorder/shared/server/publishing/builder-preview.contract";

export const builderPreviewHeader = "x-iorder-builder-preview";
export async function fetchBuilderPreview(token: string) {
  const backend = (process.env.BACKEND_URL ?? "http://localhost:3002").replace(/\/$/, "");
  const response = await fetch(`${backend}/api/v1/public/builder-preview?token=${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) return undefined;
  const body = await response.json() as { preview?: unknown };
  const parsed = builderPreviewReadSchema.safeParse(body.preview);
  return parsed.success && parsed.data.expiresAt.getTime() > Date.now() ? parsed.data : undefined;
}
export const getBuilderPreviewContext = cache(async () => {
  const token = (await headers()).get(builderPreviewHeader);
  return token ? fetchBuilderPreview(token) : undefined;
});

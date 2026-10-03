import { mediaAssetSchema, mediaMetadataSchema, mediaUsageSchema } from "./media.contract";
import { randomUUID } from "node:crypto";
import { collectMediaUsage, findMediaAsset, insertUploadedMedia, listMediaAssets, updateMediaMetadata } from "./media.repository";
import { z } from "zod";
import { ensureMediaBucket, mediaPath, putStoredObject, removeStoredObject } from "./storage";

export class InvalidMediaError extends Error {}

export async function validateCoverMedia(id: string | null | undefined) {
  if (!id) return;
  const asset = await findMediaAsset(id);
  if (!asset || !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)) {
    throw new z.ZodError([{ code: "custom", path: ["coverMediaId"], message: "Ảnh bìa không tồn tại hoặc không đúng định dạng ảnh." }]);
  }
}

export async function uploadAdminMedia(file: File, userId: string) {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new InvalidMediaError("Tệp phải có dữ liệu và không vượt quá 20 MB.");
  const body = Buffer.from(await file.arrayBuffer());
  let mimeType: string;
  let extension: string;
  if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { mimeType = "image/png"; extension = "png"; }
  else if (body[0] === 255 && body[1] === 216 && body[2] === 255) { mimeType = "image/jpeg"; extension = "jpg"; }
  else if (body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP") { mimeType = "image/webp"; extension = "webp"; }
  else if (body.toString("ascii", 0, 5) === "%PDF-") { mimeType = "application/pdf"; extension = "pdf"; }
  else if (body[0] === 80 && body[1] === 75 && body[2] === 3 && body[3] === 4) { mimeType = "application/zip"; extension = "zip"; }
  else throw new InvalidMediaError("Chỉ hỗ trợ ảnh PNG, JPEG, WebP và tài liệu PDF, ZIP có định dạng hợp lệ.");
  const storageKey = `uploads/${randomUUID()}.${extension}`;
  const originalName = file.name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, "_").slice(0, 255) || `tep.${extension}`;
  await ensureMediaBucket();
  await putStoredObject({ storageKey, body, mimeType });
  try {
    return serialize(await insertUploadedMedia({ storageKey, originalName, mimeType, fileSize: body.length, uploadedBy: userId }, userId));
  } catch (error) {
    try { await removeStoredObject(storageKey); } catch { console.error("Không thể thu hồi tệp của lần tải lên thất bại."); }
    throw error;
  }
}

function serialize(row: Awaited<ReturnType<typeof listMediaAssets>>[number]) {
  return mediaAssetSchema.parse({ id: row.id, originalName: row.originalName, mimeType: row.mimeType,
    fileSize: row.fileSize, altText: row.altText, caption: row.caption, url: mediaPath(row.storageKey) });
}

export async function getAdminMedia() {
  return (await listMediaAssets()).map(serialize);
}

export async function getMediaById(id: string) {
  const asset = await findMediaAsset(id);
  return asset ? serialize(asset) : null;
}

export async function editAdminMedia(id: string, input: unknown, userId: string) {
  const row = await updateMediaMetadata(id, mediaMetadataSchema.parse(input), userId);
  return row ? serialize(row) : undefined;
}

export async function getAdminMediaUsage(id: string) {
  if (!await findMediaAsset(id)) return undefined;
  const items = await collectMediaUsage(id);
  return mediaUsageSchema.parse({ items, total: items.length, canDelete: items.length === 0 });
}

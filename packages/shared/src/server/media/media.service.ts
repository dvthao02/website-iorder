import { mediaAssetSchema, mediaListQuerySchema, mediaMetadataUpdateSchema, mediaUsageSchema } from "./media.contract";
import { randomUUID } from "node:crypto";
import { collectMediaUsage, findMediaAsset, insertUploadedMedia, listMediaAssets, listMediaAssetsPage, queueMediaAssetDeletion, updateMediaMetadata } from "./media.repository";
import { z } from "zod";
import { ensureMediaBucket, mediaPath, putStoredObject, removeStoredObject } from "./storage";
import { logger } from "../shared/logger";
import { fetchRemoteFile, parseExternalHttpsUrl, RemoteFileError } from "../shared/remote-file";
import { readImageDimensions } from "./image-dimensions";

export class InvalidMediaError extends Error {}
export class MediaInUseError extends Error {
  constructor() { super("Không thể xóa tệp đang được sử dụng trong nội dung CMS."); }
}

type MediaDeletionRepository = Pick<typeof import("./media.repository"), "collectMediaUsage" | "findMediaAsset" | "queueMediaAssetDeletion">;

export function createMediaDeletionService(repository: MediaDeletionRepository) {
  async function deleteAdminMedia(id: string, userId: string) {
    if (!z.string().uuid().safeParse(id).success) return undefined;
    const asset = await repository.findMediaAsset(id);
    if (!asset) return undefined;
    if ((await repository.collectMediaUsage(id)).length > 0) throw new MediaInUseError();
    const queued = await repository.queueMediaAssetDeletion(id, userId);
    return queued?.id;
  }
  return { deleteAdminMedia };
}

const mediaDeletionService = createMediaDeletionService({ collectMediaUsage, findMediaAsset, queueMediaAssetDeletion });

export async function validateCoverMedia(id: string | null | undefined) {
  if (!id) return;
  const asset = await findMediaAsset(id);
  if (!asset || !["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType)) {
    throw new z.ZodError([{ code: "custom", path: ["coverMediaId"], message: "Ảnh bìa không tồn tại hoặc không đúng định dạng ảnh." }]);
  }
}

export async function validateSeoMedia(seo: import("../shared/content-seo").ContentSeo | undefined) {
  if (!seo) return;
  const references: Array<{ id: string | null | undefined; path: Array<string | number> }> = [
    { id: seo.openGraph?.imageMediaId, path: ["seo", "openGraph", "imageMediaId"] },
    { id: seo.twitter?.imageMediaId, path: ["seo", "twitter", "imageMediaId"] },
    ...(seo.structuredData ?? []).map((document, index) => ({ id: document.imageMediaId, path: ["seo", "structuredData", index, "imageMediaId"] })),
  ];
  for (const reference of references) {
    if (!reference.id) continue;
    const asset = await findMediaAsset(reference.id);
    if (!asset || !asset.mimeType.startsWith("image/")) throw new z.ZodError([{ code: "custom", path: reference.path, message: "Ảnh SEO không tồn tại hoặc không phải định dạng ảnh." }]);
  }
}

/** Nhận dạng tệp bằng nội dung (không tin đuôi tệp hay Content-Type do trình duyệt gửi). null: định dạng không hỗ trợ. */
export function detectUploadedFileType(body: Buffer): { mimeType: string; extension: string } | null {
  if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mimeType: "image/png", extension: "png" };
  if (body[0] === 255 && body[1] === 216 && body[2] === 255) return { mimeType: "image/jpeg", extension: "jpg" };
  if (body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  if (body.toString("ascii", 0, 5) === "%PDF-") return { mimeType: "application/pdf", extension: "pdf" };
  if (body[0] === 80 && body[1] === 75 && body[2] === 3 && body[3] === 4) return { mimeType: "application/zip", extension: "zip" };
  return null;
}

export type MediaUploadOptions = {
  /** Thư mục trong bucket; mặc định "uploads". */
  folder?: string;
  maxBytes?: number;
  /** Chỉ nhận PNG/JPEG/WebP (ảnh đại diện không cần PDF/ZIP). */
  imagesOnly?: boolean;
};

/** Ảnh đại diện của tài khoản CMS: chỉ ảnh, tối đa 2 MB, gom vào thư mục riêng để phân biệt với nội dung website. */
export const avatarUploadOptions = { folder: "avatars", maxBytes: 2 * 1024 * 1024, imagesOnly: true } as const satisfies MediaUploadOptions;

export async function uploadAdminMedia(file: File, userId: string, options: MediaUploadOptions = {}) {
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
  if (!file.size || file.size > maxBytes) throw new InvalidMediaError(`${options.imagesOnly ? "Ảnh" : "Tệp"} phải có dữ liệu và không vượt quá ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  const body = Buffer.from(await file.arrayBuffer());
  const detected = detectUploadedFileType(body);
  if (!detected || (options.imagesOnly && !detected.mimeType.startsWith("image/"))) {
    throw new InvalidMediaError(options.imagesOnly ? "Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP có định dạng hợp lệ." : "Chỉ hỗ trợ ảnh PNG, JPEG, WebP và tài liệu PDF, ZIP có định dạng hợp lệ.");
  }
  const { mimeType, extension } = detected;
  const storageKey = `${options.folder ?? "uploads"}/${randomUUID()}.${extension}`;
  const originalName = file.name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, "_").slice(0, 255) || `tep.${extension}`;
  // Ghi rộng × cao của ảnh để website giữ chỗ đúng tỉ lệ; đọc không được thì để trống, không chặn tải lên.
  const dimensions = mimeType.startsWith("image/") ? readImageDimensions(body, mimeType) : null;
  await ensureMediaBucket();
  await putStoredObject({ storageKey, body, mimeType });
  try {
    return serialize(await insertUploadedMedia({ storageKey, originalName, mimeType, fileSize: body.length, width: dimensions?.width ?? null, height: dimensions?.height ?? null, uploadedBy: userId }, userId));
  } catch (error) {
    try { await removeStoredObject(storageKey); } catch (cleanupError) { logger.error("Không thể thu hồi tệp của lần tải lên thất bại.", { storageKey, error: cleanupError }); }
    throw error;
  }
}

const maxUploadBytes = 20 * 1024 * 1024;

export type MediaImportResult =
  | { result: "imported"; asset: Awaited<ReturnType<typeof uploadAdminMedia>> }
  // Không lưu được vào thư viện (quá lớn, loại tệp không hỗ trợ như .exe/.msi, không tải được…): không phải lỗi, người dùng giữ link gốc.
  | { result: "kept_as_link"; reason: string; message: string };

/**
 * Tải một tệp từ link https vào thư viện media (tự tải về khi nhập link tệp cài đặt). Dùng chính quy trình kiểm tra của `uploadAdminMedia`
 * (nhận dạng bằng nội dung tệp, tối đa 20 MB, chỉ ảnh/PDF/ZIP) nên không mở thêm loại tệp nào. Link sai định dạng → InvalidMediaError;
 * tải hoặc lưu không được vì lý do dự kiến → trả `kept_as_link` kèm lý do để giao diện giữ nguyên dạng link.
 */
export async function importAdminMediaFromUrl(rawUrl: string, userId: string): Promise<MediaImportResult> {
  let url: URL;
  try { url = parseExternalHttpsUrl(rawUrl); } catch (error) { throw new InvalidMediaError(error instanceof Error ? error.message : "Link không hợp lệ."); }
  let remote: Awaited<ReturnType<typeof fetchRemoteFile>>;
  try {
    remote = await fetchRemoteFile(url.toString(), { maxBytes: maxUploadBytes });
  } catch (error) {
    if (!(error instanceof RemoteFileError)) throw error;
    return { result: "kept_as_link", reason: error.code, message: error.code === "too_large" ? "Tệp lớn hơn 20 MB nên không lưu vào thư viện được." : error.message };
  }
  const name = remote.fileName ?? "tep-tai-ve";
  try {
    return { result: "imported", asset: await uploadAdminMedia(new File([new Uint8Array(remote.body)], name, remote.contentType ? { type: remote.contentType } : undefined), userId) };
  } catch (error) {
    if (error instanceof InvalidMediaError) return { result: "kept_as_link", reason: "unsupported_type", message: error.message };
    throw error;
  }
}

function serialize(row: Awaited<ReturnType<typeof listMediaAssets>>[number]) {
  return mediaAssetSchema.parse({ id: row.id, originalName: row.originalName, mimeType: row.mimeType,
    fileSize: row.fileSize, width: row.width, height: row.height, altText: row.altText, caption: row.caption, url: mediaPath(row.storageKey), version: row.version });
}

export async function getAdminMedia() {
  return (await listMediaAssets()).map(serialize);
}

export async function getAdminMediaPage(input: unknown) {
  const page = await listMediaAssetsPage(mediaListQuerySchema.parse(input));
  return { ...page, items: page.items.map(serialize) };
}

export async function getMediaById(id: string) {
  const asset = await findMediaAsset(id);
  return asset ? serialize(asset) : null;
}

export async function editAdminMedia(id: string, input: unknown, userId: string) {
  const { expectedVersion, ...metadata } = mediaMetadataUpdateSchema.parse(input);
  const row = await updateMediaMetadata(id, metadata, userId, expectedVersion);
  return row ? serialize(row) : undefined;
}

export async function getAdminMediaUsage(id: string) {
  if (!await findMediaAsset(id)) return undefined;
  const items = await collectMediaUsage(id);
  return mediaUsageSchema.parse({ items, total: items.length, canDelete: items.length === 0 });
}

export const deleteAdminMedia = mediaDeletionService.deleteAdminMedia;

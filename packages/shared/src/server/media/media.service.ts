import { mediaAssetSchema, mediaListQuerySchema, mediaMetadataUpdateSchema, mediaUsageSchema } from "./media.contract";
import { randomUUID } from "node:crypto";
import { collectMediaUsage, findMediaAsset, insertUploadedMedia, listMediaAssets, listMediaAssetsPage, queueMediaAssetDeletion, updateMediaMetadata } from "./media.repository";
import { z } from "zod";
import { ensureMediaBucket, mediaPath, putStoredObject, removeStoredObject } from "./storage";
import { logger } from "../shared/logger";
import { fetchRemoteFile, parseExternalHttpsUrl, RemoteFileError } from "../shared/remote-file";
import { readImageDimensions } from "./image-dimensions";
import { documentMediaFormats, imageMediaFormats, isImageMediaType, isSocialImageMediaType, officeMediaTypes, socialImageMediaFormats } from "./media-types";

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
  if (!asset || !isSocialImageMediaType(asset.mimeType)) {
    throw new z.ZodError([{ code: "custom", path: ["coverMediaId"], message: "Ảnh bìa không tồn tại hoặc không đúng định dạng ảnh." }]);
  }
}

/** Ảnh dùng trên website (logo, ảnh khối…): mọi định dạng ảnh web, kể cả SVG/GIF/AVIF. Ảnh bìa và ảnh chia sẻ dùng validateCoverMedia (chỉ PNG/JPEG/WebP). */
export async function validateImageMedia(id: string | null | undefined, path: Array<string | number> = ["logoMediaId"]) {
  if (!id) return;
  const asset = await findMediaAsset(id);
  if (!asset || !isImageMediaType(asset.mimeType)) {
    throw new z.ZodError([{ code: "custom", path, message: `Ảnh không tồn tại hoặc không đúng định dạng (${imageMediaFormats}).` }]);
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
    if (!asset || !isSocialImageMediaType(asset.mimeType)) throw new z.ZodError([{ code: "custom", path: reference.path, message: "Ảnh SEO không tồn tại hoặc không phải định dạng ảnh." }]);
  }
}

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const rarSignature = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]); // "Rar!" 1A 07, theo sau là 00 (RAR 4) hoặc 01 00 (RAR 5)
const sevenZipSignature = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);

/** Tệp ZIP; tài liệu Office (.docx, .xlsx, .pptx) cũng là ZIP nên nhận ra qua tên các phần bên trong. */
function detectZipFamily(body: Buffer) {
  if (body.includes("[Content_Types].xml")) {
    if (body.includes("word/document.xml")) return { mimeType: officeMediaTypes.docx, extension: "docx" };
    if (body.includes("xl/workbook.xml")) return { mimeType: officeMediaTypes.xlsx, extension: "xlsx" };
    if (body.includes("ppt/presentation.xml")) return { mimeType: officeMediaTypes.pptx, extension: "pptx" };
  }
  return { mimeType: "application/zip", extension: "zip" };
}

/** SVG là văn bản XML: nhận ra bằng thẻ <svg> ở đầu tệp (sau khai báo xml, chú thích và doctype nếu có). */
function looksLikeSvg(body: Buffer) {
  const head = body.toString("utf8", 0, Math.min(body.length, 2048)).replace(/^\uFEFF/, "");
  return /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE\s+svg[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head);
}

/**
 * Lý do một SVG không an toàn để lưu (null = an toàn). SVG là XML có thể chứa script, thuộc tính sự kiện, liên kết ngoài hoặc khai báo
 * thực thể; từ chối thay vì tự làm sạch để người dùng xuất lại tệp gốc. Lớp bảo vệ thứ hai: route /media phục vụ SVG kèm CSP sandbox.
 */
export function unsafeSvgReason(body: Buffer): string | null {
  const text = body.toString("utf8");
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(text)) return "khai báo thực thể";
  if (/<\s*(script|foreignObject|iframe|embed|object|link|meta|base)\b/i.test(text)) return "thẻ script hoặc nhúng nội dung";
  if (/<[^>]*\son[a-z]+\s*=/i.test(text)) return "thuộc tính sự kiện (onclick, onload…)";
  if (/javascript\s*:|data\s*:\s*text\/html/i.test(text)) return "liên kết javascript";
  if (/(?:href|src)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(text) || /@import|url\(\s*["']?\s*(?:https?:)?\/\//i.test(text)) return "liên kết tới nội dung ngoài";
  return null;
}

/** Nhận dạng tệp bằng nội dung (không tin đuôi tệp hay Content-Type do trình duyệt gửi). null: định dạng không hỗ trợ. */
export function detectUploadedFileType(body: Buffer): { mimeType: string; extension: string } | null {
  if (body.subarray(0, 8).equals(pngSignature)) return { mimeType: "image/png", extension: "png" };
  if (body[0] === 255 && body[1] === 216 && body[2] === 255) return { mimeType: "image/jpeg", extension: "jpg" };
  if (body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  const head = body.toString("ascii", 0, 12);
  if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) return { mimeType: "image/gif", extension: "gif" };
  if (head.slice(4, 8) === "ftyp" && /^avi[fs]$/.test(head.slice(8, 12))) return { mimeType: "image/avif", extension: "avif" };
  if (head.startsWith("%PDF-")) return { mimeType: "application/pdf", extension: "pdf" };
  if (body[0] === 80 && body[1] === 75 && body[2] === 3 && body[3] === 4) return detectZipFamily(body);
  if (body.subarray(0, 6).equals(rarSignature) && (body[6] === 0 || body[6] === 1)) return { mimeType: "application/vnd.rar", extension: "rar" };
  if (body.subarray(0, 6).equals(sevenZipSignature)) return { mimeType: "application/x-7z-compressed", extension: "7z" };
  if (body[0] === 0x1f && body[1] === 0x8b && body[2] === 8) return { mimeType: "application/gzip", extension: "gz" };
  if (looksLikeSvg(body)) return { mimeType: "image/svg+xml", extension: "svg" };
  return null;
}

export type MediaUploadOptions = {
  /** Thư mục trong bucket; mặc định "uploads". */
  folder?: string;
  maxBytes?: number;
  /** Chỉ nhận PNG/JPEG/WebP (ảnh đại diện: không cần tệp khác, SVG/GIF/AVIF không hợp làm ảnh đại diện). */
  imagesOnly?: boolean;
};

/** Ảnh đại diện của tài khoản CMS: chỉ ảnh, tối đa 2 MB, gom vào thư mục riêng để phân biệt với nội dung website. */
export const avatarUploadOptions = { folder: "avatars", maxBytes: 2 * 1024 * 1024, imagesOnly: true } as const satisfies MediaUploadOptions;

export async function uploadAdminMedia(file: File, userId: string, options: MediaUploadOptions = {}) {
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
  if (!file.size || file.size > maxBytes) throw new InvalidMediaError(`${options.imagesOnly ? "Ảnh" : "Tệp"} phải có dữ liệu và không vượt quá ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  const body = Buffer.from(await file.arrayBuffer());
  const detected = detectUploadedFileType(body);
  if (!detected || (options.imagesOnly && !isSocialImageMediaType(detected.mimeType))) {
    throw new InvalidMediaError(options.imagesOnly ? `Chỉ hỗ trợ ảnh ${socialImageMediaFormats} có định dạng hợp lệ.` : `Chỉ hỗ trợ ảnh ${imageMediaFormats} và tệp ${documentMediaFormats} có định dạng hợp lệ.`);
  }
  if (detected.mimeType === "image/svg+xml") {
    const reason = unsafeSvgReason(body);
    if (reason) throw new InvalidMediaError(`SVG có ${reason} nên không tải lên được (có thể chạy mã trong trình duyệt). Hãy xuất lại SVG không có script hoặc liên kết ngoài.`);
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
 * (nhận dạng bằng nội dung tệp, tối đa 20 MB, chỉ ảnh, PDF, tệp nén và tài liệu Office) nên không mở thêm loại tệp nào (như .exe). Link sai định dạng → InvalidMediaError;
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

import "dotenv/config";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../packages/core/src/db/client";
import { auditLogs, mediaAssets, offeringRevisions, offerings, supportDownloads, users } from "../packages/core/src/db/schema";
import { ensureMediaBucket, hasStoredObject, putStoredObject } from "../packages/core/src/server/media/storage";

const v1BaseUrl = "https://iwork.vn";
const offeringTypes = ["software", "solution", "service"] as const;
const maximumImportSize = 25 * 1024 * 1024;

const v1OfferingSchema = z.object({
  type: z.enum(offeringTypes),
  slug: z.string().trim().min(1).max(180),
  coverUrl: z.string().url().nullable(),
}).passthrough();

const v1OfferingResponseSchema = z.object({ items: z.array(v1OfferingSchema) }).strict();

const v1DownloadSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(220),
  description: z.string().nullable(),
  meta: z.string().nullable(),
  icon: z.string().trim().min(1).max(60),
  fileUrl: z.string().url().nullable(),
  fileName: z.string().trim().min(1).max(255).nullable(),
  sortOrder: z.number().int().min(0),
  isEnabled: z.boolean(),
}).passthrough();

const v1DownloadResponseSchema = z.object({ items: z.array(v1DownloadSchema) }).strict();

type ImportedAsset = {
  id: string;
  originalName: string;
  storageKey: string;
};

function secureSourceUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.protocol = "https:";

  return url.toString();
}

function extensionFromUrl(sourceUrl: string) {
  const path = new URL(sourceUrl).pathname;
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();

  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : "";
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function pngDimensions(bytes: Uint8Array, mimeType: string) {
  if (mimeType !== "image/png" || bytes.length < 24) {
    return {};
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function fetchV1Json(path: string) {
  const response = await fetch(`${v1BaseUrl}${path}`, { signal: AbortSignal.timeout(15_000) });

  if (!response.ok) {
    throw new Error(`Không thể lấy dữ liệu V1 tại ${path} (HTTP ${response.status}).`);
  }

  return response.json();
}

async function importAsset({ authorId, storageKey, originalName, sourceUrl }: { authorId: string; storageKey: string; originalName: string; sourceUrl: string }): Promise<ImportedAsset> {
  const db = getDb();
  const [existing] = await db
    .select({ id: mediaAssets.id, originalName: mediaAssets.originalName, storageKey: mediaAssets.storageKey })
    .from(mediaAssets)
    .where(eq(mediaAssets.storageKey, storageKey))
    .limit(1);

  if (existing && await hasStoredObject(storageKey)) {
    return existing;
  }

  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });

  if (!response.ok) {
    throw new Error(`Không thể tải tệp nguồn (HTTP ${response.status}).`);
  }

  const fileSize = Number(response.headers.get("content-length") ?? 0);
  if (fileSize > maximumImportSize) {
    throw new Error("Tệp nguồn vượt quá giới hạn import 25 MB.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > maximumImportSize) {
    throw new Error("Tệp nguồn rỗng hoặc vượt quá giới hạn import 25 MB.");
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  await putStoredObject({ storageKey, body: bytes, mimeType });

  if (existing) {
    return existing;
  }

  const dimensions = pngDimensions(bytes, mimeType);
  const [created] = await db.transaction(async (tx) => {
    const [racedAsset] = await tx
      .select({ id: mediaAssets.id, originalName: mediaAssets.originalName, storageKey: mediaAssets.storageKey })
      .from(mediaAssets)
      .where(eq(mediaAssets.storageKey, storageKey))
      .limit(1);

    if (racedAsset) {
      return [racedAsset];
    }

    const [asset] = await tx
      .insert(mediaAssets)
      .values({
        uploadedBy: authorId,
        storageKey,
        originalName,
        mimeType,
        fileSize: bytes.byteLength,
        ...dimensions,
      })
      .returning({ id: mediaAssets.id, originalName: mediaAssets.originalName, storageKey: mediaAssets.storageKey });

    if (!asset) {
      throw new Error("Không thể lưu metadata tệp import.");
    }

    await tx.insert(auditLogs).values({
      userId: authorId,
      action: "media.import_v1",
      entityType: "media_asset",
      entityId: asset.id,
      afterData: { source: "iwork.vn", sourceUrl, storageKey, originalName, mimeType, fileSize: bytes.byteLength },
    });

    return [asset];
  });

  if (!created) {
    throw new Error("Không thể xác nhận metadata tệp import.");
  }

  return created;
}

async function attachOfferingCover({ authorId, type, slug, mediaId }: { authorId: string; type: z.infer<typeof v1OfferingSchema>["type"]; slug: string; mediaId: string }) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [offering] = await tx
      .select()
      .from(offerings)
      .where(and(eq(offerings.type, type), eq(offerings.slug, slug), isNull(offerings.deletedAt)))
      .limit(1);

    if (!offering) {
      throw new Error(`Không tìm thấy Offering V2 cho ${type}/${slug}.`);
    }

    if (offering.coverMediaId) {
      return false;
    }

    const versionNumber = offering.draftVersion + 1;
    const snapshot = {
      source: "iwork.vn",
      coverMediaId: mediaId,
      type: offering.type,
      title: offering.title,
      slug: offering.slug,
      summary: offering.summary,
      content: offering.content,
      icon: offering.icon,
      sortOrder: offering.sortOrder,
      isFeatured: offering.isFeatured,
      seoTitle: offering.seoTitle,
      seoDescription: offering.seoDescription,
      canonicalUrl: offering.canonicalUrl,
      publishedAt: offering.publishedAt?.toISOString() ?? null,
    };

    await tx.update(offerings).set({ coverMediaId: mediaId, draftVersion: versionNumber, updatedAt: new Date() }).where(eq(offerings.id, offering.id));
    await tx.insert(offeringRevisions).values({
      offeringId: offering.id,
      editorId: authorId,
      versionNumber,
      snapshot,
      changeNote: "Bổ sung ảnh cover từ iwork.vn",
    });
    await tx.insert(auditLogs).values({
      userId: authorId,
      action: "offering.attach_cover_v1",
      entityType: "offering",
      entityId: offering.id,
      afterData: { coverMediaId: mediaId },
    });

    return true;
  });
}

async function createSupportDownload({ authorId, mediaId, source }: { authorId: string; mediaId: string; source: z.infer<typeof v1DownloadSchema> }) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: supportDownloads.id }).from(supportDownloads).where(eq(supportDownloads.fileMediaId, mediaId)).limit(1);
    if (existing) {
      return false;
    }

    const [created] = await tx
      .insert(supportDownloads)
      .values({
        fileMediaId: mediaId,
        icon: source.icon,
        title: source.title,
        description: source.description,
        meta: source.meta,
        sortOrder: source.sortOrder,
        isEnabled: source.isEnabled,
      })
      .returning({ id: supportDownloads.id });

    if (!created) {
      throw new Error("Không thể tạo mục tải xuống Hỗ trợ.");
    }

    await tx.insert(auditLogs).values({
      userId: authorId,
      action: "support_download.import_v1",
      entityType: "support_download",
      entityId: created.id,
      afterData: { source: "iwork.vn", sourceDownloadId: source.id, fileMediaId: mediaId },
    });

    return true;
  });
}

async function importV1Media() {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  if (!username) {
    throw new Error("Cần đặt INITIAL_ADMIN_USERNAME trước khi import media V1.");
  }

  const db = getDb();
  const [author] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (!author) {
    throw new Error("Không tìm thấy tài khoản quản trị để ghi nhận người import media V1.");
  }

  await ensureMediaBucket();
  const offeringGroups = await Promise.all(offeringTypes.map(async (type) => v1OfferingResponseSchema.parse(await fetchV1Json(`/api/public/offerings?type=${type}`)).items));
  const downloads = v1DownloadResponseSchema.parse(await fetchV1Json("/api/public/downloads")).items;
  let linkedCoverCount = 0;
  let createdSupportCount = 0;

  for (const offering of offeringGroups.flat()) {
    if (!offering.coverUrl) {
      continue;
    }

    const sourceUrl = secureSourceUrl(offering.coverUrl);
    const storageKey = `imports/v1/offerings/${offering.type}/${offering.slug}/cover${extensionFromUrl(sourceUrl)}`;
    const asset = await importAsset({ authorId: author.id, storageKey, originalName: `cover-${offering.slug}${extensionFromUrl(sourceUrl)}`, sourceUrl });
    if (await attachOfferingCover({ authorId: author.id, type: offering.type, slug: offering.slug, mediaId: asset.id })) {
      linkedCoverCount += 1;
    }
  }

  for (const download of downloads) {
    if (!download.fileUrl || !download.fileName) {
      continue;
    }

    const sourceUrl = secureSourceUrl(download.fileUrl);
    const storageKey = `imports/v1/support/${download.id}/${safeFileName(download.fileName)}`;
    const asset = await importAsset({ authorId: author.id, storageKey, originalName: download.fileName, sourceUrl });
    if (await createSupportDownload({ authorId: author.id, mediaId: asset.id, source: download })) {
      createdSupportCount += 1;
    }
  }

  console.log(`Đã liên kết ${linkedCoverCount} ảnh cover Offering và tạo ${createdSupportCount} tệp tải xuống Hỗ trợ từ iwork.vn.`);
}

importV1Media().catch((error: unknown) => {
  const message = error instanceof z.ZodError
    ? "Dữ liệu V1 không đúng cấu trúc cần để import."
    : error instanceof Error ? error.message : "Lỗi không xác định";
  console.error(`Import media V1 thất bại: ${message}`);
  process.exitCode = 1;
});

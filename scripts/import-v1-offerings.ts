import "dotenv/config";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../packages/core/src/db/client";
import { auditLogs, offeringRevisions, offerings, users } from "../packages/core/src/db/schema";
import { offeringContentSchema } from "../packages/core/src/server/offerings/offering-content.contract";

const v1BaseUrl = "https://iwork.vn";
// Industry offerings were retired from the CMS and must not be re-imported.
const offeringTypes = ["software", "solution", "service"] as const;

const v1OfferingSchema = z
  .object({
    type: z.enum(offeringTypes),
    title: z.string().trim().min(1).max(220),
    slug: z.string().trim().min(1).max(180),
    summary: z.string().trim().min(1),
    contentJson: offeringContentSchema,
    icon: z.string().trim().min(1).max(120).nullable(),
    sortOrder: z.number().int().min(0),
    isFeatured: z.boolean(),
    seoTitle: z.string().trim().min(1).max(70).nullable(),
    seoDescription: z.string().trim().min(1).max(180).nullable(),
    canonicalUrl: z.string().url().nullable(),
    publishedAt: z.string().datetime(),
  })
  .passthrough();

const v1ResponseSchema = z.object({ items: z.array(v1OfferingSchema) }).strict();

type V1Offering = z.infer<typeof v1OfferingSchema>;

async function fetchV1Offerings(type: (typeof offeringTypes)[number]) {
  const response = await fetch(`${v1BaseUrl}/api/public/offerings?type=${type}`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Không thể lấy danh sách ${type} từ iwork.vn (HTTP ${response.status}).`);
  }

  return v1ResponseSchema.parse(await response.json()).items;
}

async function importV1Offerings() {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();

  if (!username) {
    throw new Error("Cần đặt INITIAL_ADMIN_USERNAME trước khi import nội dung V1.");
  }

  const groups = await Promise.all(offeringTypes.map((type) => fetchV1Offerings(type)));
  const sourceOfferings = groups.flat();
  const db = getDb();
  const [author] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);

  if (!author) {
    throw new Error("Không tìm thấy tài khoản quản trị để ghi nhận người import nội dung V1.");
  }

  const result = await db.transaction(async (tx) => {
    let createdCount = 0;
    let skippedCount = 0;

    for (const sourceOffering of sourceOfferings) {
      const [existing] = await tx
        .select({ id: offerings.id })
        .from(offerings)
        .where(and(eq(offerings.type, sourceOffering.type), eq(offerings.slug, sourceOffering.slug), isNull(offerings.deletedAt)))
        .limit(1);

      if (existing) {
        skippedCount += 1;
        continue;
      }

      await createOfferingFromV1(tx, author.id, sourceOffering);
      createdCount += 1;
    }

    return { createdCount, skippedCount };
  });

  console.log(`Đã import ${result.createdCount} nội dung từ iwork.vn; bỏ qua ${result.skippedCount} mục đã tồn tại.`);
}

async function createOfferingFromV1(
  tx: Parameters<ReturnType<typeof getDb>["transaction"]>[0] extends (transaction: infer Transaction) => unknown ? Transaction : never,
  authorId: string,
  sourceOffering: V1Offering,
) {
  const sourceUrl = `${v1BaseUrl}/${sourceOffering.type === "solution" ? "giai-phap" : sourceOffering.type === "service" ? "dich-vu" : "phan-mem"}/${sourceOffering.slug}`;
  const content = offeringContentSchema.parse(sourceOffering.contentJson);
  const snapshot = {
    source: "iwork.vn",
    sourceUrl,
    importedAt: new Date().toISOString(),
    type: sourceOffering.type,
    title: sourceOffering.title,
    slug: sourceOffering.slug,
    summary: sourceOffering.summary,
    content,
    icon: sourceOffering.icon,
    sortOrder: sourceOffering.sortOrder,
    isFeatured: sourceOffering.isFeatured,
    seoTitle: sourceOffering.seoTitle,
    seoDescription: sourceOffering.seoDescription,
    canonicalUrl: sourceOffering.canonicalUrl,
    publishedAt: sourceOffering.publishedAt,
  };
  const [created] = await tx
    .insert(offerings)
    .values({
      type: sourceOffering.type,
      title: sourceOffering.title,
      slug: sourceOffering.slug,
      summary: sourceOffering.summary,
      content,
      icon: sourceOffering.icon,
      status: "published",
      draftVersion: 1,
      sortOrder: sourceOffering.sortOrder,
      isFeatured: sourceOffering.isFeatured,
      seoTitle: sourceOffering.seoTitle,
      seoDescription: sourceOffering.seoDescription,
      canonicalUrl: sourceOffering.canonicalUrl,
      publishedAt: new Date(sourceOffering.publishedAt),
    })
    .returning({ id: offerings.id });

  if (!created) {
    throw new Error("Không thể tạo nội dung V1 trong cơ sở dữ liệu.");
  }

  await tx.insert(offeringRevisions).values({
    offeringId: created.id,
    editorId: authorId,
    versionNumber: 1,
    snapshot,
    changeNote: "Import nội dung ban đầu từ iwork.vn",
  });
  await tx.insert(auditLogs).values({
    userId: authorId,
    action: "offering.import_v1",
    entityType: "offering",
    entityId: created.id,
    afterData: snapshot,
  });
}

importV1Offerings().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  console.error(`Import nội dung V1 thất bại: ${message}`);
  process.exitCode = 1;
});

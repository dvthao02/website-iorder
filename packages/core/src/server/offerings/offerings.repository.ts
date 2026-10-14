import { and, asc, count, desc, eq, ilike, isNull, lte, or } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { assertContentVersion, contentDeleteRequestSchema } from "../shared/content-version";
import { auditLogs, mediaAssets, offeringRevisions, offerings } from "@iorder/core/db/schema";

import type { AdminOfferingInput, PublicOfferingType } from "./offering-content.contract";
import { toAdminListPage, type AdminListQuery } from "@iorder/core/server/shared/admin-list.contract";

function publishedOfferingCondition(type: PublicOfferingType) {
  const now = new Date();

  return and(
    eq(offerings.type, type),
    isNull(offerings.deletedAt),
    or(
      and(eq(offerings.status, "published"), or(isNull(offerings.publishedAt), lte(offerings.publishedAt, now))),
      and(eq(offerings.status, "scheduled"), lte(offerings.scheduledAt, now)),
    ),
  );
}

export async function listPublishedOfferings(type: PublicOfferingType) {
  return getDb()
    .select({
      id: offerings.id,
      type: offerings.type,
      title: offerings.title,
      slug: offerings.slug,
      summary: offerings.summary,
      icon: offerings.icon,
      isFeatured: offerings.isFeatured,
      sortOrder: offerings.sortOrder,
      publishedAt: offerings.publishedAt,
      coverStorageKey: mediaAssets.storageKey,
      coverWidth: mediaAssets.width,
      coverHeight: mediaAssets.height,
      coverAltText: mediaAssets.altText,
    })
    .from(offerings)
    .leftJoin(mediaAssets, eq(offerings.coverMediaId, mediaAssets.id))
    .where(publishedOfferingCondition(type))
    .orderBy(asc(offerings.sortOrder), asc(offerings.title));
}

export async function findPublishedOfferingBySlug(type: PublicOfferingType, slug: string) {
  const [offering] = await getDb()
    .select({
      id: offerings.id,
      type: offerings.type,
      title: offerings.title,
      slug: offerings.slug,
      summary: offerings.summary,
      content: offerings.content,
      icon: offerings.icon,
      isFeatured: offerings.isFeatured,
      sortOrder: offerings.sortOrder,
      seoTitle: offerings.seoTitle,
      seoDescription: offerings.seoDescription,
      canonicalUrl: offerings.canonicalUrl,
      publishedAt: offerings.publishedAt,
      coverStorageKey: mediaAssets.storageKey,
      coverWidth: mediaAssets.width,
      coverHeight: mediaAssets.height,
      coverAltText: mediaAssets.altText,
    })
    .from(offerings)
    .leftJoin(mediaAssets, eq(offerings.coverMediaId, mediaAssets.id))
    .where(and(publishedOfferingCondition(type), eq(offerings.slug, slug)))
    .limit(1);

  return offering;
}

export async function listPublishedOfferingDetails(type: PublicOfferingType) {
  return getDb()
    .select({
      id: offerings.id,
      type: offerings.type,
      title: offerings.title,
      slug: offerings.slug,
      summary: offerings.summary,
      content: offerings.content,
      icon: offerings.icon,
      isFeatured: offerings.isFeatured,
      sortOrder: offerings.sortOrder,
      seoTitle: offerings.seoTitle,
      seoDescription: offerings.seoDescription,
      canonicalUrl: offerings.canonicalUrl,
      publishedAt: offerings.publishedAt,
      coverStorageKey: mediaAssets.storageKey,
      coverWidth: mediaAssets.width,
      coverHeight: mediaAssets.height,
      coverAltText: mediaAssets.altText,
    })
    .from(offerings)
    .leftJoin(mediaAssets, eq(offerings.coverMediaId, mediaAssets.id))
    .where(publishedOfferingCondition(type))
    .orderBy(asc(offerings.sortOrder), asc(offerings.title));
}

const adminOfferingSelection = {
  id: offerings.id,
  coverMediaId: offerings.coverMediaId,
  type: offerings.type,
  title: offerings.title,
  slug: offerings.slug,
  summary: offerings.summary,
  content: offerings.content,
  icon: offerings.icon,
  status: offerings.status,
  draftVersion: offerings.draftVersion,
  sortOrder: offerings.sortOrder,
  isFeatured: offerings.isFeatured,
  seoTitle: offerings.seoTitle,
  seoDescription: offerings.seoDescription,
  canonicalUrl: offerings.canonicalUrl,
  scheduledAt: offerings.scheduledAt,
  publishedAt: offerings.publishedAt,
  updatedAt: offerings.updatedAt,
};

type OfferingListQuery = AdminListQuery & {
  status?: "draft" | "review" | "scheduled" | "published" | "archived";
  type?: PublicOfferingType;
};

function offeringListCondition(query: OfferingListQuery) {
  const keyword = query.query ? `%${query.query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  return and(
    isNull(offerings.deletedAt),
    query.type ? eq(offerings.type, query.type) : undefined,
    query.status ? eq(offerings.status, query.status) : undefined,
    keyword ? or(ilike(offerings.title, keyword), ilike(offerings.slug, keyword)) : undefined,
  );
}

export async function listAdminOfferings() {
  return getDb().select(adminOfferingSelection)
    .from(offerings)
    .where(isNull(offerings.deletedAt))
    .orderBy(asc(offerings.type), asc(offerings.sortOrder), asc(offerings.title));
}

export async function listAdminOfferingsPage(query: OfferingListQuery, database = getDb()) {
  const condition = offeringListCondition(query);
  return database.transaction(async (tx) => {
    const rows = await tx.select(adminOfferingSelection).from(offerings).where(condition).orderBy(desc(offerings.updatedAt), asc(offerings.sortOrder), asc(offerings.title), asc(offerings.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(offerings).where(condition);
    return toAdminListPage(rows, query, totals?.total ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function findAdminOfferingById(id: string) {
  const [offering] = await getDb()
    .select(adminOfferingSelection)
    .from(offerings)
    .where(and(eq(offerings.id, id), isNull(offerings.deletedAt)))
    .limit(1);

  return offering;
}

export async function listAdminOfferingSummariesPage(query: OfferingListQuery, database = getDb()) {
  const condition = offeringListCondition(query);
  return database.transaction(async tx => {
    const rows = await tx.select({ id: offerings.id, type: offerings.type, title: offerings.title, slug: offerings.slug, status: offerings.status, draftVersion: offerings.draftVersion, updatedAt: offerings.updatedAt })
      .from(offerings).where(condition).orderBy(desc(offerings.updatedAt), asc(offerings.sortOrder), asc(offerings.title), asc(offerings.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    const [totals] = await tx.select({ total: count() }).from(offerings).where(condition);
    return toAdminListPage(rows, query, totals?.total ?? 0);
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

type OfferingRevisionWrite = {
  changeNote: string;
  editorId: string;
  snapshot: unknown;
  versionNumber: number;
};

export async function createOfferingWithRevision(values: AdminOfferingInput & { publishedAt: Date | null }, revision: OfferingRevisionWrite) {
  return getDb().transaction(async (tx) => {
    const [created] = await tx
      .insert(offerings)
      .values({ ...values, draftVersion: revision.versionNumber })
      .returning({ id: offerings.id });

    if (!created) {
      throw new Error("Không thể tạo Offering.");
    }

    await tx.insert(offeringRevisions).values({
      offeringId: created.id,
      editorId: revision.editorId,
      versionNumber: revision.versionNumber,
      snapshot: revision.snapshot,
      changeNote: revision.changeNote,
    });
    await tx.insert(auditLogs).values({
      userId: revision.editorId,
      action: "offering.create",
      entityType: "offering",
      entityId: created.id,
      afterData: revision.snapshot,
    });

    return created.id;
  });
}

export async function updateOfferingWithRevision(id: string, values: AdminOfferingInput & { publishedAt: Date | null }, revision: OfferingRevisionWrite) {
  return getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(offerings)
      .set({ ...values, draftVersion: revision.versionNumber, updatedAt: new Date() })
      .where(and(eq(offerings.id, id), isNull(offerings.deletedAt), eq(offerings.draftVersion, revision.versionNumber - 1)))
      .returning({ id: offerings.id });

    if (!updated) {
      return undefined;
    }

    await tx.insert(offeringRevisions).values({
      offeringId: updated.id,
      editorId: revision.editorId,
      versionNumber: revision.versionNumber,
      snapshot: revision.snapshot,
      changeNote: revision.changeNote,
    });
    await tx.insert(auditLogs).values({
      userId: revision.editorId,
      action: "offering.update",
      entityType: "offering",
      entityId: updated.id,
      afterData: revision.snapshot,
    });

    return updated.id;
  });
}

export async function deleteArchivedOffering(id: string, editorId: string, expectedVersion: number, database?: ReturnType<typeof getDb>) {
  contentDeleteRequestSchema.parse({ expectedVersion });
  return (database ?? getDb()).transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(offerings)
      .where(and(eq(offerings.id, id), eq(offerings.status, "archived"), isNull(offerings.deletedAt)))
      .for("update");

    if (!existing) return undefined;
    assertContentVersion(existing.draftVersion, expectedVersion);

    const [deleted] = await tx
      .update(offerings)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(offerings.id, id), eq(offerings.draftVersion, expectedVersion), eq(offerings.status, "archived"), isNull(offerings.deletedAt)))
      .returning({ id: offerings.id, slug: offerings.slug, type: offerings.type });

    if (!deleted) return undefined;

    await tx.insert(auditLogs).values({
      userId: editorId,
      action: "offering.delete",
      entityType: "offering",
      entityId: deleted.id,
      beforeData: existing,
    });

    return deleted;
  });
}

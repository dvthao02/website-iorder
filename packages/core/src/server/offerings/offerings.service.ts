import {
  adminOfferingInputSchema,
  adminOfferingSchema,
  adminOfferingListItemSchema,
  offeringSlugSchema,
  publicOfferingDetailSchema,
  publicOfferingSummarySchema,
  publicOfferingTypeSchema,
  type AdminOffering,
  type PublicOfferingType,
} from "./offering-content.contract";
import { mediaPath } from "../media/storage";
import { validateCoverMedia } from "../media/media.service";
import { publicationDate } from "../shared/publication-date";
import { assertContentVersion, contentStateAfterAction, contentStateChangeNotes, contentStateRequestSchema, ContentVersionConflictError, type ContentStateAction } from "../shared/content-version";
import {
  createOfferingWithRevision,
  deleteArchivedOffering,
  findAdminOfferingById,
  findPublishedOfferingBySlug,
  listAdminOfferings,
  listAdminOfferingsPage,
  listAdminOfferingSummariesPage,
  listPublishedOfferingDetails,
  listPublishedOfferings,
  updateOfferingWithRevision,
} from "./offerings.repository";
import type { AdminListPage, AdminListQuery } from "@iorder/core/server/shared/admin-list.contract";

const offeringIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const catalogTypeByPath = {
  "dich-vu": "service",
  "giai-phap": "solution",
  "phan-mem": "software",
} as const;


export function getOfferingTypeFromCatalogPath(path: string) {
  const type = catalogTypeByPath[path as keyof typeof catalogTypeByPath];

  return type ? publicOfferingTypeSchema.parse(type) : undefined;
}

export async function getPublishedOfferingSummaries(type: string) {
  const parsedType = publicOfferingTypeSchema.parse(type);
  const rows = await listPublishedOfferings(parsedType);

  return rows.map((row) => publicOfferingSummarySchema.parse(serializeOffering(row)));
}

export async function getPublishedOfferingBySlug(type: string, slug: string, previewId?: string) {
  const parsedType = publicOfferingTypeSchema.parse(type);
  const parsedSlug = offeringSlugSchema.parse(slug);
  const offering = await findPublishedOfferingBySlug(parsedType, parsedSlug, previewId);

  return offering ? publicOfferingDetailSchema.parse(serializeOffering(offering)) : undefined;
}
export async function getPublishedOfferingDetails(type: string) {
  const parsedType = publicOfferingTypeSchema.parse(type);
  return publicOfferingDetailSchema.array().parse((await listPublishedOfferingDetails(parsedType)).map(serializeOffering));
}

export async function getAdminOfferings() {
  const rows = await listAdminOfferings();

  return rows.map((row) => adminOfferingSchema.parse(row));
}

export async function getAdminOfferingsPage(query: AdminListQuery & { status?: AdminOffering["status"]; type?: PublicOfferingType }): Promise<AdminListPage<AdminOffering>> {
  const result = await listAdminOfferingsPage(query);
  return { ...result, items: result.items.map((row) => adminOfferingSchema.parse(row)) };
}

export async function getAdminOfferingById(id: string) {
  if (!offeringIdPattern.test(id)) return undefined;
  const offering = await findAdminOfferingById(id);
  return offering ? adminOfferingSchema.parse(offering) : undefined;
}

export async function createAdminOffering(input: unknown, editorId: string) {
  const values = adminOfferingInputSchema.parse(input);
  await validateCoverMedia(values.coverMediaId);
  const publishedAt = values.status === "scheduled" ? values.scheduledAt : values.status === "published" ? new Date() : null;
  const snapshot = { ...values, publishedAt: publishedAt?.toISOString() ?? null };
  const id = await createOfferingWithRevision(
    { ...values, publishedAt },
    { editorId, versionNumber: 1, snapshot, changeNote: "Tạo Offering trong CMS" },
  );
  const offering = await findAdminOfferingById(id);

  if (!offering) {
    throw new Error("Không thể đọc Offering vừa tạo.");
  }

  return adminOfferingSchema.parse(offering);
}

export async function updateAdminOffering(id: string, input: unknown, editorId: string, changeNote = "Cập nhật Offering trong CMS", expectedVersion?: number) {
  const values = adminOfferingInputSchema.parse(input);
  await validateCoverMedia(values.coverMediaId);
  const existing = await findAdminOfferingById(id);

  if (!existing) {
    return undefined;
  }

  if (expectedVersion !== undefined) assertContentVersion(existing.draftVersion, expectedVersion);
  const publishedAt = publicationDate(values, existing, new Date());
  const versionNumber = existing.draftVersion + 1;
  const snapshot = { ...values, coverMediaId: values.coverMediaId === undefined ? existing.coverMediaId : values.coverMediaId, publishedAt: publishedAt?.toISOString() ?? null };
  const updatedId = await updateOfferingWithRevision(
    id,
    { ...values, publishedAt },
    { editorId, versionNumber, snapshot, changeNote },
  );

  if (!updatedId) {
    throw new ContentVersionConflictError();
  }

  const offering = await findAdminOfferingById(updatedId);

  if (!offering) {
    throw new Error("Không thể đọc Offering vừa cập nhật.");
  }

  return adminOfferingSchema.parse(offering);
}

export async function getAdminOfferingSummariesPage(query: Parameters<typeof listAdminOfferingSummariesPage>[0]) {
  const result = await listAdminOfferingSummariesPage(query);
  return { ...result, items: adminOfferingListItemSchema.array().parse(result.items) };
}

export async function deleteArchivedAdminOffering(id: string, editorId: string, expectedVersion: number) {
  if (!offeringIdPattern.test(id)) return undefined;
  return deleteArchivedOffering(id, editorId, expectedVersion);
}

export async function changeAdminOfferingState(id: string, action: ContentStateAction, editorId: string, expectedVersion: number) {
  contentStateRequestSchema.parse({ action, expectedVersion });
  const current = await findAdminOfferingById(id);
  if (!current) return undefined;
  const status = contentStateAfterAction(current, action, expectedVersion);
  const values = Object.fromEntries(Object.keys(adminOfferingInputSchema.shape).map(key => [key, Reflect.get(current, key)]));
  return updateAdminOffering(id, { ...values, status }, editorId, `${contentStateChangeNotes[action]} nội dung`, expectedVersion);
}

function serializeOffering<T extends {
  coverAltText: string | null;
  coverHeight: number | null;
  coverStorageKey: string | null;
  coverWidth: number | null;
}>(row: T) {
  const { coverStorageKey, coverWidth, coverHeight, coverAltText, ...offering } = row;

  return {
    ...offering,
    cover: coverStorageKey
      ? { url: mediaPath(coverStorageKey), width: coverWidth, height: coverHeight, altText: coverAltText }
      : null,
  };
}

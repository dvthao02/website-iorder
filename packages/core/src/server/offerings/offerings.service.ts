import {
  adminOfferingInputSchema,
  adminOfferingSchema,
  offeringSlugSchema,
  publicOfferingDetailSchema,
  publicOfferingSummarySchema,
  publicOfferingTypeSchema,
} from "./offering-content.contract";
import { mediaPath } from "../media/storage";
import { validateCoverMedia } from "../media/media.service";
import {
  createOfferingWithRevision,
  deleteArchivedOffering,
  findAdminOfferingById,
  findPublishedOfferingBySlug,
  listAdminOfferings,
  listPublishedOfferings,
  updateOfferingWithRevision,
} from "./offerings.repository";

const offeringIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const catalogTypeByPath = {
  "dich-vu": "service",
  "giai-phap": "solution",
  "phan-mem": "software",
} as const;

// `industry` remains a legacy database value so old records can be retained,
// but it is no longer a public catalog and must never be published by route.
const publicCatalogTypeSchema = publicOfferingTypeSchema.exclude(["industry"]);

export function getOfferingTypeFromCatalogPath(path: string) {
  const type = catalogTypeByPath[path as keyof typeof catalogTypeByPath];

  return type ? publicOfferingTypeSchema.parse(type) : undefined;
}

export async function getPublishedOfferingSummaries(type: string) {
  const parsedType = publicCatalogTypeSchema.parse(type);
  const rows = await listPublishedOfferings(parsedType);

  return rows.map((row) => publicOfferingSummarySchema.parse(serializeOffering(row)));
}

export async function getPublishedOfferingBySlug(type: string, slug: string) {
  const parsedType = publicCatalogTypeSchema.parse(type);
  const parsedSlug = offeringSlugSchema.parse(slug);
  const offering = await findPublishedOfferingBySlug(parsedType, parsedSlug);

  return offering ? publicOfferingDetailSchema.parse(serializeOffering(offering)) : undefined;
}

export async function getAdminOfferings() {
  const rows = await listAdminOfferings();

  return rows.map((row) => adminOfferingSchema.parse(row));
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

export async function updateAdminOffering(id: string, input: unknown, editorId: string, changeNote = "Cập nhật Offering trong CMS") {
  const values = adminOfferingInputSchema.parse(input);
  await validateCoverMedia(values.coverMediaId);
  const existing = await findAdminOfferingById(id);

  if (!existing) {
    return undefined;
  }

  const publishedAt = values.status === "scheduled"
    ? values.scheduledAt
    : values.status === "published"
      ? existing.publishedAt ?? new Date()
      : null;
  const versionNumber = existing.draftVersion + 1;
  const snapshot = { ...values, coverMediaId: values.coverMediaId === undefined ? existing.coverMediaId : values.coverMediaId, publishedAt: publishedAt?.toISOString() ?? null };
  const updatedId = await updateOfferingWithRevision(
    id,
    { ...values, publishedAt },
    { editorId, versionNumber, snapshot, changeNote },
  );

  if (!updatedId) {
    return undefined;
  }

  const offering = await findAdminOfferingById(updatedId);

  if (!offering) {
    throw new Error("Không thể đọc Offering vừa cập nhật.");
  }

  return adminOfferingSchema.parse(offering);
}

export async function deleteArchivedAdminOffering(id: string, editorId: string) {
  if (!offeringIdPattern.test(id)) return undefined;
  return deleteArchivedOffering(id, editorId);
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

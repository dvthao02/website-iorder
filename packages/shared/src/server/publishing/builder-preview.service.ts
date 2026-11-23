import { getEquipment, getEquipmentGroups } from "../equipment/equipment.service";
import { findBuilderPreview, writeBuilderPreview } from "./builder-preview.repository";
import { builderPreviewRequestSchema } from "./builder-preview.contract";
import { createPreviewToken, verifyPreviewToken } from "./preview-token";
import { offeringPublicPath, pagePublicPath, postPublicPath } from "../shared/content-paths";
import { getAuthorProfileForPreview } from "../authors/authors.service";
import { publicPostDetailSchema } from "../posts/posts.contract";
import { getTaxonomy } from "../taxonomy/taxonomy.service";
import { publicPageSchema } from "../pages/pages.contract";
import { publicOfferingDetailSchema } from "../offerings/offering-content.contract";
import { getMediaById } from "../media/media.service";

export async function saveBuilderPreview(ownerId: string, input: unknown) {
  const parsed = builderPreviewRequestSchema.parse(input);
  const row = await writeBuilderPreview(ownerId, parsed);
  return row ? { token: createPreviewToken("builder", row.id), sequence: row.sequence } : undefined;
}

export async function readBuilderPreview(token: string | null | undefined) {
  const claims = verifyPreviewToken(token);
  if (claims?.kind !== "builder") return undefined;
  const preview = await findBuilderPreview(claims.id);
  if (!preview) return undefined;
  const path = preview.document.kind === "post" ? postPublicPath(preview.document.values.slug, preview.document.values.type) : preview.document.kind === "page" ? pagePublicPath(preview.document.values.slug) : preview.document.kind === "equipment" ? `/equipment/${preview.document.values.slug}` : offeringPublicPath(preview.document.values.slug, preview.document.values.type);
  return path ? { ...preview, path } : undefined;
}

export async function builderPreviewPublicContent(preview: NonNullable<Awaited<ReturnType<typeof readBuilderPreview>>>) {
  if (preview.document.kind === "page") {
    const values = preview.document.values;
    return { page: publicPageSchema.parse({ title: values.title, slug: values.slug, template: values.template, seoTitle: values.seoTitle, seoDescription: values.seoDescription, canonicalUrl: values.canonicalUrl, seo: values.seo, blocks: values.blocks.filter(block => block.isEnabled) }), systemPageExists: true };
  }
  if (preview.document.kind === "equipment") {
    const values = preview.document.values;
    const [all, groups, cover] = await Promise.all([getEquipment(true), getEquipmentGroups(), values.coverMediaId ? getMediaById(values.coverMediaId) : null]);
    return { equipment: [...all.filter(item => item.id !== preview.documentId && item.slug !== values.slug), { ...values, id: preview.documentId ?? preview.id, groupName: groups.find(group => group.id === values.groupId)?.name ?? "", coverUrl: cover?.mimeType.startsWith("image/") ? cover.url : null, coverAlt: cover?.altText ?? null, version: 0, updatedAt: new Date() }] };
  }
  if (preview.document.kind === "post") {
    const values = preview.document.values;
    const [media, taxonomy, authorProfile] = await Promise.all([values.coverMediaId ? getMediaById(values.coverMediaId) : null, getTaxonomy(), getAuthorProfileForPreview(values.authorProfileId)]);
    const now = new Date();
    // Bản nháp chưa xuất bản vẫn hiện ngày hôm nay để người viết thấy đúng dòng chủ đề · ngày · thời gian đọc.
    return { post: publicPostDetailSchema.parse({
      id: preview.documentId ?? preview.id, type: values.type, title: values.title, slug: values.slug, excerpt: values.excerpt,
      publishedAt: now, createdAt: now, updatedAt: now,
      cover: media?.mimeType.startsWith("image/") ? { url: media.url, altText: media.altText } : null,
      categories: taxonomy.categories.filter(item => values.categoryIds.includes(item.id)).map(({ id, name, slug }) => ({ id, name, slug })),
      tags: taxonomy.tags.filter(item => values.tagIds.includes(item.id)).map(({ id, name, slug }) => ({ id, name, slug })),
      authorName: values.authorName ?? null, authorTitle: values.authorTitle ?? null, authorUrl: values.authorUrl ?? null, authorProfile,
      content: values.content, seoTitle: values.seoTitle, seoDescription: values.seoDescription, canonicalUrl: values.canonicalUrl, seo: values.seo,
    }) };
  }
  const values = preview.document.values;
  const media = values.coverMediaId ? await getMediaById(values.coverMediaId) : null;
  return { offering: publicOfferingDetailSchema.parse({
    id: preview.documentId ?? preview.id, type: values.type, title: values.title, slug: values.slug,
    summary: values.summary, content: values.content, icon: values.icon, isFeatured: values.isFeatured, sortOrder: values.sortOrder,
    seoTitle: values.seoTitle, seoDescription: values.seoDescription, canonicalUrl: values.canonicalUrl, seo: values.seo,
    publishedAt: null, cover: media?.mimeType.startsWith("image/") ? { url: media.url, altText: media.altText, width: null, height: null } : null,
  }) };
}

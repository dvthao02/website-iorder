import { validateCoverMedia } from "@iorder/core/server/media/media.service";
import { mediaPath } from "@iorder/core/server/media/storage";
import { partnerInputSchema, partnerListPageSchema, partnerListQuerySchema, testimonialInputSchema, testimonialListPageSchema, testimonialListQuerySchema } from "./supporting.contract";
import { deleteDisabledPartner, deleteDisabledTestimonial, findSupportingVisibility, listPartners, listPartnersPage, listTestimonials, listTestimonialsPage, savePartner, saveTestimonial } from "./supporting.repository";
import { z } from "zod";

function partnerRow({ partner, storageKey, altText }: Awaited<ReturnType<typeof listPartners>>[number]) {
  const values = partnerInputSchema.parse({ logoMediaId: partner.logoMediaId, kind: partner.kind, name: partner.name, description: partner.description, websiteUrl: partner.websiteUrl, sortOrder: partner.sortOrder, isEnabled: partner.isEnabled });
  return { id: partner.id, ...values, logo: storageKey ? { url: mediaPath(storageKey), altText } : null };
}
function testimonialRow({ testimonial, storageKey, altText }: Awaited<ReturnType<typeof listTestimonials>>[number]) {
  const values = testimonialInputSchema.parse({ avatarMediaId: testimonial.avatarMediaId, authorName: testimonial.authorName, authorRole: testimonial.authorRole, company: testimonial.company, quote: testimonial.quote, rating: testimonial.rating, sortOrder: testimonial.sortOrder, isEnabled: testimonial.isEnabled });
  return { id: testimonial.id, ...values, avatar: storageKey ? { url: mediaPath(storageKey), altText } : null };
}
export async function getPartners(enabledOnly = false) { return (await listPartners(enabledOnly)).map(partnerRow); }
export async function getTestimonials(enabledOnly = false) { return (await listTestimonials(enabledOnly)).map(testimonialRow); }
export async function getPartnersPage(input: unknown) {
  const result = await listPartnersPage(partnerListQuerySchema.parse(input));
  return partnerListPageSchema.parse({ ...result, items: result.items.map(row => ({ ...partnerRow(row), version: row.partner.version })) });
}
export async function getTestimonialsPage(input: unknown) {
  const result = await listTestimonialsPage(testimonialListQuerySchema.parse(input));
  return testimonialListPageSchema.parse({ ...result, items: result.items.map(row => ({ ...testimonialRow(row), version: row.testimonial.version })) });
}
// onlyIfHidden: the update applies only while the item is hidden (atomic guard for actors without supporting.publish).
export async function writeSupporting(kind: "partners" | "testimonials", id: string | null, input: unknown, userId: string, options: { onlyIfHidden?: boolean; expectedVersion?: number } = {}) {
  if (kind === "partners") { const values = partnerInputSchema.parse(input); await validateCoverMedia(values.logoMediaId); return savePartner(id, values, userId, undefined, options); }
  const values = testimonialInputSchema.parse(input); await validateCoverMedia(values.avatarMediaId); return saveTestimonial(id, values, userId, undefined, options);
}
export async function deleteDisabledSupporting(kind: "partners" | "testimonials", id: string, userId: string) {
  if (!z.string().uuid().safeParse(id).success) return undefined;
  return kind === "partners" ? deleteDisabledPartner(id, userId) : deleteDisabledTestimonial(id, userId);
}
export async function getSupportingVisibility(kind: "partners" | "testimonials", id: string) { return findSupportingVisibility(kind, id); }

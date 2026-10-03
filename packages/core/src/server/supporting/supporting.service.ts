import { validateCoverMedia } from "@iorder/core/server/media/media.service";
import { mediaPath } from "@iorder/core/server/media/storage";
import { partnerInputSchema, testimonialInputSchema } from "./supporting.contract";
import { listPartners, listTestimonials, savePartner, saveTestimonial } from "./supporting.repository";

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
export async function writeSupporting(kind: "partners" | "testimonials", id: string | null, input: unknown, userId: string) {
  if (kind === "partners") { const values = partnerInputSchema.parse(input); await validateCoverMedia(values.logoMediaId); return savePartner(id, values, userId); }
  const values = testimonialInputSchema.parse(input); await validateCoverMedia(values.avatarMediaId); return saveTestimonial(id, values, userId);
}

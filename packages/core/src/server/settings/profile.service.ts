import { profileInputSchema } from "./profile.contract";
import { findSiteProfile, saveSiteProfile } from "./profile.repository";
import { validateCoverMedia } from "@iorder/core/server/media/media.service";

function serialize(row: NonNullable<Awaited<ReturnType<typeof findSiteProfile>>>) {
  const { companyName, legalName, hotline, supportEmail, salesEmail, address, workingHours, logoMediaId } = row;
  return profileInputSchema.parse({ companyName, legalName, hotline, supportEmail, salesEmail, address, workingHours, logoMediaId });
}

export async function getSiteProfile() {
  const row = await findSiteProfile();
  return row ? serialize(row) : null;
}

// Giá trị và version đọc từ cùng một dòng để CMS không nhận dữ liệu cũ kèm version mới.
export async function getSiteProfileWithVersion() {
  const row = await findSiteProfile();
  return { profile: row ? serialize(row) : null, version: row?.version ?? 0 };
}

export async function updateSiteProfile(input: unknown, userId: string, expectedVersion?: number) {
  const values = profileInputSchema.parse(input);
  await validateCoverMedia(values.logoMediaId);
  const saved = await saveSiteProfile(values, userId, expectedVersion);
  return { profile: serialize(saved), version: saved.version };
}

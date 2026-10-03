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

export async function updateSiteProfile(input: unknown, userId: string) {
  const values = profileInputSchema.parse(input);
  await validateCoverMedia(values.logoMediaId);
  return serialize(await saveSiteProfile(values, userId));
}

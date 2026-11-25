import type { Metadata, ResolvingMetadata } from "next";

import { ListingPageView } from "@/components/site/listing-page-view";
import { SiteHeader } from "@/components/site/site-header";
import { getT } from "@/lib/messages";
import { getListingPageContent, listingPageMetadata } from "@/lib/listing-page";

export const revalidate = 0;

export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> { return listingPageMetadata(await getListingPageContent("listing-support"), "/support/setup", parent); }

export default async function SupportInstallationPage() {
  const t = await getT();
  const content = await getListingPageContent("listing-support");
  if (!content) return <><SiteHeader /><main id="noi-dung" className="mx-auto max-w-4xl p-6">{t("empty.supportPage")}</main></>;
  return <ListingPageView content={content} crumb={{ name: t("support.setupTitle"), path: "/support/setup" }} />;
}

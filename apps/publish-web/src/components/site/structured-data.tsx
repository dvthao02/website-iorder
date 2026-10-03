import type { ProfileInput } from "@iorder/core/server/settings/profile.contract";
import type { ExternalLinks } from "@iorder/core/server/settings/external-links.contract";
import type { PublishingConfig } from "@iorder/core/server/settings/publishing.contract";

type StructuredDataProps = {
  config: PublishingConfig;
  externalLinks: ExternalLinks | null;
  logoUrl: string | null;
  profile: ProfileInput | null;
};

export function StructuredData({ config, externalLinks, logoUrl, profile }: StructuredDataProps) {
  if (!profile) return null;

  const sameAs = [externalLinks?.facebook, externalLinks?.zalo, externalLinks?.youtube].filter((url): url is string => Boolean(url));
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: profile.companyName,
    legalName: profile.legalName ?? undefined,
    url: config.siteUrl ?? undefined,
    logo: logoUrl ?? undefined,
    email: profile.salesEmail ?? profile.supportEmail ?? undefined,
    telephone: profile.hotline ?? undefined,
    address: profile.address ? { "@type": "PostalAddress", streetAddress: profile.address } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
  const website = config.siteUrl ? { "@context": "https://schema.org", "@type": "WebSite", name: config.defaultTitle ?? profile.companyName, url: config.siteUrl } : undefined;
  const value = JSON.stringify(website ? [organization, website] : organization).replace(/</g, "\\u003c");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: value }} />;
}

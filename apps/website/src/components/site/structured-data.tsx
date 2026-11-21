import type { ProfileInput } from "@iorder/shared/server/settings/profile.contract";
import type { ExternalLinks } from "@iorder/shared/server/settings/external-links.contract";
import type { PublishingConfig } from "@iorder/shared/server/settings/publishing.contract";
import { addressLines } from "@/lib/address-lines";
import { organizationId, serializeJsonLd, siteLanguage, websiteId } from "@/lib/structured-data";

type StructuredDataProps = {
  config: PublishingConfig;
  externalLinks: ExternalLinks | null;
  logoUrl: string | null;
  profile: ProfileInput | null;
};

// Tổ chức và website có mã nút (@id) cố định: bài viết, thiết bị, dịch vụ trỏ về đây qua publisher/seller/provider,
// nên Google gom mọi trang về một thương hiệu. Có hotline thì khai thêm cách liên hệ để hiện trong bảng thông tin thương hiệu.
export function StructuredData({ config, externalLinks, logoUrl, profile }: StructuredDataProps) {
  if (!profile) return null;

  const site = config.siteUrl;
  const absoluteUrl = (path: string) => (site ? new URL(path, site).toString() : path);
  // Kênh chính thức của thương hiệu: mạng xã hội và trang ứng dụng trên App Store/Google Play giúp Google gom đúng thực thể.
  const sameAs = [externalLinks?.facebook, externalLinks?.zalo, externalLinks?.youtube, externalLinks?.appStore, externalLinks?.googlePlay].filter((url): url is string => Boolean(url));
  const contactPoints = [
    profile.hotline ? { "@type": "ContactPoint", contactType: "customer service", telephone: profile.hotline, availableLanguage: "vi" } : null,
    profile.supportEmail ? { "@type": "ContactPoint", contactType: "technical support", email: profile.supportEmail, availableLanguage: "vi" } : null,
    profile.salesEmail ? { "@type": "ContactPoint", contactType: "sales", email: profile.salesEmail, availableLanguage: "vi" } : null,
  ].filter((point): point is NonNullable<typeof point> => point !== null);
  // Mỗi dòng địa chỉ là một văn phòng; có tên chi nhánh thì ghi vào addressLocality.
  const postalAddresses = addressLines(profile.address).map(({ street, branch }) => ({ "@type": "PostalAddress", streetAddress: street, addressLocality: branch ?? undefined, addressCountry: "VN" }));
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": site ? organizationId(site) : undefined,
    name: profile.companyName,
    legalName: profile.legalName ?? undefined,
    url: site ?? undefined,
    logo: logoUrl ? absoluteUrl(logoUrl) : undefined,
    email: profile.salesEmail ?? profile.supportEmail ?? undefined,
    telephone: profile.hotline ?? undefined,
    address: postalAddresses.length === 1 ? postalAddresses[0] : postalAddresses.length ? postalAddresses : undefined,
    contactPoint: contactPoints.length ? contactPoints : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
  const website = site ? { "@context": "https://schema.org", "@type": "WebSite", "@id": websiteId(site), name: config.defaultTitle ?? profile.companyName, url: site, inLanguage: siteLanguage, publisher: { "@id": organizationId(site) } } : undefined;

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(website ? [organization, website] : organization) }} />;
}

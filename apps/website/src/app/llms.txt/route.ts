import { equipmentAvailabilityNotice } from "@iorder/shared/server/equipment/equipment-availability";
import { getFixedWebsitePage } from "@iorder/shared/server/pages/pages.contract";
import { isSitemapEligible } from "@iorder/shared/server/shared/content-seo";
import { getEquipment, getExternalLinks, getPublishedOfferingSummaries, getPublishedPage, getPublishedPageSummaries, getPublishedPostSummaries, getPublishingConfig, getSiteProfile } from "@/lib/backend";
import { addressLines } from "@/lib/address-lines";
import { buildLlmsTxt, type LlmsLink } from "@/lib/llms-txt";

export const dynamic = "force-dynamic";

const catalogs = [
  { type: "software", prefix: "/software", title: "Phần mềm" },
  { type: "solution", prefix: "/solutions", title: "Giải pháp" },
] as const;
// Trang pháp lý ít giúp AI trả lời câu hỏi về sản phẩm, xếp vào mục phụ cuối tệp.
const legalSlugs = new Set(["terms", "privacy-policy", "complaint-policy", "pricing-policy", "payment-policy", "supply-conditions", "delivery-return-policy", "online-support"]);
const maxPerSection = 60;
const priceFormatter = new Intl.NumberFormat("vi-VN");

const notFound = () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });

// Mục lục cho công cụ AI (llmstxt.org): giới thiệu ngắn, thông tin liên hệ rồi liên kết tới nội dung đã xuất bản,
// mỗi liên kết kèm một dòng mô tả. Cùng điều kiện với sitemap: cần URL website, tôn trọng "cho phép công cụ tìm kiếm" và noindex từng nội dung.
export async function GET() {
  const config = await getPublishingConfig();
  const site = config.siteUrl;
  if (!site || !config.allowSearchIndexing) return notFound();
  const url = (path: string) => new URL(path, site).toString();
  const [profile, externalLinks, pages, posts, equipment, ...offeringLists] = await Promise.all([
    getSiteProfile(), getExternalLinks(), getPublishedPageSummaries(), getPublishedPostSummaries(), getEquipment(true),
    ...catalogs.map((catalog) => getPublishedOfferingSummaries(catalog.type)),
  ]);

  const pageLinks = await Promise.all(pages.filter((page) => isSitemapEligible(page.seo)).map(async (page): Promise<{ legal: boolean; link: LlmsLink } | null> => {
    const fixed = getFixedWebsitePage(page.slug);
    if (fixed?.publicPath.includes("#")) return null;
    const path = fixed ? fixed.publicPath : `/pages/${page.slug}`;
    // Trang hệ thống dùng tên cố định; trang tự tạo lấy tiêu đề và mô tả từ CMS.
    const content = fixed ? undefined : await getPublishedPage(page.slug);
    return { legal: legalSlugs.has(page.slug), link: { title: fixed?.label ?? content?.title ?? page.slug, url: url(path), description: content?.seoDescription } };
  }));
  const visiblePages = pageLinks.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const newest = (a: { publishedAt: Date | null; updatedAt: Date }, b: { publishedAt: Date | null; updatedAt: Date }) => (b.publishedAt ?? b.updatedAt).getTime() - (a.publishedAt ?? a.updatedAt).getTime();
  const eligiblePosts = posts.filter((post) => isSitemapEligible(post.seo)).sort(newest);
  const contact = [profile?.hotline && `Hotline: ${profile.hotline}`, profile?.supportEmail && `Email hỗ trợ: ${profile.supportEmail}`, profile?.salesEmail && `Email kinh doanh: ${profile.salesEmail}`, profile?.address && `Địa chỉ: ${addressLines(profile.address).map(line => line.text).join("; ")}`, profile?.workingHours && `Giờ làm việc: ${profile.workingHours}`].filter(Boolean).join(" · ");
  const official: LlmsLink[] = [
    { title: "Facebook", url: externalLinks?.facebook ?? "" }, { title: "Zalo", url: externalLinks?.zalo ?? "" }, { title: "YouTube", url: externalLinks?.youtube ?? "" },
    { title: "Ứng dụng trên App Store", url: externalLinks?.appStore ?? "" }, { title: "Ứng dụng trên Google Play", url: externalLinks?.googlePlay ?? "" },
    { title: "Đăng nhập ứng dụng", url: externalLinks?.appLogin ?? "" }, { title: "Dùng thử miễn phí", url: externalLinks?.trial ?? "" },
  ].filter((link) => link.url);

  const text = buildLlmsTxt({
    name: config.defaultTitle ?? profile?.companyName ?? "iOrder",
    summary: config.defaultDescription,
    notes: [contact, profile?.legalName ? `Đơn vị vận hành: ${profile.legalName}.` : "", "Nội dung bằng tiếng Việt. Tệp này liệt kê các trang đã xuất bản, cập nhật theo nội dung hiện tại của website."],
    sections: [
      { title: "Trang chính", links: visiblePages.filter((entry) => !entry.legal).map((entry) => entry.link) },
      ...catalogs.map((catalog, index) => ({ title: catalog.title, links: offeringLists[index].filter((item) => isSitemapEligible(item.seo)).slice(0, maxPerSection).map((item) => ({ title: item.title, url: url(`${catalog.prefix}/${item.slug}`), description: item.summary })) })),
      { title: "Thiết bị bán hàng", links: equipment.filter((item) => isSitemapEligible(item.seo)).slice(0, maxPerSection).map((item) => ({ title: item.name, url: url(`/equipment/${item.slug}`), description: [item.summary, item.priceVnd ? `Giá ${priceFormatter.format(item.priceVnd)} ₫.` : "", equipmentAvailabilityNotice(item.availability) ? `${equipmentAvailabilityNotice(item.availability)}.` : ""].filter(Boolean).join(" ") })) },
      { title: "Hướng dẫn sử dụng", links: eligiblePosts.filter((post) => post.type === "guide").slice(0, maxPerSection).map((post) => ({ title: post.title, url: url(`/support/guides/${post.slug}`), description: post.excerpt })) },
      { title: "Tin tức", links: eligiblePosts.filter((post) => post.type !== "guide").slice(0, 20).map((post) => ({ title: post.title, url: url(`/news/${post.slug}`), description: post.excerpt })) },
      { title: "Kênh chính thức", links: official },
      { title: "Optional", links: [...visiblePages.filter((entry) => entry.legal).map((entry) => entry.link), { title: "Sơ đồ website (sitemap)", url: url("/sitemap.xml") }, { title: "Nguồn cấp RSS tin tức", url: url("/feed.xml") }] },
    ],
  });
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=300" } });
}

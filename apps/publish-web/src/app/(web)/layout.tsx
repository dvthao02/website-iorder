import Image from "next/image";
import type { ReactNode } from "react";
import { getSiteProfile } from "@/lib/backend";
import { getMediaById } from "@/lib/backend";
import { getNavigation } from "@/lib/backend";
import type { NavigationItems } from "@iorder/core/server/navigation/navigation.contract";
import { getExternalLinks } from "@/lib/backend";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [profile, footerNavigation, externalLinks] = await Promise.all([getSiteProfile(), getNavigation("footer"), getExternalLinks()]);
  const footerItems = footerNavigation ?? [];
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  const externalItems = externalLinks ? [["Đăng nhập ứng dụng", externalLinks.appLogin], ["Dùng thử", externalLinks.trial], ["Facebook", externalLinks.facebook], ["Zalo", externalLinks.zalo], ["YouTube", externalLinks.youtube], ["App Store", externalLinks.appStore], ["Google Play", externalLinks.googlePlay]].filter((item): item is [string, string] => Boolean(item[1])) : [];
  return <div className="site-shell">{children}{profile || footerItems.length > 0 || externalItems.length > 0 ? <footer className="site-footer">
    <div className="site-footer__inner">
      {profile ? <section className="site-footer__profile">
        {logo ? <Image src={logo.url} alt={profile.companyName} width={160} height={80} className="h-auto w-40" /> : null}
        <strong>{profile.companyName}</strong>
        {profile.legalName ? <p>{profile.legalName}</p> : null}
        {profile.address ? <address>{profile.address}</address> : null}
        {profile.hotline ? <p>Hotline: {profile.hotline}</p> : null}
        {profile.supportEmail ? <a href={`mailto:${profile.supportEmail}`}>Hỗ trợ: {profile.supportEmail}</a> : null}
        {profile.salesEmail ? <a href={`mailto:${profile.salesEmail}`}>Kinh doanh: {profile.salesEmail}</a> : null}
        {profile.workingHours ? <p>Giờ làm việc: {profile.workingHours}</p> : null}
      </section> : null}
      {footerItems.filter(item => item.parentKey === null && item.isEnabled).length > 0 ? <nav className="site-footer__navigation" aria-label="Điều hướng chân trang"><FooterBranch items={footerItems} parentKey={null} /></nav> : null}
      {externalItems.length > 0 ? <nav className="site-footer__external" aria-label="Liên kết ngoài"><p>Liên kết nhanh</p><ul>{externalItems.map(([label, href]) => <li key={href}><a href={href} target="_blank" rel="noopener noreferrer">{label}</a></li>)}</ul></nav> : null}
    </div>
  </footer> : null}</div>;
}

function FooterBranch({ items, parentKey }: { items: NavigationItems; parentKey: string | null }) {
  return <ul className={parentKey === null ? "site-footer__groups" : "site-footer__links"}>{items.filter(item => item.parentKey === parentKey && item.isEnabled).map(item => <li key={item.key}><Link className={parentKey === null ? "site-footer__group-title" : undefined} href={item.url} target={item.target} rel={item.target === "_blank" ? "noopener noreferrer" : undefined}>{item.label}</Link>{items.some(child => child.parentKey === item.key && child.isEnabled) ? <FooterBranch items={items} parentKey={item.key} /> : null}</li>)}</ul>;
}

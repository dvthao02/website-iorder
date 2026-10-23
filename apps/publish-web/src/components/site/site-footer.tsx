import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { NavigationItems } from "@iorder/core/server/navigation/navigation.contract";
import type { ExternalLinks } from "@iorder/core/server/settings/external-links.contract";
import { getMediaById } from "@/lib/backend";
import { descendantsOf } from "@/lib/navigation-tree";
import { FacebookIcon, YouTubeIcon, ZaloIcon } from "./brand-icons";

type Profile = { companyName: string; legalName: string | null; hotline: string | null; supportEmail: string | null; salesEmail: string | null; address: string | null; workingHours: string | null; logoMediaId: string | null } | null;

// Dòng cuối chân trang: ghi công phát triển và chứng nhận DMCA (cố định theo website iOrder).
const developer = { label: "iOrder.vn", href: "https://iorder.vn/" };
const dmcaUrl = "https://www.dmca.com/Protection/Status.aspx?ID=55ed00a2-083d-43ee-ac48-18341d415669&refurl=https://iorder.vn/";

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// Mạng xã hội: logo đúng màu thương hiệu trong nút tròn trắng; kho ứng dụng: nút viên thuốc.
const socialOrder: Array<[keyof ExternalLinks, string, ReactNode]> = [["facebook", "Facebook", <FacebookIcon key="facebook" size={22} />], ["zalo", "Zalo", <ZaloIcon key="zalo" size={22} />], ["youtube", "YouTube", <YouTubeIcon key="youtube" size={22} />]];
const storeOrder: Array<[keyof ExternalLinks, string]> = [["appStore", "App Store"], ["googlePlay", "Google Play"]];
// Lối vào ứng dụng (đăng nhập, dùng thử): cùng kiểu nút viên thuốc với kho ứng dụng.
const appLinkOrder: Array<[keyof ExternalLinks, string]> = [["appLogin", "Đăng nhập ứng dụng"], ["trial", "Dùng thử"]];

// Chân trang: cột thông tin doanh nghiệp (có biểu tượng), các cột menu chân trang từ CMS, dòng bản quyền.
export async function SiteFooter({ profile, navigation, externalLinks, tagline }: { profile: Profile; navigation: NavigationItems; externalLinks: ExternalLinks | null; tagline: string | null }) {
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  const items = navigation.filter((item) => item.isEnabled);
  const groups = items.filter((item) => item.parentKey === null);
  const socials = socialOrder.filter(([key]) => externalLinks?.[key]);
  const stores = storeOrder.filter(([key]) => externalLinks?.[key]);
  const contact = [
    profile?.address ? { icon: MapPin, label: profile.address, href: null } : null,
    profile?.hotline ? { icon: Phone, label: profile.hotline, href: tel(profile.hotline) } : null,
    profile?.supportEmail ? { icon: Mail, label: profile.supportEmail, href: `mailto:${profile.supportEmail}` } : null,
    profile?.workingHours ? { icon: Clock, label: profile.workingHours, href: null } : null,
  ].filter((entry) => entry !== null);
  const appLinks = appLinkOrder.filter(([key]) => externalLinks?.[key]);
  if (!profile && !groups.length && !appLinks.length && !stores.length && !socials.length) return null;

  return <footer className="site-footer">
    <div className="site-footer__inner" style={{ "--footer-columns": Math.max(groups.length, 1) } as CSSProperties}>
      <section className="site-footer__profile" aria-label="Thông tin liên hệ">
        <Link aria-label={`${profile?.companyName ?? "iOrder"} - Trang chủ`} className="site-footer__logo" href="/">{logo ? <Image alt={logo.altText ?? profile?.companyName ?? "iOrder"} className="h-9 w-auto" height={72} src={logo.url} width={180} /> : <strong>{profile?.companyName}</strong>}</Link>
        {tagline ? <p className="site-footer__tagline">{tagline}</p> : null}
        {profile?.legalName ? <p className="site-footer__legal">{profile.legalName}</p> : null}
        <ul className="site-footer__contact">{contact.map(({ icon: Icon, label, href }) => <li key={label}><span aria-hidden="true" className="site-footer__contact-icon"><Icon size={16} /></span>{href ? <a href={href}>{label}</a> : <span>{label}</span>}</li>)}</ul>
        {appLinks.length || stores.length || socials.length ? <div className="site-footer__apps">
          {appLinks.length ? <ul aria-label="Ứng dụng iOrder" className="site-footer__stores">{appLinks.map(([key, label]) => <li key={key}><a href={externalLinks![key]!} rel="noopener noreferrer" target="_blank">{label}</a></li>)}</ul> : null}
          {stores.length ? <ul aria-label="Tải ứng dụng" className="site-footer__stores">{stores.map(([key, label]) => <li key={key}><a href={externalLinks![key]!} rel="noopener noreferrer" target="_blank">{label}</a></li>)}</ul> : null}
          {socials.length ? <ul aria-label="Mạng xã hội" className="site-footer__socials">{socials.map(([key, label, mark]) => <li key={key}><a aria-label={label} href={externalLinks![key]!} rel="noopener noreferrer" target="_blank" title={label}>{mark}</a></li>)}</ul> : null}
        </div> : null}
      </section>
      {groups.map((group) => <nav aria-label={group.label} className="site-footer__column" key={group.key}>
        {group.url && group.url !== "#" ? <Link className="site-footer__heading" href={group.url} rel={group.target === "_blank" ? "noopener noreferrer" : undefined} target={group.target}>{group.label}</Link> : <p className="site-footer__heading">{group.label}</p>}
        <ul>{descendantsOf(items, group.key).map((item) => <li key={item.key}><Link href={item.url} rel={item.target === "_blank" ? "noopener noreferrer" : undefined} target={item.target}>{item.label}</Link></li>)}</ul>
      </nav>)}
    </div>
    <div className="site-footer__bottom">
      <p>© {new Date().getFullYear()} Sản phẩm phát triển bởi <a className="site-footer__developer" href={developer.href} rel="noopener noreferrer" target="_blank">{developer.label}</a></p>
      <a className="site-footer__dmca" href={dmcaUrl} rel="noopener noreferrer" target="_blank" title="Trạng thái bảo vệ bản quyền DMCA">DMCA Protected</a>
    </div>
  </footer>;
}

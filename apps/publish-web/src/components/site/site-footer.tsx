import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Clock, Headphones, Mail, Phone } from "lucide-react";
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

// Mạng xã hội: logo đúng màu thương hiệu trong nút tròn; kho ứng dụng: nút viên thuốc.
const socialOrder: Array<[keyof ExternalLinks, string, ReactNode]> = [["facebook", "Facebook", <FacebookIcon key="facebook" size={20} />], ["zalo", "Zalo", <ZaloIcon key="zalo" size={20} />], ["youtube", "YouTube", <YouTubeIcon key="youtube" size={20} />]];
const storeOrder: Array<[keyof ExternalLinks, string]> = [["appStore", "App Store"], ["googlePlay", "Google Play"]];
// Đăng nhập ứng dụng và Đăng ký dùng thử đã có ở header (luôn hiện khi cuộn) nên chân trang không lặp lại.

type ContactTile = { icon: typeof Phone; label: string; value: string; href: string | null };

// Chân trang nền tối (khép trang, tách khỏi phần nội dung), theo nhịp của các website cùng lĩnh vực:
// 1) hàng ô liên hệ (hotline, email kinh doanh, email hỗ trợ, giờ làm việc — lấy từ Cài đặt › Thông tin website);
// 2) cột thương hiệu (logo, mô tả, mạng xã hội, kho ứng dụng) + các cột menu chân trang từ CMS;
// 3) dải pháp lý: tên công ty, địa chỉ; bản quyền, DMCA, đơn vị phát triển.
export async function SiteFooter({ profile, navigation, externalLinks, tagline }: { profile: Profile; navigation: NavigationItems; externalLinks: ExternalLinks | null; tagline: string | null }) {
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  const items = navigation.filter((item) => item.isEnabled);
  const groups = items.filter((item) => item.parentKey === null);
  const socials = socialOrder.filter(([key]) => externalLinks?.[key]);
  const stores = storeOrder.filter(([key]) => externalLinks?.[key]);
  const emails = [profile?.salesEmail, profile?.supportEmail].filter((email, index, list): email is string => Boolean(email) && list.indexOf(email) === index);
  const tiles: ContactTile[] = [
    profile?.hotline ? { icon: Phone, label: "Hotline tư vấn", value: profile.hotline, href: tel(profile.hotline) } : null,
    emails[0] ? { icon: Mail, label: emails.length > 1 ? "Email kinh doanh" : "Email", value: emails[0], href: `mailto:${emails[0]}` } : null,
    emails[1] ? { icon: Headphones, label: "Email hỗ trợ", value: emails[1], href: `mailto:${emails[1]}` } : null,
    profile?.workingHours ? { icon: Clock, label: "Giờ làm việc", value: profile.workingHours, href: null } : null,
  ].filter((tile) => tile !== null);
  if (!profile && !groups.length && !stores.length && !socials.length) return null;
  const companyName = profile?.companyName ?? "iOrder";

  return <footer className="site-footer">
    <div className="site-footer__frame">
      {tiles.length ? <ul aria-label="Liên hệ iOrder" className="site-footer__tiles" style={{ "--footer-tiles": tiles.length } as CSSProperties}>{tiles.map(({ icon: Icon, label, value, href }) => <li key={label}>
        {href ? <a className="site-footer__tile" href={href}><TileBody Icon={Icon} label={label} value={value} /></a> : <div className="site-footer__tile"><TileBody Icon={Icon} label={label} value={value} /></div>}
      </li>)}</ul> : null}

      <div className="site-footer__inner" style={{ "--footer-columns": Math.max(groups.length, 1) } as CSSProperties}>
        <section aria-label={`Giới thiệu ${companyName}`} className="site-footer__profile">
          <Link aria-label={`${companyName} - Trang chủ`} className="site-footer__logo" href="/">{logo ? <Image alt={logo.altText ?? companyName} className="h-9 w-auto" height={72} src={logo.url} width={180} /> : <strong>{companyName}</strong>}</Link>
          {tagline ? <p className="site-footer__tagline">{tagline}</p> : null}
          {socials.length ? <ul aria-label="Mạng xã hội" className="site-footer__socials">{socials.map(([key, label, mark]) => <li key={key}><a aria-label={label} href={externalLinks![key]!} rel="noopener noreferrer" target="_blank" title={label}>{mark}</a></li>)}</ul> : null}
          {stores.length ? <ul aria-label="Tải ứng dụng" className="site-footer__stores">{stores.map(([key, label]) => <li key={key}><a href={externalLinks![key]!} rel="noopener noreferrer" target="_blank">{label}</a></li>)}</ul> : null}
        </section>
        {groups.map((group) => <nav aria-label={group.label} className="site-footer__column" key={group.key}>
          {group.url && group.url !== "#" ? <Link className="site-footer__heading" href={group.url} rel={group.target === "_blank" ? "noopener noreferrer" : undefined} target={group.target}>{group.label}</Link> : <p className="site-footer__heading">{group.label}</p>}
          <ul>{descendantsOf(items, group.key).map((item) => <li key={item.key}><Link href={item.url} rel={item.target === "_blank" ? "noopener noreferrer" : undefined} target={item.target}>{item.label}</Link></li>)}</ul>
        </nav>)}
      </div>

      <div className="site-footer__bottom">
        <div className="site-footer__company">
          {profile?.legalName ? <p className="site-footer__legal">{profile.legalName}</p> : null}
          {profile?.address ? <p>{profile.address}</p> : null}
        </div>
        <div className="site-footer__meta">
          <p>© {new Date().getFullYear()} {companyName} · Phát triển bởi <a className="site-footer__developer" href={developer.href} rel="noopener noreferrer" target="_blank">{developer.label}</a></p>
          <a className="site-footer__dmca" href={dmcaUrl} rel="noopener noreferrer" target="_blank" title="Trạng thái bảo vệ bản quyền DMCA">DMCA Protected</a>
        </div>
      </div>
    </div>
  </footer>;
}

function TileBody({ Icon, label, value }: { Icon: typeof Phone; label: string; value: string }) {
  return <><span aria-hidden="true" className="site-footer__tile-icon"><Icon size={20} /></span><span className="site-footer__tile-text"><span className="site-footer__tile-label">{label}</span><span className="site-footer__tile-value">{value}</span></span></>;
}

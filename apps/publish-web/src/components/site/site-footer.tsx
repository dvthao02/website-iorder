import Image from "next/image";
import { SiteLink as Link } from "@/components/site/site-link";
import type { CSSProperties, ReactNode } from "react";
import { BookOpen, Box, Building2, Clock, Headphones, Mail, Phone, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import type { NavigationItems } from "@iorder/core/server/navigation/navigation.contract";
import type { ExternalLinks } from "@iorder/core/server/settings/external-links.contract";
import { getMediaById } from "@/lib/backend";
import { descendantsOf } from "@/lib/navigation-tree";
import { AppleIcon, FacebookIcon, GooglePlayIcon, YouTubeIcon, ZaloIcon } from "./brand-icons";

type Profile = { companyName: string; legalName: string | null; hotline: string | null; supportEmail: string | null; salesEmail: string | null; address: string | null; workingHours: string | null; logoMediaId: string | null } | null;

// Dòng cuối chân trang: ghi công phát triển và chứng nhận DMCA (cố định theo website iOrder).
const developer = { label: "iOrder.vn", href: "https://iorder.vn/" };
const dmcaUrl = "https://www.dmca.com/Protection/Status.aspx?ID=55ed00a2-083d-43ee-ac48-18341d415669&refurl=https://iorder.vn/";

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

// Mạng xã hội: logo đúng màu thương hiệu trong nút tròn trắng.
const socialOrder: Array<[keyof ExternalLinks, string, ReactNode]> = [["facebook", "Facebook", <FacebookIcon key="facebook" size={24} />], ["zalo", "Zalo", <ZaloIcon key="zalo" size={24} />], ["youtube", "YouTube", <YouTubeIcon key="youtube" size={24} />]];
// Kho ứng dụng: nút nền đen kiểu huy hiệu (dòng nhỏ + tên kho).
const storeOrder: Array<[keyof ExternalLinks, string, string, ReactNode]> = [["appStore", "Download on the", "App Store", <AppleIcon key="apple" size={22} />], ["googlePlay", "GET IT ON", "Google Play", <GooglePlayIcon key="play" size={20} />]];
// Đăng nhập ứng dụng và Đăng ký dùng thử đã có ở header (luôn hiện khi cuộn) nên chân trang không lặp lại.

// Biểu tượng tiêu đề cột menu chân trang: chọn theo đường dẫn của nhóm (slug ổn định, không đổi khi sửa nhãn).
const columnIcons: { keys: string[]; icon: LucideIcon }[] = [
  { keys: ["phan-mem", "san-pham"], icon: Box },
  { keys: ["giai-phap", "dich-vu"], icon: Settings },
  { keys: ["huong-dan", "ho-tro", "tin-tuc", "tai-nguyen"], icon: BookOpen },
  { keys: ["gioi-thieu", "cong-ty", "lien-he"], icon: Building2 },
];
const columnIcon = (url: string) => columnIcons.find((entry) => entry.keys.some((key) => url.includes(key)))?.icon ?? null;

// Tên pháp lý in hoa (CÔNG TY TNHH …): phần loại hình viết thường cho dễ đọc, tên riêng giữ in hoa và in đậm.
function LegalName({ value }: { value: string }) {
  const match = /^(CÔNG TY (?:TNHH|CỔ PHẦN|CP)(?: [A-ZÀ-Ỹ]+ THÀNH VIÊN)?)\s+(.+)$/u.exec(value);
  if (!match) return <strong>{value}</strong>;
  const kind = match[1].toLocaleLowerCase("vi").replace(/^công ty/, "Công ty").replace(/tnhh/, "TNHH");
  return <>{kind} <strong>{match[2]}</strong></>;
}

type ContactItem = { icon: LucideIcon; label: string; value: string; href: string | null };

// Chân trang tông trắng – xanh như toàn website (theo mẫu người dùng duyệt):
// 1) thanh liên hệ trắng bo tròn, 4 mục ngăn bằng vạch dọc (hotline, email kinh doanh, email hỗ trợ, giờ làm việc — từ Cài đặt);
// 2) cột thương hiệu (logo, mô tả mặc định, mạng xã hội, nút kho ứng dụng) | vạch dọc | các cột menu chân trang từ CMS,
//    tiêu đề có biểu tượng (không vạch nhấn);
// 3) dải cuối căn giữa: © năm – đơn vị phát triển | tên pháp lý | nhãn DMCA.
export async function SiteFooter({ profile, navigation, externalLinks, tagline }: { profile: Profile; navigation: NavigationItems; externalLinks: ExternalLinks | null; tagline: string | null }) {
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  const items = navigation.filter((item) => item.isEnabled);
  const groups = items.filter((item) => item.parentKey === null);
  const socials = socialOrder.filter(([key]) => externalLinks?.[key]);
  const stores = storeOrder.filter(([key]) => externalLinks?.[key]);
  const emails = [profile?.salesEmail, profile?.supportEmail].filter((email, index, list): email is string => Boolean(email) && list.indexOf(email) === index);
  const contacts: ContactItem[] = [
    profile?.hotline ? { icon: Phone, label: "Hotline tư vấn", value: profile.hotline, href: tel(profile.hotline) } : null,
    emails[0] ? { icon: Mail, label: emails.length > 1 ? "Email kinh doanh" : "Email", value: emails[0], href: `mailto:${emails[0]}` } : null,
    emails[1] ? { icon: Headphones, label: "Email hỗ trợ", value: emails[1], href: `mailto:${emails[1]}` } : null,
    profile?.workingHours ? { icon: Clock, label: "Giờ làm việc", value: profile.workingHours, href: null } : null,
  ].filter((item) => item !== null);
  if (!profile && !groups.length && !stores.length && !socials.length) return null;
  const companyName = profile?.companyName ?? "iOrder";

  return <footer className="site-footer">
    <div className="site-footer__frame">
      {contacts.length ? <ul aria-label="Liên hệ iOrder" className="site-footer__contacts" style={{ "--footer-contacts": contacts.length } as CSSProperties}>{contacts.map(({ icon: Icon, label, value, href }) => {
        const body = <><span aria-hidden="true" className="site-footer__contact-icon"><Icon size={22} strokeWidth={1.8} /></span><span className="site-footer__contact-text"><span className="site-footer__contact-label">{label}</span><span className="site-footer__contact-value">{value}</span></span></>;
        return <li key={label}>{href ? <a className="site-footer__contact" href={href}>{body}</a> : <div className="site-footer__contact">{body}</div>}</li>;
      })}</ul> : null}

      <div className="site-footer__inner" style={{ "--footer-columns": Math.max(groups.length, 1) } as CSSProperties}>
        <section aria-label={`Giới thiệu ${companyName}`} className="site-footer__profile">
          <Link aria-label={`${companyName} - Trang chủ`} className="site-footer__logo" href="/">{logo ? <Image alt={logo.altText ?? companyName} className="h-12 w-auto" height={96} src={logo.url} width={240} /> : <strong>{companyName}</strong>}</Link>
          {tagline ? <p className="site-footer__tagline">{tagline}</p> : null}
          {socials.length ? <ul aria-label="Mạng xã hội" className="site-footer__socials">{socials.map(([key, label, mark]) => <li key={key}><a aria-label={label} href={externalLinks![key]!} rel="noopener noreferrer" target="_blank" title={label}>{mark}</a></li>)}</ul> : null}
          {stores.length ? <ul aria-label="Tải ứng dụng" className="site-footer__stores">{stores.map(([key, caption, name, mark]) => <li key={key}><a aria-label={`${caption} ${name}`} href={externalLinks![key]!} rel="noopener noreferrer" target="_blank">{mark}<span><small>{caption}</small>{name}</span></a></li>)}</ul> : null}
        </section>
        <div className="site-footer__columns">{groups.map((group) => {
          const Icon = columnIcon(group.url ?? "");
          const heading = <>{Icon ? <Icon aria-hidden="true" className="site-footer__heading-icon" size={30} strokeWidth={1.6} /> : null}<span>{group.label}</span></>;
          return <nav aria-label={group.label} className="site-footer__column" key={group.key}>
            {group.url && group.url !== "#" ? <Link className="site-footer__heading" href={group.url} rel={group.target === "_blank" ? "noopener noreferrer" : undefined} target={group.target}>{heading}</Link> : <p className="site-footer__heading">{heading}</p>}
            <ul>{descendantsOf(items, group.key).map((item) => <li key={item.key}><Link href={item.url} rel={item.target === "_blank" ? "noopener noreferrer" : undefined} target={item.target}>{item.label}</Link></li>)}</ul>
          </nav>;
        })}</div>
      </div>

      <div className="site-footer__bottom">
        <p className="site-footer__copyright">
          <span>© {new Date().getFullYear()} {companyName} - Phát triển bởi <a className="site-footer__developer" href={developer.href} rel="noopener noreferrer" target="_blank">{developer.label}</a></span>
          {profile?.legalName ? <span className="site-footer__legal"><LegalName value={profile.legalName} /></span> : null}
        </p>
        <a className="site-footer__dmca" href={dmcaUrl} rel="noopener noreferrer" target="_blank" title="Trạng thái bảo vệ bản quyền DMCA"><ShieldCheck aria-hidden="true" size={20} />DMCA Protected</a>
      </div>
    </div>
  </footer>;
}

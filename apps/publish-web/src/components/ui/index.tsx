import Link from "next/link";
import { Check, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { BlockFrame } from "@iorder/core/server/pages/block-layout";

/*
 * Bộ component nền của website. Mọi khối trang ghép từ các viên gạch này, nên giao diện
 * toàn site chỉnh ở đây (bố cục, khoảng cách, kiểu chữ) và ở globals.css @theme (màu, font, thang chữ).
 * Quy ước: chữ dùng thang text-display / text-h2 / text-h3 / text-lead / text-body / text-small / text-caption;
 * màu dùng token (ink, muted, faint, line, subtle, brand-*, accent-*), không dùng màu Tailwind trực tiếp;
 * bo góc chỉ rounded-card (khung, ảnh) và rounded-control (nút, ô biểu tượng).
 * CMS không quyết giao diện: nó chỉ gửi nội dung và lựa chọn nền/khoảng cách trong vỏ chung.
 */

export type ActionData = { label: string; href: string };
const isExternal = (href: string) => /^https?:\/\//i.test(href);

// Khung ngang chuẩn của mọi phần trang.
export function Container({ children, width = "default", className = "" }: { children: ReactNode; width?: "default" | "narrow" | "text"; className?: string }) {
  // Khung mặc định = .site-container (rộng dần theo màn hình); hẹp/đọc chữ giữ bề ngang dễ đọc.
  const base = width === "narrow" ? "mx-auto w-full max-w-4xl px-6" : width === "text" ? "mx-auto w-full max-w-3xl px-6" : "site-container";
  return <div className={`${base} ${className}`.trim()}>{children}</div>;
}

const tones = { white: "bg-white", tinted: "bg-surface-tinted", dark: "bg-navy text-white", plain: "" } as const;
const spacing = { sm: "py-10 sm:py-14", md: "py-14 sm:py-20", lg: "py-20 sm:py-28" } as const;
export type SectionTone = keyof typeof tones;
export type SectionSpace = keyof typeof spacing;

// Một phần trang: nền + khoảng cách trên dưới + khung ngang. Cao theo nội dung (chỉ phần đầu trang chiếm cả màn hình).
export function Section({ children, tone = "plain", space = "md", width = "default", id, label, className = "" }: { children: ReactNode; tone?: SectionTone; space?: SectionSpace; width?: "default" | "narrow" | "text"; id?: string | null; label?: string; className?: string }) {
  return <section aria-label={label} className={`${id ? "scroll-mt-20" : ""} ${tones[tone]} ${className}`.trim()} id={id ?? undefined}><Container className={spacing[space]} width={width}>{children}</Container></section>;
}

// Phần trang của một khối: nền, khoảng cách, mã neo lấy từ vỏ chung (resolveBlockFrames).
export function FrameSection({ frame, children, width, label, className }: { frame: BlockFrame; children: ReactNode; width?: "default" | "narrow" | "text"; label?: string; className?: string }) {
  return <Section className={className} id={frame.anchor} label={label} space={frame.spacing} tone={frame.tone} width={width}>{children}</Section>;
}
// Khối dùng ngoài trang ghép khối (ví dụ bảng giá trên trang sản phẩm) dùng khung mặc định này.
export const defaultFrame: BlockFrame = { tone: "white", spacing: "md", anchor: null };

// Dòng giới thiệu nhỏ phía trên tiêu đề: nhãn bo tròn nền nhạt, dấu ✓ thương hiệu iOrder.
export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-small font-semibold ${dark ? "bg-white/12 text-white" : "bg-brand-50 text-brand-700"}`}><CircleCheck aria-hidden="true" size={16} />{children}</p>;
}

// Phần đầu của mỗi khối: dòng giới thiệu, tiêu đề, mô tả. Mặc định căn giữa như các website phần mềm
// bán hàng (KiotViet, Sapo) và cách nội dung bên dưới một khoảng chuẩn; khối hai cột truyền align="left", className="".
export function SectionHeading({ eyebrow, title, description, align = "center", level = "h2", size = "md", dark = false, className = "mb-10 sm:mb-12" }: { eyebrow?: string | null; title?: string | null; description?: string | null; align?: "left" | "center"; level?: "h1" | "h2"; size?: "sm" | "md" | "lg"; dark?: boolean; className?: string }) {
  if (!eyebrow && !title && !description) return null;
  const Heading = level;
  const titleSize = size === "lg" ? "text-display" : size === "sm" ? "text-h3" : "text-h2";
  return <div className={`${align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"} ${className}`.trim()}>
    {eyebrow ? <Eyebrow dark={dark}>{eyebrow}</Eyebrow> : null}
    {title ? <Heading className={`mb-0 font-bold tracking-tight text-balance ${titleSize} ${dark ? "text-white" : "text-ink"}`}>{title}</Heading> : null}
    {description ? <p className={`mt-3 mb-0 text-lead whitespace-pre-line ${dark ? "text-white/80" : "text-muted"}`}>{description}</p> : null}
  </div>;
}

// Tiêu đề và chữ thân của một thẻ (lưới thẻ, bảng giá, nhóm…): cùng một cỡ ở mọi khối.
export function CardTitle({ children, as: Tag = "h3", className = "" }: { children: ReactNode; as?: "h2" | "h3"; className?: string }) {
  return <Tag className={`mb-0 text-h3 font-bold tracking-tight text-ink ${className}`.trim()}>{children}</Tag>;
}
export function CardText({ children, className = "mt-2" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-0 text-body whitespace-pre-line text-muted ${className}`.trim()}>{children}</p>;
}

/**
 * Số cột của lưới thẻ theo số mục, chung cho mọi khối: 1 mục ở giữa, 2 mục hai cột (khung vừa),
 * 4 mục (hoặc bội của 4, khi khối cho phép) bốn cột trên màn rộng, còn lại ba cột.
 */
export function gridColumns(count: number, max: 3 | 4 = 3) {
  if (count <= 1) return "mx-auto w-full max-w-xl";
  if (count === 2) return "mx-auto w-full max-w-5xl md:grid-cols-2";
  if (max === 4 && count % 4 === 0) return "sm:grid-cols-2 xl:grid-cols-4";
  if (count === 4) return "mx-auto w-full max-w-5xl md:grid-cols-2";
  return "md:grid-cols-2 lg:grid-cols-3";
}

// Màu nhấn xoay vòng theo thứ tự (token accent-* trong globals.css).
const accents = ["bg-accent-blue-soft text-accent-blue", "bg-accent-amber-soft text-accent-amber", "bg-accent-violet-soft text-accent-violet", "bg-accent-green-soft text-accent-green", "bg-accent-rose-soft text-accent-rose", "bg-accent-cyan-soft text-accent-cyan"] as const;
export function accentClass(index: number) { return accents[index % accents.length]; }

// Ô vuông chứa biểu tượng hoặc số thứ tự ở đầu thẻ.
export function IconTile({ children, accent = 0, size = "md" }: { children: ReactNode; accent?: number; size?: "md" | "lg" }) {
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-control text-small font-bold ${size === "lg" ? "size-14" : "size-12"} ${accentClass(accent)}`}>{children}</span>;
}

// Nút dạng liên kết; liên kết ngoài mở tab mới.
export type ButtonVariant = "primary" | "secondary" | "light" | "outline-light";
export function ButtonLink({ action, variant = "primary", full = false, className = "", tabIndex }: { action: ActionData; variant?: ButtonVariant; full?: boolean; className?: string; tabIndex?: number }) {
  const classes = `button button--${variant} ${full ? "w-full" : ""} ${className}`.trim();
  return isExternal(action.href)
    ? <a className={classes} href={action.href} rel="noopener noreferrer" tabIndex={tabIndex} target="_blank">{action.label}</a>
    : <Link className={classes} href={action.href} tabIndex={tabIndex}>{action.label}</Link>;
}

// Liên kết chữ (trong thẻ, cuối nhóm…): nội bộ dùng Link, ngoài trang mở tab mới.
export function TextLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return isExternal(href) ? <a className={className} href={href} rel="noopener noreferrer" target="_blank">{children}</a> : <Link className={className} href={href}>{children}</Link>;
}

// Hàng nút: chính + phụ (phụ đổi sang viền sáng khi nằm trên nền tối/ảnh).
export function Actions({ primary, secondary, dark = false, center = false, className = "mt-8" }: { primary?: ActionData | null; secondary?: ActionData | null; dark?: boolean; center?: boolean; className?: string }) {
  if (!primary && !secondary) return null;
  return <div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""} ${className}`.trim()}>
    {primary ? <ButtonLink action={primary} variant="primary" /> : null}
    {secondary ? <ButtonLink action={secondary} variant={dark ? "outline-light" : "secondary"} /> : null}
  </div>;
}

// Thẻ: viền + nền trắng + bóng nhẹ; có liên kết thì cả thẻ bấm được và nổi lên khi rê chuột.
// `flush`: thẻ không đệm, để ảnh tràn sát mép (thẻ ảnh); phần chữ tự đặt đệm riêng.
const cardBase = "group relative flex h-full flex-col rounded-card border bg-white text-ink transition";
export function Card({ children, href, highlighted = false, flush = false, className = "", as = "article" }: { children: ReactNode; href?: string | null; highlighted?: boolean; flush?: boolean; className?: string; as?: "article" | "li" | "figure" | "div" }) {
  const look = `${cardBase} ${flush ? "overflow-hidden" : "p-6 sm:p-7"} ${highlighted ? "border-brand-500 shadow-raised ring-1 ring-brand-500" : "border-line shadow-card"} ${className}`.trim();
  const interactive = `${look} hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-raised`;
  if (href) return isExternal(href) ? <a className={interactive} href={href} rel="noopener noreferrer" target="_blank">{children}</a> : <Link className={interactive} href={href}>{children}</Link>;
  const Tag = as;
  return <Tag className={look}>{children}</Tag>;
}

// Danh sách có dấu ✓.
export function CheckList({ items, className = "mt-7", dark = false }: { items: string[]; className?: string; dark?: boolean }) {
  if (!items.length) return null;
  return <ul className={`grid gap-3 text-body ${className}`}>{items.map((item, index) => <li className={`flex items-start gap-3 ${dark ? "text-white" : "text-ink"}`} key={`${item}-${index}`}>
    <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${dark ? "bg-white/15 text-white" : "bg-brand-100 text-brand-700"}`}><Check aria-hidden="true" size={15} strokeWidth={3} /></span>{item}
  </li>)}</ul>;
}

// Câu hỏi thường gặp dạng mở/đóng (khối FAQ của trang và trang chi tiết sản phẩm dùng chung).
export function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return <div className="grid gap-3">{items.map((item, index) => <details className="group rounded-card border border-line bg-white px-6 py-1 shadow-card open:border-brand-200" key={`${item.question}-${index}`}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lead font-semibold text-ink [&::-webkit-details-marker]:hidden">{item.question}<span aria-hidden className="text-h3 leading-none text-brand-700 transition group-open:rotate-45">+</span></summary>
    <p className="pb-5 text-body whitespace-pre-line text-muted">{item.answer}</p>
  </details>)}</div>;
}

// Nhãn nhỏ (ví dụ "Phổ biến", "Nổi bật").
export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full bg-brand-600 px-3 py-1 text-caption font-bold text-white ${className}`.trim()}>{children}</span>;
}

// Dòng "Xem thêm →" ở cuối thẻ có liên kết.
export function MoreLink({ children = "Xem thêm" }: { children?: ReactNode }) {
  return <span className="mt-auto pt-5 text-small font-semibold text-brand-700 group-hover:underline">{children} →</span>;
}

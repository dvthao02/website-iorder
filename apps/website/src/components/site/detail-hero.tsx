import Image from "next/image";
import { SiteLink as Link } from "@/components/site/site-link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Actions, type ActionData } from "@/components/ui";

type DetailImage = { url: string; alt: string; width?: number | null; height?: number | null };

// Phần đầu của trang chi tiết (sản phẩm, giải pháp, dịch vụ, thiết bị, bài viết): cùng kiểu với "Phần đầu trang"
// của trang chủ — nằm dưới header trong suốt, chữ trái ảnh phải, nhãn chip, nút.
// `fill`: cao đúng một màn hình trên máy tính (.screen-hero); bài viết để `false` cho người đọc thấy ngay nội dung.
// `product`: ảnh sản phẩm nằm trong khung 4:3 nền nhạt (ảnh nền trong suốt vẫn gọn); mặc định ảnh bìa bo góc.
export function DetailHero({ back, label, title, summary, image, imageStyle = "cover", primary, secondary, fill = true, layout = "split", background = "default", children }: {
  back: { href: string; label: string };
  label?: string | null;
  title: string;
  summary?: string | null;
  image?: DetailImage | null;
  imageStyle?: "cover" | "product";
  primary?: ActionData | null;
  secondary?: ActionData | null;
  fill?: boolean;
  /** Vị trí ảnh: chữ trái ảnh phải (mặc định), ảnh trái chữ phải, hoặc chữ căn giữa với ảnh bên dưới. */
  layout?: "split" | "split_reverse" | "centered";
  background?: "default" | "white" | "tinted";
  children?: ReactNode;
}) {
  const centered = layout === "centered";
  const surface = background === "white" ? "bg-white" : background === "tinted" ? "bg-surface-tinted" : "bg-[#f7f9fc]";
  const columns = !image || centered ? "" : layout === "split_reverse" ? "lg:grid-cols-[1fr_1.05fr] lg:gap-14" : "lg:grid-cols-[1.05fr_1fr] lg:gap-14";
  return <section className={`${fill ? "screen-hero" : ""} relative overflow-hidden border-b border-line ${surface}`} data-hero-top="light">
    <div className={`site-container grid items-center gap-10 py-10 sm:py-14 ${fill ? "lg:pt-0 lg:pb-28" : ""} ${columns}`}>
      <div className={`${image && !centered ? "" : "max-w-3xl"} ${centered ? "mx-auto text-center" : ""} ${layout === "split_reverse" && image ? "lg:order-2" : ""}`}>
        <Link className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand-700" href={back.href}><ArrowLeft aria-hidden="true" size={16} />{back.label}</Link>
        {label ? <p className="mb-3 text-small font-semibold text-brand-700" data-builder-field="category">{label}</p> : null}
        <h1 className="mb-0 text-[2.25rem] leading-[1.12] font-bold tracking-tight text-balance text-ink sm:text-5xl" data-builder-field="title">{title}</h1>
        {summary ? <p className="mt-5 text-lg leading-8 text-muted sm:text-xl" data-builder-field="summary">{summary}</p> : null}
        {children}
        <Actions center={centered} primary={primary} secondary={secondary} />
      </div>
      {image ? imageStyle === "product"
        ? <div className="rounded-card border border-line bg-white p-4 shadow-card"><Image alt={image.alt} className="aspect-[4/3] w-full rounded-xl bg-slate-50 object-contain p-4" height={image.height ?? 750} priority sizes="(min-width: 1024px) 50vw, 100vw" src={image.url} width={image.width ?? 1000} /></div>
        : <Image alt={image.alt} className="h-auto w-full rounded-card border border-line bg-white shadow-card" height={image.height ?? 630} priority sizes="(min-width: 1024px) 50vw, 100vw" src={image.url} width={image.width ?? 1200} /> : null}
    </div>
  </section>;
}

// Hàng nhãn nhỏ dưới mô tả (chủ đề, chuyên mục, thẻ).
export function ChipList({ items, label, field }: { items: { key: string; text: string; href?: string }[]; label: string; field?: string }) {
  if (!items.length) return null;
  const chip = "inline-flex rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-ink";
  return <ul aria-label={label} className="mt-6 flex flex-wrap gap-2" data-builder-field={field}>{items.map(item => <li key={item.key}>{item.href ? <Link className={`${chip} transition hover:border-brand-300 hover:text-brand-700`} href={item.href}>{item.text}</Link> : <span className={chip}>{item.text}</span>}</li>)}</ul>;
}

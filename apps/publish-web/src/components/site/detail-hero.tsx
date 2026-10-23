import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Actions, type ActionData } from "@/components/ui";

type DetailImage = { url: string; alt: string; width?: number | null; height?: number | null };

// Phần đầu của trang chi tiết (sản phẩm, giải pháp, dịch vụ, thiết bị, bài viết): cùng kiểu với "Phần đầu trang"
// của trang chủ — nằm dưới header trong suốt, chữ trái ảnh phải, nhãn chip, nút.
// `fill`: cao đúng một màn hình trên máy tính (.screen-hero); bài viết để `false` cho người đọc thấy ngay nội dung.
// `product`: ảnh sản phẩm nằm trong khung 4:3 nền nhạt (ảnh nền trong suốt vẫn gọn); mặc định ảnh bìa bo góc.
export function DetailHero({ back, label, title, summary, image, imageStyle = "cover", primary, secondary, fill = true, children }: {
  back: { href: string; label: string };
  label?: string | null;
  title: string;
  summary?: string | null;
  image?: DetailImage | null;
  imageStyle?: "cover" | "product";
  primary?: ActionData | null;
  secondary?: ActionData | null;
  fill?: boolean;
  children?: ReactNode;
}) {
  return <section className={`${fill ? "screen-hero" : ""} relative overflow-hidden border-b border-line bg-gradient-to-b from-brand-50/70 to-white`} data-hero-top="light">
    <div className={`site-container grid items-center gap-10 py-10 sm:py-14 ${fill ? "lg:pt-0 lg:pb-28" : ""} ${image ? "lg:grid-cols-[1.05fr_1fr] lg:gap-14" : ""}`}>
      <div className={image ? "" : "max-w-3xl"}>
        <Link className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand-700" href={back.href}><ArrowLeft aria-hidden="true" size={16} />{back.label}</Link>
        {label ? <p className="mb-4 flex w-fit items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">{label}</p> : null}
        <h1 className="mb-0 text-[2.25rem] leading-[1.12] font-bold tracking-tight text-balance text-ink sm:text-5xl">{title}</h1>
        {summary ? <p className="mt-5 text-lg leading-8 text-muted sm:text-xl">{summary}</p> : null}
        {children}
        <Actions primary={primary} secondary={secondary} />
      </div>
      {image ? imageStyle === "product"
        ? <div className="rounded-card border border-line bg-white p-4 shadow-card"><Image alt={image.alt} className="aspect-[4/3] w-full rounded-xl bg-slate-50 object-contain p-4" height={image.height ?? 750} priority sizes="(min-width: 1024px) 600px, 100vw" src={image.url} width={image.width ?? 1000} /></div>
        : <Image alt={image.alt} className="h-auto w-full rounded-card border border-line bg-white shadow-card" height={image.height ?? 630} priority sizes="(min-width: 1024px) 600px, 100vw" src={image.url} width={image.width ?? 1200} /> : null}
    </div>
  </section>;
}

// Hàng nhãn nhỏ dưới mô tả (chủ đề, chuyên mục, thẻ).
export function ChipList({ items, label }: { items: { key: string; text: string; href?: string }[]; label: string }) {
  if (!items.length) return null;
  const chip = "inline-flex rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-ink";
  return <ul aria-label={label} className="mt-6 flex flex-wrap gap-2">{items.map(item => <li key={item.key}>{item.href ? <Link className={`${chip} transition hover:border-brand-300 hover:text-brand-700`} href={item.href}>{item.text}</Link> : <span className={chip}>{item.text}</span>}</li>)}</ul>;
}

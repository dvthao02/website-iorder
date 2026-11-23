import Image from "next/image";
import { SiteLink as Link } from "@/components/site/site-link";
import { ArrowLeft } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { BlockAppearance } from "@iorder/shared/server/shared/appearance";
import { isDarkColor } from "@iorder/shared/server/shared/color";
import { Actions, EyebrowPill, type ActionData } from "@/components/ui";
import { getMediaById } from "@/lib/backend";
import { HeroImages } from "./hero-images";
import { customHeight } from "@/lib/custom-height";

type DetailImage = { url: string; alt: string; width?: number | null; height?: number | null };

// Phần đầu của trang chi tiết (sản phẩm, giải pháp, dịch vụ, thiết bị, bài viết): cùng kiểu với "Phần đầu trang"
// của trang chủ — nằm dưới header trong suốt, chữ trái ảnh phải, nhãn chip, nút.
// `fill`: cao đúng một màn hình trên máy tính (.screen-hero); bài viết để `false` cho người đọc thấy ngay nội dung.
// `product`: ảnh sản phẩm nằm trong khung 4:3 nền nhạt (ảnh nền trong suốt vẫn gọn); mặc định ảnh bìa bo góc.
// `background`: nền sẵn (xám nhạt / trắng / xanh nhạt / tối); `appearance`: màu tự chọn và ảnh nền phủ lớp màu (cùng vỏ chung với khối trang),
// ghi đè nền sẵn. Nền tối hoặc màu tối thì chữ chuyển sang màu sáng (CSS .card-on-dark, cùng quy tắc với thẻ có màu nền riêng).
const surfaces = { default: { className: "bg-[#f7f9fc]", color: "#f7f9fc", dark: false }, white: { className: "bg-white", color: "#ffffff", dark: false }, tinted: { className: "bg-surface-tinted", color: "var(--color-surface-tinted)", dark: false }, dark: { className: "bg-navy", color: "var(--color-navy)", dark: true } } as const;
export async function DetailHero({ back, label, title, summary, image: coverImage, extraImages = [], imageStyle = "cover", primary, primaryNode, secondary, fill = true, height, layout = "split", background = "default", appearance, children }: {
  back: { href: string; label: string };
  label?: string | null;
  title: string;
  summary?: string | null;
  image?: DetailImage | null;
  /** Ảnh trượt thêm (ngoài ảnh bìa): từ 2 ảnh thì tự chuyển ảnh, mỗi ảnh vài giây, kèm chấm để xem từng ảnh. */
  extraImages?: DetailImage[];
  imageStyle?: "cover" | "product";
  primary?: ActionData | null;
  /** Thay nút chính bằng thành phần riêng (xem Actions). */
  primaryNode?: ReactNode;
  secondary?: ActionData | null;
  fill?: boolean;
  /** Chiều cao chọn trong CMS: cả màn hình / 3/4 / một nửa / theo nội dung. Có `height` thì thay cho `fill`. */
  height?: "screen" | "three_quarter" | "half" | "auto" | "custom";
  /** Vị trí ảnh: chữ trái ảnh phải (mặc định), ảnh trái chữ phải, hoặc chữ căn giữa với ảnh bên dưới. */
  layout?: "split" | "split_reverse" | "centered" | "background";
  background?: keyof typeof surfaces;
  appearance?: Partial<BlockAppearance> | null;
  children?: ReactNode;
}) {
  const gallery = [coverImage, ...extraImages].filter((item): item is DetailImage => Boolean(item));
  const imageProp = gallery[0] ?? null;
  const slides = gallery.length > 1 ? gallery.map(item => ({ url: item.url, alt: item.alt })) : null;
  const filled = height ? height !== "auto" : fill;
  const heightAttr = height === "three_quarter" || height === "half" || height === "custom" ? height : undefined;
  const heightCustom = height === "custom" ? customHeight("hero", appearance) : null;
  const width = appearance?.width && appearance.width < 100 ? appearance.width : null;
  const centered = layout === "centered";
  // "Ảnh nền tràn màn hình": ảnh bìa trải làm nền phần đầu trang, phủ lớp tối để chữ trắng đọc được; không còn ảnh ở bên cạnh.
  const coverBackground = layout === "background" && imageProp ? imageProp : null;
  const image = coverBackground ? null : imageProp;
  // Ô nền chung (appearance.tone) thắng ô nền cũ (background) của dữ liệu đã lưu trước đây.
  const chosen = appearance?.tone;
  const preset = surfaces[chosen === "white" || chosen === "tinted" || chosen === "dark" ? chosen : background];
  const custom = appearance?.tone === "custom" && appearance.backgroundColor ? appearance.backgroundColor : null;
  const media = appearance?.backgroundMediaId ? await getMediaById(appearance.backgroundMediaId) : null;
  const backgroundUrl = (media?.mimeType.startsWith("image/") ? media.url : null) ?? coverBackground?.url ?? null;
  const dark = custom ? isDarkColor(custom) : coverBackground ? true : preset.dark;
  // Nền sáng mặc định: một vệt sáng thương hiệu mờ phía ảnh để phần đầu trang có chiều sâu; nền tối, màu tự chọn hoặc ảnh nền thì bỏ.
  const glow = !dark && !backgroundUrl && !custom && !centered;
  const columns = !image || centered ? "" : layout === "split_reverse" ? "lg:grid-cols-[1fr_1.05fr] lg:gap-14" : "lg:grid-cols-[1.05fr_1fr] lg:gap-14";
  return <section className={`${filled ? "screen-hero" : ""} relative overflow-hidden border-b border-line ${custom ? "" : preset.className} ${backgroundUrl || glow ? "isolate" : ""} ${dark ? "card-on-dark" : ""}`.replace(/\s+/g, " ").trim()} data-hero-height={heightAttr} data-hero-top={dark ? "dark" : "light"} data-hero-ratio={heightCustom?.ratio ? "" : undefined} style={custom || heightCustom ? { ...(custom ? { backgroundColor: custom } : {}), ...heightCustom?.style } as CSSProperties : undefined}>
    {backgroundUrl ? <>
      {slides && coverBackground && !media ? <HeroImages builderItem={null} images={slides} preload sizes="100vw" variant="fill" /> : <Image alt="" className="-z-20 object-cover" fetchPriority="high" fill loading="eager" sizes="100vw" src={backgroundUrl} />}
      <span aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: custom ?? (coverBackground ? "var(--color-navy)" : preset.color), opacity: (coverBackground && !media ? 70 : appearance?.backgroundOverlay ?? 80) / 100 }} />
    </> : null}
    {glow ? <span aria-hidden="true" className={`soft-glow top-[-12rem] size-[40rem] opacity-70 ${layout === "split_reverse" ? "left-[-10rem]" : "right-[-10rem]"}`} /> : null}
    <div className={`site-container ${width ? "hero-width " : ""}grid items-center gap-10 py-10 sm:py-14 ${filled ? "lg:pt-0 lg:pb-28" : ""} ${columns}`} style={width ? { "--hero-width": width / 100 } as CSSProperties : undefined}>
      <div className={`${image && !centered ? "" : "max-w-3xl"} ${centered ? "mx-auto text-center" : ""} ${layout === "split_reverse" && image ? "lg:order-2" : ""}`}>
        <Link className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-brand-700" href={back.href}><ArrowLeft aria-hidden="true" size={16} />{back.label}</Link>
        {label ? <EyebrowPill dark={dark} field="category">{label}</EyebrowPill> : null}
        <h1 className="mb-0 text-[2.25rem] leading-[1.12] font-bold tracking-tight text-balance text-ink sm:text-5xl" data-builder-field="title">{title}</h1>
        {summary ? <p className="mt-5 text-lg leading-8 text-muted sm:text-xl" data-builder-field="summary">{summary}</p> : null}
        {children}
        <Actions center={centered} dark={dark} primary={primary} primaryNode={primaryNode} secondary={secondary} />
      </div>
      {image ? imageStyle === "product"
        ? <div className="rounded-card border border-line bg-white p-4 shadow-card" data-builder-field="image">{slides
          ? <HeroImages builderItem={null} imageClassName="aspect-[4/3] w-full rounded-xl bg-slate-50 object-contain p-4" images={slides} onLight preload sizes="(min-width: 1024px) 50vw, 100vw" variant="inline" />
          : <Image alt={image.alt} className="aspect-[4/3] w-full rounded-xl bg-slate-50 object-contain p-4" height={image.height ?? 750} preload sizes="(min-width: 1024px) 50vw, 100vw" src={image.url} width={image.width ?? 1000} />}</div>
        : slides
          ? <HeroImages builderItem={null} imageClassName="h-auto w-full rounded-card border border-line bg-white shadow-card" images={slides} onLight preload sizes="(min-width: 1024px) 50vw, 100vw" variant="inline" />
          : <Image alt={image.alt} className="h-auto w-full rounded-card border border-line bg-white shadow-card" data-builder-field="image" height={image.height ?? 630} preload sizes="(min-width: 1024px) 50vw, 100vw" src={image.url} width={image.width ?? 1200} /> : null}
    </div>
  </section>;
}

// Hàng nhãn nhỏ dưới mô tả (chủ đề, chuyên mục, thẻ).
export function ChipList({ items, label, field }: { items: { key: string; text: string; href?: string }[]; label: string; field?: string }) {
  if (!items.length) return null;
  const chip = "hero-chip inline-flex rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-ink";
  return <ul aria-label={label} className="mt-6 flex flex-wrap gap-2" data-builder-field={field}>{items.map(item => <li key={item.key}>{item.href ? <Link className={`${chip} transition hover:border-brand-300 hover:text-brand-700`} href={item.href}>{item.text}</Link> : <span className={chip}>{item.text}</span>}</li>)}</ul>;
}

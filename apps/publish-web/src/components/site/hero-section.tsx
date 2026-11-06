import Image from "next/image";
import { Fragment } from "react";
import { CircleCheck, ShieldCheck } from "lucide-react";
import { heroToneOf, type HeroTone, type PageBlock } from "@iorder/core/server/pages/pages.contract";
import { getMediaById } from "@/lib/backend";
import { Actions, Eyebrow } from "@/components/ui";
import { HeroImages, type HeroImage } from "./hero-images";
import { HeroRotator } from "./hero-rotator";
import { HeroSlider, type HeroSlide } from "./hero-slider";

type HeroData = Extract<PageBlock, { type: "hero" }>["data"];
const container = "site-container";

async function imageOf(id: string | null | undefined) {
  if (!id) return null;
  const media = await getMediaById(id);
  return media?.mimeType.startsWith("image/") ? media : null;
}

// Chữ của phần đầu trang dùng chung cho mọi kiểu; `dark` khi chữ nằm trên ảnh nền.
// `headingAs`: khối nội dung trượt thứ 2 trở đi dùng thẻ p (trang chỉ có một h1 là tiêu đề chính).
function HeroText({ data, first, dark = false, center = false, headingAs }: { data: HeroData; first: boolean; dark?: boolean; center?: boolean; headingAs?: "h1" | "h2" | "p" }) {
  const Heading = headingAs ?? (first ? "h1" : "h2");
  return <div className={center ? "mx-auto max-w-3xl text-center" : ""}>
    {data.eyebrow ? <Eyebrow dark={dark}>{data.eyebrow}</Eyebrow> : null}
    <Heading className={`mb-0 text-4xl leading-[1.12] font-bold tracking-tight text-balance sm:text-5xl lg:text-[clamp(2.25rem,5.4svh,5rem)] ${dark ? "text-white" : "text-ink"}`}>{data.title}</Heading>
    {data.description ? <p className={`mt-6 text-lg leading-8 sm:text-xl ${dark ? "text-white/90" : "text-muted"}`}>{data.description}</p> : null}
    {data.highlights.length ? <ul className={`hero-highlights mt-8 grid gap-4 sm:grid-cols-3 ${center ? "text-left" : ""}`}>{data.highlights.map((item, index) => <li className="flex items-start gap-3" key={`${item.title}-${index}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-full ${dark ? "bg-white/15 text-white" : "bg-brand-50 text-brand-700"}`}><CircleCheck aria-hidden="true" size={20} /></span>
      <span><strong className={`block ${dark ? "text-white" : "text-ink"}`}>{item.title}</strong>{item.note ? <span className={`block text-sm ${dark ? "text-white/75" : "text-muted"}`}>{item.note}</span> : null}</span>
    </li>)}</ul> : null}
    <Actions center={center} dark={dark} primary={data.primaryAction} secondary={data.secondaryAction} />
    {data.footnote ? <p className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${dark ? "text-white/85" : "text-muted"}`}><ShieldCheck aria-hidden="true" className={dark ? "" : "text-accent-green"} size={18} />{data.footnote}</p> : null}
  </div>;
}

// Phần đầu trang theo kiểu bố cục người vận hành chọn trong CMS.
// Phần đầu trang đứng đầu trang nằm dưới header trong suốt (như iorder.com.vn); báo nền sáng/tối để header đổi màu chữ.
// CSS: `[data-hero-top]` trong globals.css. `flush`: ảnh trượt chiếm trọn chiều cao, không đệm phía trên
// (đệm sẽ lộ một dải trống dưới header trong suốt); các kiểu khác đệm bằng chiều cao header để chữ không nằm dưới menu.
function heroTop(first: boolean, tone: "light" | "dark", flush = false) {
  return first ? { "data-hero-top": tone, ...(flush ? { "data-hero-flush": "" } : {}) } : {};
}

// Kiểu ảnh nền: nền khi chưa có ảnh và lớp phủ lên ảnh theo màu đã chọn. Nền sáng thì chữ đậm; trên điện thoại
// chữ chiếm cả bề ngang nên lớp phủ sáng đều, từ màn hình lớn mới nhạt dần sang phải.
// `top`: khi phần đầu trang nằm dưới header trong suốt, phủ thêm dải sáng từ mép trên mờ dần xuống để menu dễ đọc.
const backgroundTones: Record<HeroTone, { section: string; overlay: string; top: string | null }> = {
  dark: { section: "bg-gradient-to-br from-brand-700 to-brand-950", overlay: "bg-gradient-to-r from-slate-950/75 via-slate-950/45 to-slate-950/10", top: null },
  light: { section: "bg-white", overlay: "bg-white/85 lg:bg-transparent lg:bg-gradient-to-r lg:from-white/95 lg:via-white/80 lg:to-white/20", top: "bg-gradient-to-b from-white via-white/85 to-transparent" },
  tinted: { section: "bg-brand-50", overlay: "bg-brand-50/85 lg:bg-transparent lg:bg-gradient-to-r lg:from-brand-50/95 lg:via-brand-50/80 lg:to-brand-50/20", top: "bg-gradient-to-b from-brand-50 via-brand-50/85 to-transparent" },
};

export async function HeroSection({ data, first }: { data: HeroData; first: boolean }) {
  if (data.layout === "slider") {
    const slides = (await Promise.all(data.slides.map(async (slide) => ({ slide, image: await imageOf(slide.mediaId) }))))
      .filter((entry) => entry.image)
      .map(({ slide, image }): HeroSlide => ({ url: image!.url, alt: image!.altText ?? slide.title ?? "", title: slide.title, description: slide.description, action: slide.action }));
    if (slides.length) return <section className="relative border-b border-line" {...heroTop(first, "dark", true)}>
      {first ? <h1 className="sr-only">{data.title}</h1> : <h2 className="sr-only">{data.title}</h2>}
      <HeroSlider priority={first} slides={slides} />
    </section>;
    // Chưa có ảnh: vẫn hiện tiêu đề trên nền màu thay vì khoảng trống.
    return <section className="screen-hero border-b border-line bg-gradient-to-br from-brand-700 to-brand-950" {...heroTop(first, "dark")}><div className={`${container} py-20 sm:py-28 lg:pt-10 lg:pb-24`}><HeroText center dark data={data} first={first} /></div></section>;
  }

  if (data.panels?.length) return <PanelHero data={data} first={first} />;

  // Ảnh đầu là `mediaId`, các ảnh sau là `extraMediaIds` (dữ liệu cũ có thể chưa có); từ 2 ảnh thì tự chuyển ảnh.
  const images = (await Promise.all([data.mediaId, ...(data.extraMediaIds ?? [])].map(imageOf)))
    .flatMap((media): HeroImage[] => media ? [{ url: media.url, alt: media.altText ?? "" }] : []);
  const image = images[0];
  const many = images.length > 1;
  const tone = heroToneOf(data);
  if (data.layout === "background") {
    const style = backgroundTones[tone];
    const dark = tone === "dark";
    return <section className={`screen-hero relative isolate overflow-hidden border-b border-line ${style.section}`} {...heroTop(first, dark ? "dark" : "light")}>
      {image ? <>{many ? <HeroImages images={images} onLight={!dark} priority={first} sizes="100vw" variant="fill" /> : <Image alt={image.alt} className="-z-10 object-cover" fill priority={first} sizes="100vw" src={image.url} />}<div aria-hidden className={`absolute inset-0 -z-10 ${style.overlay}`} />{first && style.top ? <div aria-hidden className={`absolute inset-x-0 top-0 -z-10 h-[calc(var(--header-height)+160px)] ${style.top}`} /> : null}</> : null}
      <div className={`${container} flex min-h-[520px] items-center py-20 sm:min-h-[620px] lg:min-h-0 lg:pt-10 lg:pb-24`}><div className="max-w-2xl"><HeroText dark={dark} data={data} first={first} /></div></div>
    </section>;
  }

  const sectionTone = tone === "light" ? "bg-white" : "bg-gradient-to-b from-brand-50/70 to-white";
  if (data.layout === "centered") {
    const frame = "h-auto w-full rounded-3xl border border-line shadow-xl shadow-slate-900/10";
    const sizes = "(min-width: 1024px) 70vw, 100vw";
    // Không có ảnh (ví dụ trang Liên hệ): chỉ cao theo nội dung, không chiếm trọn một màn hình để nội dung chính hiện ngay.
    return <section className={`${image ? "screen-hero" : ""} border-b border-line ${sectionTone}`} {...heroTop(first, "light")}>
      <div className={`${container} py-12 sm:py-16 ${image ? "lg:pt-10 lg:pb-24" : "lg:py-20"}`}>
        <HeroText center data={data} first={first} />
        {many ? <HeroImages className="mx-auto mt-12 max-w-5xl" imageClassName={frame} images={images} priority={first} sizes={sizes} variant="inline" />
          : image ? <Image alt={image.alt} className={`mx-auto mt-12 max-w-5xl ${frame}`} height={800} priority={first} sizes={sizes} src={image.url} width={1400} /> : null}
      </div>
    </section>;
  }

  // Chữ – ảnh hai cột (mặc định) hoặc đảo chiều.
  const reverse = data.layout === "split_reverse";
  const splitSizes = "(min-width: 1024px) 50vw, 100vw";
  return <section className={`${image ? "screen-hero" : ""} relative overflow-hidden border-b border-line ${sectionTone}`} {...heroTop(first, "light")}>
    <div className={`${container} grid items-center gap-12 py-12 sm:py-16 ${image ? `lg:pt-10 lg:pb-24 ${reverse ? "lg:grid-cols-[1fr_1.05fr]" : "lg:grid-cols-[1.05fr_1fr]"}` : "lg:py-20"}`}>
      <div className={`${image ? "" : "max-w-3xl"} ${reverse ? "lg:order-2" : ""}`}><HeroText data={data} first={first} /></div>
      {many ? <HeroImages className={reverse ? "lg:order-1" : ""} images={images} priority={first} sizes={splitSizes} variant="inline" />
        : image ? <Image alt={image.alt} className={`h-auto w-full ${reverse ? "lg:order-1" : ""}`} height={800} priority={first} sizes={splitSizes} src={image.url} width={1200} /> : null}
    </div>
  </section>;
}

// Phần đầu trang có nhiều khối nội dung (khối 1 = nội dung chính, các khối sau = `panels`): cả chữ và ảnh trượt cùng nhau
// theo đúng kiểu bố cục đã chọn. Mỗi khối dùng một ảnh của riêng nó (ảnh thêm của khối 1 không dùng ở chế độ này).
async function PanelHero({ data, first }: { data: HeroData; first: boolean }) {
  const entries = [{ text: data, mediaId: data.mediaId }, ...data.panels.map(panel => ({ text: { ...data, ...panel }, mediaId: panel.mediaId }))];
  const images = await Promise.all(entries.map(entry => imageOf(entry.mediaId)));
  const headingAs = (index: number) => index === 0 ? (first ? "h1" : "h2") : "p";
  const tone = heroToneOf(data);

  if (data.layout === "background") {
    const style = backgroundTones[tone];
    const dark = tone === "dark";
    // Ảnh và lớp phủ nằm trong từng khối, định vị theo cả phần đầu trang (khối không có transform khi chỉ mờ dần).
    const panels = entries.map((entry, index) => {
      const image = images[index];
      return <Fragment key={index}>
        {image ? <><Image alt={image.altText ?? ""} className="-z-10 object-cover" fill priority={first && index === 0} sizes="100vw" src={image.url} /><div aria-hidden className={`absolute inset-0 -z-10 ${style.overlay}`} /></> : null}
        <div className="flex min-h-[420px] items-center sm:min-h-[520px] lg:min-h-0"><div className="max-w-2xl"><HeroText dark={dark} data={entry.text} first={first} headingAs={headingAs(index)} /></div></div>
      </Fragment>;
    });
    return <section className={`screen-hero relative isolate overflow-hidden border-b border-line ${style.section}`} {...heroTop(first, dark ? "dark" : "light")}>
      {first && style.top ? <div aria-hidden className={`absolute inset-x-0 top-0 -z-10 h-[calc(var(--header-height)+160px)] ${style.top}`} /> : null}
      <div className={`${container} py-16 lg:pt-10 lg:pb-20`}><HeroRotator dark={dark} fade panels={panels} /></div>
    </section>;
  }

  const sectionTone = tone === "light" ? "bg-white" : "bg-gradient-to-b from-brand-50/70 to-white";
  if (data.layout === "centered") {
    const panels = entries.map((entry, index) => {
      const image = images[index];
      return <div key={index}>
        <HeroText center data={entry.text} first={first} headingAs={headingAs(index)} />
        {image ? <Image alt={image.altText ?? ""} className="mx-auto mt-12 h-auto w-full max-w-5xl rounded-3xl border border-line shadow-xl shadow-slate-900/10" height={800} priority={first && index === 0} sizes="(min-width: 1024px) 70vw, 100vw" src={image.url} width={1400} /> : null}
      </div>;
    });
    return <section className={`screen-hero border-b border-line ${sectionTone}`} {...heroTop(first, "light")}>
      <div className={`${container} py-12 sm:py-16 lg:pt-10 lg:pb-20`}><HeroRotator center panels={panels} /></div>
    </section>;
  }

  // Chữ – ảnh hai cột hoặc đảo chiều; khối không có ảnh thì chữ chiếm cột trái, cột ảnh để trống cho các khối thẳng hàng.
  const reverse = data.layout === "split_reverse";
  const panels = entries.map((entry, index) => {
    const image = images[index];
    return <div className={`grid items-center gap-12 ${reverse ? "lg:grid-cols-[1fr_1.05fr]" : "lg:grid-cols-[1.05fr_1fr]"}`} key={index}>
      <div className={reverse ? "lg:order-2" : ""}><HeroText data={entry.text} first={first} headingAs={headingAs(index)} /></div>
      {image ? <Image alt={image.altText ?? ""} className={`h-auto w-full ${reverse ? "lg:order-1" : ""}`} height={800} priority={first && index === 0} sizes="(min-width: 1024px) 50vw, 100vw" src={image.url} width={1200} /> : <div aria-hidden className="hidden lg:block" />}
    </div>;
  });
  return <section className={`screen-hero relative overflow-hidden border-b border-line ${sectionTone}`} {...heroTop(first, "light")}>
    <div className={`${container} py-12 sm:py-16 lg:pt-10 lg:pb-20`}><HeroRotator panels={panels} /></div>
  </section>;
}

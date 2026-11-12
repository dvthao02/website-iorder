import Image from "next/image";
import { Check } from "lucide-react";
import type { BlockFrame } from "@iorder/shared/server/pages/block-layout";
import type { ColumnItem, ColumnsBlockData } from "@iorder/shared/server/pages/pages.contract";
import { getMediaById } from "@/lib/backend";
import { ButtonLink, FrameSection, SectionHeading } from "@/components/ui";

// Khối nhiều cột: lưới 2–4 cột do người soạn tự dựng; điện thoại luôn xếp dọc (cột cuối lên trên nếu chọn "đảo thứ tự").
// Lớp Tailwind viết nguyên chuỗi để trình quét nhận ra.
const gridClass = { equal: "md:grid-cols-2", left_wide: "md:grid-cols-[3fr_2fr]", right_wide: "md:grid-cols-[2fr_3fr]" } as const;
const gapClass = { sm: "gap-4 md:gap-6", md: "gap-8 md:gap-12", lg: "gap-10 md:gap-16" } as const;
const alignClass = { top: "items-start", center: "items-center", bottom: "items-end" } as const;
const textAlign = { left: "text-left", center: "text-center", right: "text-right" } as const;
const itemsAlign = { left: "items-start", center: "items-center", right: "items-end" } as const;
const headingClass = { h2: "text-h2", h3: "text-h3", h4: "text-lead" } as const;

function columnGrid(count: number, layout: keyof typeof gridClass) {
  if (count === 2) return gridClass[layout];
  return count === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4";
}

async function Item({ item, dark }: { item: ColumnItem; dark: boolean }) {
  switch (item.kind) {
    case "heading": {
      const Heading = item.level;
      return <Heading className={`m-0 font-bold tracking-tight text-balance ${headingClass[item.level]} ${textAlign[item.align]} ${dark ? "text-white" : "text-ink"}`}>{item.text}</Heading>;
    }
    case "text":
      return <p className={`m-0 text-lead whitespace-pre-line ${textAlign[item.align]} ${dark ? "text-white/80" : "text-ink/80"}`}>{item.text}</p>;
    case "image": {
      const media = item.mediaId ? await getMediaById(item.mediaId) : null;
      if (!media?.mimeType.startsWith("image/")) return null;
      return <Image alt={item.alt ?? media.altText ?? ""} className={`h-auto w-full rounded-card ${item.fit === "cover" ? "aspect-[4/3] object-cover" : "object-contain"}`} height={800} sizes="(min-width: 1024px) 40vw, 100vw" src={media.url} width={1200} />;
    }
    case "button":
      return <div><ButtonLink action={{ label: item.label, href: item.href }} variant={item.style === "secondary" ? "secondary" : "primary"} /></div>;
    case "list":
      return <ul className="m-0 grid list-none gap-2 p-0">{item.items.map((entry, index) => <li className={`flex items-start gap-3 ${dark ? "text-white/90" : "text-ink"}`} key={index}><Check aria-hidden="true" className="mt-1 shrink-0 text-brand-600" size={18} /><span>{entry}</span></li>)}</ul>;
  }
}

export async function ColumnsSection({ data, frame }: { data: ColumnsBlockData; frame: BlockFrame }) {
  const dark = frame.tone === "dark";
  const lastIndex = data.columns.length - 1;
  return <FrameSection frame={frame}>
    <SectionHeading dark={dark} eyebrow={data.eyebrow} title={data.title} />
    <div className={`grid ${columnGrid(data.columns.length, data.layout)} ${gapClass[data.gap]} ${alignClass[data.verticalAlign]}`}>
      {data.columns.map((column, index) => <div className={`flex flex-col gap-4 ${data.stack === "reverse" && index === lastIndex ? "max-md:order-first" : ""}`} key={index}>
        {column.items.map((item, itemIndex) => <div className={`flex flex-col ${item.kind === "heading" || item.kind === "text" ? itemsAlign[item.align] : ""}`} data-builder-field={`column:${index}:${itemIndex}`} key={itemIndex}><Item dark={dark} item={item} /></div>)}
      </div>)}
    </div>
  </FrameSection>;
}

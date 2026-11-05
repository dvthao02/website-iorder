import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
import type { BlockFrame } from "@iorder/core/server/pages/block-layout";
import type { PageBlock } from "@iorder/core/server/pages/pages.contract";
import { getMediaById } from "@/lib/backend";
import { Actions, Badge, ButtonLink, Card, CardText, CardTitle, CheckList, FrameSection, IconTile, SectionHeading, TextLink, defaultFrame, gridColumns } from "@/components/ui";
import { BlockIcon } from "./block-icon";

// Ảnh + chữ hai cột; nhiều khối liền nhau đổi xen kẽ trái/phải (nền tự xen kẽ theo vỏ chung).
export async function MediaTextSection({ data, frame }: { data: Extract<PageBlock, { type: "media_text" }>["data"]; frame: BlockFrame }) {
  const media = data.mediaId ? await getMediaById(data.mediaId) : null;
  const image = media?.mimeType.startsWith("image/") ? media : null;
  const imageLeft = data.layout === "image_left";
  const dark = frame.tone === "dark";
  return <FrameSection frame={frame} width={image ? "default" : "text"}>
    <div className={`grid items-center gap-10 ${image ? "lg:grid-cols-2 lg:gap-16" : ""}`}>
      <div className={imageLeft ? "lg:order-2" : ""}>
        <SectionHeading align={image ? "left" : "center"} className="" dark={dark} description={data.description} eyebrow={data.eyebrow} title={data.title} />
        <CheckList dark={dark} items={data.bullets} />
        <Actions center={!image} dark={dark} primary={data.primaryAction} secondary={data.secondaryAction} />
      </div>
      {image ? <div className={imageLeft ? "lg:order-1" : ""}><Image alt={image.altText ?? data.title} className={`h-auto w-full rounded-card ${dark ? "shadow-raised ring-1 ring-white/15" : ""}`.trim()} height={900} sizes="(min-width: 1024px) 45vw, 100vw" src={image.url} width={1200} /></div> : null}
    </div>
  </FrameSection>;
}

// Bảng giá: thẻ ngang hàng, gói nổi bật có viền màu, nhãn và nút chính; các gói khác nút viền.
export function PricingSection({ data, frame = defaultFrame }: { data: Extract<PageBlock, { type: "pricing" }>["data"]; frame?: BlockFrame }) {
  const dark = frame.tone === "dark";
  return <FrameSection frame={frame}>
    <SectionHeading dark={dark} description={data.description} eyebrow={data.eyebrow} title={data.title} />
    <div className={`grid items-stretch gap-6 ${gridColumns(data.plans.length, 4)}`}>{data.plans.map((plan, index) => <Card className={plan.highlighted ? "lg:-my-3 lg:py-10" : ""} highlighted={plan.highlighted} key={`${plan.name}-${index}`}>
      {plan.badge ? <Badge className="absolute -top-3 left-7">{plan.badge}</Badge> : null}
      <CardTitle>{plan.name}</CardTitle>
      {plan.description ? <p className="mt-2 mb-0 text-small text-muted">{plan.description}</p> : null}
      <p className="mt-6 mb-0 flex items-baseline gap-1"><span className="text-h2 font-bold tracking-tight text-ink">{plan.price}</span>{plan.period ? <span className="text-body text-muted">{plan.period}</span> : null}</p>
      {plan.features.length ? <ul className="m-0 mt-6 grid flex-1 list-none content-start gap-3 border-t border-line p-0 pt-6">{plan.features.map((feature, featureIndex) => <li className="flex items-start gap-3 text-small text-ink" key={`${feature}-${featureIndex}`}><Check aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" size={17} strokeWidth={2.5} />{feature}</li>)}</ul> : <div className="flex-1" />}
      {plan.action ? <div className="mt-8"><ButtonLink action={plan.action} full variant={plan.highlighted ? "primary" : "secondary"} /></div> : null}
    </Card>)}</div>
    {data.note ? <p className={`mt-8 mb-0 text-center text-small ${dark ? "text-white/70" : "text-muted"}`}>{data.note}</p> : null}
  </FrameSection>;
}

// Danh sách theo nhóm: mỗi nhóm một thẻ có biểu tượng (màu nhấn xoay vòng), tên, số mục; bên trong là các dòng ngắn kèm biểu tượng.
export function GroupedListSection({ data, frame }: { data: Extract<PageBlock, { type: "grouped_list" }>["data"]; frame: BlockFrame }) {
  const dark = frame.tone === "dark";
  return <FrameSection frame={frame}>
    <SectionHeading dark={dark} description={data.description} eyebrow={data.eyebrow} title={data.title} />
    <div className={`grid items-stretch gap-6 ${gridColumns(data.groups.length)}`}>{data.groups.map((group, index) => <Card as="div" key={`${group.title}-${index}`}>
      <div className="flex items-center gap-4 border-b border-line pb-5">
        <IconTile accent={index} size="lg">{group.icon ? <BlockIcon name={group.icon} size={26} strokeWidth={1.8} /> : String(index + 1).padStart(2, "0")}</IconTile>
        <div className="min-w-0 flex-1">
          {data.groupLabel ? <p className="mb-0.5 text-caption font-bold tracking-wider text-muted uppercase">{data.groupLabel}</p> : null}
          <CardTitle>{group.title}</CardTitle>
        </div>
        {data.showCount && group.items.length ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-subtle text-caption font-bold text-muted" title={`${group.items.length} mục`}>{group.items.length}</span> : null}
      </div>
      {group.items.length ? <ul className="m-0 mt-2 flex-1 list-none p-0">{group.items.map((item, itemIndex) => {
        const content = <>{item.icon ? <BlockIcon className="shrink-0 text-faint" name={item.icon} size={18} strokeWidth={1.7} /> : <span aria-hidden="true" className="size-[18px] shrink-0" />}<span>{item.label}</span></>;
        const row = "flex items-center gap-3 border-b border-line py-3 text-body text-ink";
        return <li key={`${item.label}-${itemIndex}`}>{item.href ? <TextLink className={`${row} transition hover:text-brand-700`} href={item.href}>{content}</TextLink> : <div className={row}>{content}</div>}</li>;
      })}</ul> : <CardText className="mt-4 flex-1">Chưa có mục nào.</CardText>}
      {group.action ? <TextLink className="mt-5 inline-flex items-center gap-2 self-start text-small font-bold text-brand-700 hover:underline" href={group.action.href}><Sparkles aria-hidden="true" size={16} />{group.action.label}</TextLink> : null}
    </Card>)}</div>
  </FrameSection>;
}

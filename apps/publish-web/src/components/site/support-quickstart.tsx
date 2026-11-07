"use client";

import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { SiteLink as Link } from "./site-link";
import { iconFor } from "./guide-icons";

export type QuickStartItem = { href: string; title: string; description: string | null; category: string | null; cover: { url: string; alt: string | null } | null };
export type QuickStartGroup = { key: string; label: string; items: QuickStartItem[] };

// Màu nhấn xoay vòng theo thứ tự bước (token --color-accent-*), để dãy thẻ không đơn điệu một màu.
const tones = ["blue", "green", "violet", "amber", "rose"] as const;

/**
 * "Làm quen với iOrder": các bài hướng dẫn theo thứ tự thành thẻ trượt ngang (ảnh, Bước n, tên bài, mô tả, Xem bài viết).
 * Có từ hai nhóm (chuyên mục) thì hiện thanh chọn nhóm. Nút ‹ › nổi hai bên dãy thẻ, tự ẩn khi đã ở đầu/cuối, mép còn thẻ
 * thì mờ dần; trên điện thoại vuốt ngang. Bài chưa có ảnh bìa dùng ảnh minh họa: biểu tượng chức năng, chuyên mục, số bước.
 */
export function SupportQuickStart({ groups }: { groups: QuickStartGroup[] }) {
  const [active, setActive] = useState(groups[0]?.key ?? "");
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const tabsId = useId();
  const group = groups.find((entry) => entry.key === active) ?? groups[0];

  function measure() {
    const element = track.current;
    if (!element) return;
    setEdges({ start: element.scrollLeft <= 4, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 4 });
  }
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    element.scrollTo({ left: 0 });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);
  function scroll(direction: -1 | 1) {
    const element = track.current;
    const card = element?.querySelector("li");
    if (!element || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * (card.getBoundingClientRect().width + 20), behavior: reduce ? "auto" : "smooth" });
  }
  if (!group) return null;

  return <div>
    {groups.length > 1 ? <div aria-label="Nhóm hướng dẫn" className="support-tabs" role="tablist">
      {groups.map((entry) => <button aria-controls={`${tabsId}-panel`} aria-selected={entry.key === group.key} className="support-tab" id={`${tabsId}-${entry.key}`} key={entry.key} onClick={() => setActive(entry.key)} role="tab" type="button">
        {entry.label}<span className="support-tab__count">{entry.items.length}</span>
      </button>)}
    </div> : null}
    <div aria-labelledby={groups.length > 1 ? `${tabsId}-${group.key}` : undefined} className="support-carousel" id={`${tabsId}-panel`} role={groups.length > 1 ? "tabpanel" : undefined}>
      <button aria-label="Xem các bước trước" className="support-arrow support-arrow--prev" disabled={edges.start} onClick={() => scroll(-1)} type="button"><ChevronLeft aria-hidden="true" size={22} /></button>
      <ul className="support-track" data-fade-end={edges.end ? undefined : ""} data-fade-start={edges.start ? undefined : ""} onScroll={measure} ref={track}>
        {group.items.map((item, index) => {
          const Icon = iconFor(item.title);
          return <li key={item.href}>
            <Link className="support-guide group" href={item.href}>
              <span className="support-guide__media">
                {item.cover ? <Image alt={item.cover.alt ?? item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" height={338} sizes="(min-width: 1024px) 24rem, 80vw" src={item.cover.url} width={600} />
                  : <span aria-hidden="true" className="support-guide__art" data-tone={tones[index % tones.length]}>
                    {item.category ? <span className="support-guide__tag">{item.category}</span> : null}
                    <span className="support-guide__icon"><Icon size={36} strokeWidth={1.6} /></span>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                  </span>}
              </span>
              <span className="flex flex-1 flex-col p-5">
                <span className="text-caption font-bold tracking-wide text-brand-600 uppercase">Bước {index + 1}</span>
                <span className="mt-1 text-lead leading-snug font-bold text-ink group-hover:text-brand-700">{item.title}</span>
                {item.description ? <span className="mt-2 line-clamp-3 text-small text-muted">{item.description}</span> : null}
                <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-small font-semibold text-brand-700">Xem bài viết <ArrowRight aria-hidden="true" className="transition group-hover:translate-x-0.5" size={16} /></span>
              </span>
            </Link>
          </li>;
        })}
      </ul>
      <button aria-label="Xem các bước tiếp theo" className="support-arrow support-arrow--next" disabled={edges.end} onClick={() => scroll(1)} type="button"><ChevronRight aria-hidden="true" size={22} /></button>
    </div>
  </div>;
}

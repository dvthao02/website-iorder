"use client";

import Image from "next/image";
import { ArrowRight, BadgeCheck, ShieldCheck, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from "react";

import { SiteLink as Link } from "./site-link";

export type ExplorerEquipment = {
  id: string; slug: string; name: string; modelCode: string | null; priceVnd: number; warrantyMonths: number; summary: string | null;
  groupName: string; coverUrl: string | null; coverAlt: string | null;
  specificationGroups: Array<{ title: string; items: Array<{ label: string; value: string }> }>;
};

const priceFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
// Số cột của lưới thẻ theo bề ngang (khớp class grid bên dưới) — để chèn khung chi tiết ngay sau hàng có thẻ đang chọn.
const columnQueries = [["(min-width: 1280px)", 5], ["(min-width: 1024px)", 4], ["(min-width: 640px)", 3]] as const;
const gap = 20; // gap-5
function subscribe(onChange: () => void) {
  const lists = columnQueries.map(([query]) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener("change", onChange));
  return () => lists.forEach((list) => list.removeEventListener("change", onChange));
}
const columnsNow = () => columnQueries.find(([query]) => window.matchMedia(query).matches)?.[1] ?? 2;
// Dòng thông số nhập từ văn bản tự do có nhãn "Thông tin n": chỉ hiện giá trị (giống trang chi tiết).
const freeText = (label: string) => /^Thông tin \d+$/.test(label);

/**
 * Danh sách thiết bị dạng lưới theo nhóm; bấm một thẻ thì khung chi tiết (ảnh, giá, bảo hành, thông số) mở ngay dưới
 * hàng chứa thẻ đó, có mũi nhọn chỉ lên thẻ. Thẻ vẫn là liên kết tới trang chi tiết: Ctrl/chuột giữa mở trang riêng,
 * trình duyệt không chạy JavaScript và công cụ tìm kiếm vẫn theo liên kết như thường. Esc hoặc ✕ đóng và trả focus về thẻ.
 */
export function EquipmentExplorer({ items, grouped, dark = false, Heading = "h3" }: { items: ExplorerEquipment[]; grouped: boolean; dark?: boolean; Heading?: "h2" | "h3" }) {
  const columns = useSyncExternalStore(subscribe, columnsNow, () => 4);
  // Tên thiết bị trong khung chi tiết là tiêu đề ngay dưới cấp tiêu đề nhóm.
  const PanelHeading = Heading === "h2" ? "h3" : "h4";
  const [selected, setSelected] = useState<string | null>(null);
  const cards = useRef(new Map<string, HTMLAnchorElement>());
  const panel = useRef<HTMLDivElement>(null);
  const groups = grouped ? [...new Set(items.map((item) => item.groupName))].map((name) => ({ name, items: items.filter((item) => item.groupName === name) })) : [{ name: null, items }];

  function close() {
    const id = selected;
    setSelected(null);
    if (id) cards.current.get(id)?.focus();
  }
  function toggle(event: MouseEvent<HTMLAnchorElement>, id: string) {
    // Ctrl/⌘/Shift/chuột giữa: để trình duyệt mở trang chi tiết như liên kết thường.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setSelected((current) => current === id ? null : id);
  }
  useEffect(() => {
    if (!selected) return;
    // Khung mới mở nằm ngoài màn hình (thẻ ở hàng cuối) thì cuộn vừa đủ để thấy.
    panel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelected(null);
      cards.current.get(selected)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return <div className="grid gap-12">{groups.map((group) => {
    const index = group.items.findIndex((item) => item.id === selected);
    const active = index >= 0 ? group.items[index] : null;
    // Khung chi tiết đứng sau thẻ cuối của hàng chứa thẻ đang chọn.
    const after = index >= 0 ? Math.min(group.items.length - 1, (Math.floor(index / columns) + 1) * columns - 1) : -1;
    const column = index >= 0 ? index % columns : 0;
    return <section aria-label={group.name ?? undefined} className="grid gap-6" key={group.name ?? "all"}>
      {group.name ? <Heading className={`mb-0 text-h3 font-bold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{group.name}</Heading> : null}
      <ul className="equipment-grid m-0 grid list-none grid-cols-2 gap-5 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {group.items.map((item, itemIndex) => <Fragment key={item.id}>
          <li>
            <Link aria-controls={selected === item.id ? `thiet-bi-chi-tiet-${item.id}` : undefined} aria-expanded={selected === item.id} className={selected === item.id ? "equipment-tile equipment-tile--active" : "equipment-tile"} href={`/thiet-bi/${item.slug}`} onClick={(event) => toggle(event, item.id)} ref={(element) => { if (element) cards.current.set(item.id, element); else cards.current.delete(item.id); }}>
              <span className="equipment-tile__media">{item.coverUrl ? <Image alt={item.coverAlt ?? item.name} className="h-full w-full object-contain" height={360} sizes="(min-width: 1280px) 260px, (min-width: 640px) 30vw, 45vw" src={item.coverUrl} width={480} /> : null}</span>
              <span className="equipment-tile__name">{item.name}</span>
              <span className="equipment-tile__price">{priceFormatter.format(item.priceVnd)}</span>
              <span className="equipment-tile__meta">Bảo hành {item.warrantyMonths} tháng</span>
            </Link>
          </li>
          {itemIndex === after && active ? <li className="col-span-full">
            <div aria-label={`Chi tiết ${active.name}`} className="equipment-panel" id={`thiet-bi-chi-tiet-${active.id}`} ref={panel} role="region" style={{ "--notch-left": `calc(${(column + 0.5) / columns} * (100% + ${gap}px) - ${gap / 2}px)` } as CSSProperties}>
              <button aria-label="Đóng chi tiết" className="equipment-panel__close" onClick={close} type="button"><X aria-hidden="true" size={20} /></button>
              <div className="equipment-panel__media">{active.coverUrl ? <Image alt={active.coverAlt ?? active.name} className="h-full w-full object-contain" height={480} sizes="(min-width: 768px) 300px, 90vw" src={active.coverUrl} width={640} /> : null}</div>
              <div className="min-w-0">
                <p className="mb-1 text-small font-semibold text-brand-700">{active.groupName}</p>
                <PanelHeading className="mb-0 text-[1.375rem] leading-tight font-bold tracking-tight text-ink sm:text-[1.625rem]">{active.name}</PanelHeading>
                <p className="mt-1.5 mb-0 text-[1.25rem] font-bold text-brand-600 sm:text-[1.375rem]">{priceFormatter.format(active.priceVnd)}</p>
                <ul className="mt-3 mb-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-small text-muted">
                  {active.modelCode ? <li className="flex items-center gap-2"><BadgeCheck aria-hidden="true" className="text-brand-600" size={18} />Mã máy: <strong className="font-semibold text-ink">{active.modelCode}</strong></li> : null}
                  <li className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="text-accent-green" size={18} />Bảo hành <strong className="font-semibold text-ink">{active.warrantyMonths} tháng</strong></li>
                </ul>
                {active.summary ? <p className="mt-3 mb-0 max-w-3xl text-body text-muted">{active.summary}</p> : null}
                {active.specificationGroups.length ? <div className="equipment-panel__specs">{active.specificationGroups.map((spec, specIndex) => <section key={specIndex}>
                  <p className="mb-2 text-small font-bold tracking-wide text-ink uppercase">{spec.title}</p>
                  <ul className="m-0 grid list-none gap-1.5 p-0">{spec.items.map((row, rowIndex) => <li className="text-body text-ink/85" key={rowIndex}>{freeText(row.label) ? row.value : <><span className="text-muted">{row.label}:</span> {row.value}</>}</li>)}</ul>
                </section>)}</div> : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link className="button button--primary" href="/lien-he">Liên hệ mua hàng</Link>
                  <Link className="button button--secondary" href={`/thiet-bi/${active.slug}`}>Xem trang chi tiết<ArrowRight aria-hidden="true" size={18} /></Link>
                </div>
              </div>
            </div>
          </li> : null}
        </Fragment>)}
      </ul>
    </section>;
  })}</div>;
}

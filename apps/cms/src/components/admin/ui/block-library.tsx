"use client";

import { Plus, Search, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Frame, TextLines, heroLayoutPreviews, media, text } from "./layout-picker";

// Hình minh họa từng loại thành phần (cùng khung 120×72 với bộ chọn kiểu bố cục).
const bar = (x: number, y: number, width: number, height = 3, opacity = 0.5) => <rect fill={text} height={height} opacity={opacity} rx={height / 2} width={width} x={x} y={y} />;
const box = (x: number, y: number, width: number, height: number, opacity = 0.25) => <rect fill={media} height={height} opacity={opacity} rx="3" width={width} x={x} y={y} />;
const cards = (count: number) => Array.from({ length: count }, (_, index) => { const width = (100 - (count - 1) * 6) / count; const x = 10 + index * (width + 6); return <g key={index}><rect height="34" rx="3" stroke="var(--cms-border-strong)" width={width} x={x} y={26} />{box(x + 4, 30, 8, 8, 0.4)}{bar(x + 4, 43, width - 8, 3, 0.8)}{bar(x + 4, 50, width - 12)}</g>; });

export const blockThumbnails: Record<string, ReactNode> = {
  hero: heroLayoutPreviews.split,
  media_text: <Frame>{box(10, 12, 50, 48)}<TextLines width={40} x={68} y={20} /></Frame>,
  features: <Frame>{bar(35, 10, 50, 5, 0.9)}{bar(25, 18, 70)}{cards(3)}</Frame>,
  industries: <Frame>{bar(35, 10, 50, 5, 0.9)}{bar(25, 18, 70)}{cards(4)}</Frame>,
  ecosystem: <Frame>{bar(35, 10, 50, 5, 0.9)}{bar(25, 18, 70)}{cards(2)}</Frame>,
  process: <Frame>{bar(35, 10, 50, 5, 0.9)}{[0, 1, 2, 3].map((index) => <g key={index}><circle cx={18 + index * 28} cy="38" fill={media} opacity=".5" r="6" />{index < 3 ? <rect fill={text} height="1.5" opacity=".4" width="16" x={26 + index * 28} y="37" /> : null}{bar(8 + index * 28, 50, 20)}</g>)}</Frame>,
  stats: <Frame><rect fill={text} height="63" opacity=".85" rx="3" width="111" x={4.5} y={4.5} />{[0, 1, 2, 3].map((index) => <g key={index}><rect fill="#fff" height="8" rx="2" width="18" x={12 + index * 26} y="26" /><rect fill="#fff" height="3" opacity=".6" rx="1.5" width="20" x={12 + index * 26} y="40" /></g>)}</Frame>,
  collection_list: <Frame>{bar(10, 10, 40, 5, 0.9)}{[0, 1, 2].map((index) => <g key={index}>{box(10 + index * 35, 22, 30, 18)}{bar(10 + index * 35, 45, 28, 3, 0.8)}{bar(10 + index * 35, 51, 22)}</g>)}</Frame>,
  grouped_list: <Frame>{bar(35, 8, 50, 5, 0.9)}{[0, 1, 2].map((index) => <g key={index}><rect height="50" rx="3" stroke="var(--cms-border-strong)" width="30" x={12 + index * 34} y="18" />{box(16 + index * 34, 22, 7, 7, 0.5)}{bar(25 + index * 34, 24, 14, 3, 0.8)}{[0, 1, 2, 3].map((row) => <g key={row}><circle cx={18 + index * 34} cy={36 + row * 7} fill={text} opacity=".35" r="1.6" />{bar(22 + index * 34, 35 + row * 7, 16, 2.5, 0.45)}</g>)}</g>)}</Frame>,
  pricing: <Frame>{bar(35, 8, 50, 5, 0.9)}{[0, 1, 2].map((index) => <g key={index}><rect fill={index === 1 ? media : "none"} fillOpacity=".12" height={index === 1 ? 50 : 44} rx="3" stroke={index === 1 ? media : "var(--cms-border-strong)"} width="30" x={12 + index * 34} y={index === 1 ? 17 : 20} />{bar(17 + index * 34, 26, 14, 5, 0.9)}{bar(17 + index * 34, 36, 20)}{bar(17 + index * 34, 42, 18)}<rect fill={media} height="5" rx="2.5" width="20" x={17 + index * 34} y="54" /></g>)}</Frame>,
  testimonials: <Frame>{bar(35, 10, 50, 5, 0.9)}{[0, 1].map((index) => <g key={index}><rect height="36" rx="3" stroke="var(--cms-border-strong)" width="46" x={10 + index * 54} y="24" /><text fill={media} fontSize="14" x={14 + index * 54} y="38">“</text>{bar(24 + index * 54, 30, 28)}{bar(24 + index * 54, 36, 24)}<circle cx={18 + index * 54} cy="52" fill={text} opacity=".4" r="4" />{bar(26 + index * 54, 51, 18)}</g>)}</Frame>,
  partners: <Frame>{bar(35, 12, 50, 5, 0.9)}{[0, 1, 2, 3, 4].map((index) => <rect fill={text} height="12" key={index} opacity=".3" rx="3" width="16" x={12 + index * 20} y="32" />)}</Frame>,
  cta: <Frame><rect fill={text} height="34" opacity=".85" rx="5" width="100" x="10" y="19" /><rect fill="#fff" height="5" rx="2" width="44" x="18" y="30" /><rect fill="#fff" height="3" opacity=".6" rx="1.5" width="34" x="18" y="39" /><rect fill="#fff" height="8" rx="4" width="22" x="80" y="31" /></Frame>,
  lead_form: <Frame>{bar(30, 10, 60, 5, 0.9)}{[0, 1].map((index) => <rect height="8" key={index} rx="2" stroke="var(--cms-border-strong)" width="60" x="30" y={22 + index * 12} />)}<rect fill={media} height="8" rx="4" width="30" x="45" y="50" /></Frame>,
  faq: <Frame>{bar(35, 8, 50, 5, 0.9)}{[0, 1, 2, 3].map((index) => <g key={index}><rect height="9" rx="2" stroke="var(--cms-border-strong)" width="90" x="15" y={19 + index * 12} />{bar(19, 22 + index * 12, 40)}<text fill={media} fontSize="8" x="98" y={26 + index * 12}>+</text></g>)}</Frame>,
  rich_text: <Frame>{bar(25, 12, 50, 5, 0.9)}{[0, 1, 2, 3, 4, 5].map((index) => bar(25, 24 + index * 7, index === 5 ? 40 : 70))}</Frame>,
  image: <Frame>{box(10, 10, 100, 44, 0.3)}{bar(40, 59, 40)}</Frame>,
};

export type BlockLibraryItem<Value extends string> = { value: Value; label: string; description: string; group: string; disabledReason?: string };

// Thư viện thành phần: hộp thoại có ô tìm, chia nhóm, mỗi thành phần một thẻ có hình minh họa.
// Dùng <dialog> của trình duyệt nên có sẵn khóa focus, Esc để đóng và nền mờ.
export function BlockLibrary<Value extends string>({ disabled, groups, items, onPick }: { disabled?: boolean; groups: readonly string[]; items: ReadonlyArray<BlockLibraryItem<Value>>; onPick: (value: Value) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLocaleLowerCase("vi");
  const shown = keyword ? items.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase("vi").includes(keyword)) : items;
  function close() { dialog.current?.close(); setQuery(""); }
  return <>
    <button className="admin-button admin-button--secondary admin-button--sm admin-block-library__open" disabled={disabled} onClick={() => dialog.current?.showModal()} type="button"><Plus aria-hidden="true" size={15} />Thêm thành phần</button>
    <dialog aria-labelledby="block-library-title" className="admin-block-library" onClose={() => setQuery("")} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }} ref={dialog}>
      <header className="admin-block-library__head">
        <h2 id="block-library-title">Thêm thành phần</h2>
        <label className="admin-block-library__search"><Search aria-hidden="true" size={15} /><span className="sr-only">Tìm thành phần</span><input autoFocus className="admin-input" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm: bảng giá, ảnh, đánh giá…" type="search" value={query} /></label>
        <button aria-label="Đóng" className="admin-block-library__close" onClick={close} type="button"><X aria-hidden="true" size={18} /></button>
      </header>
      <div className="admin-block-library__body">
        {groups.map((group) => {
          const groupItems = shown.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return <section aria-label={group} className="admin-block-library__group" key={group}>
            <h3>{group}</h3>
            <div className="admin-block-library__grid">{groupItems.map((item) => <button className="admin-block-library__item" disabled={Boolean(item.disabledReason)} key={item.value} onClick={() => { onPick(item.value); close(); }} title={item.disabledReason} type="button">
              <span aria-hidden="true" className="admin-block-library__thumb">{blockThumbnails[item.value]}</span>
              <strong>{item.label}</strong>
              <small>{item.disabledReason ?? item.description}</small>
            </button>)}</div>
          </section>;
        })}
        {shown.length ? null : <p className="admin-help">Không tìm thấy thành phần phù hợp.</p>}
      </div>
    </dialog>
  </>;
}

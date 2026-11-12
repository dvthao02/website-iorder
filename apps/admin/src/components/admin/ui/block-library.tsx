"use client";

import { Plus, Search, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Frame, TextLines, heroLayoutPreviews, media, text } from "./layout-picker";

// Hình minh họa từng loại thành phần (cùng khung 120×72 với bộ chọn kiểu bố cục).
const bar = (x: number, y: number, width: number, height = 3, opacity = 0.5) => <rect fill={text} height={height} opacity={opacity} rx={height / 2} width={width} x={x} y={y} />;
const box = (x: number, y: number, width: number, height: number, opacity = 0.25) => <rect fill={media} height={height} opacity={opacity} rx="3" width={width} x={x} y={y} />;
const photo = (x: number, y: number, width: number, height: number) => <g><rect fill={media} fillOpacity=".12" height={height} rx="3" stroke="var(--cms-border-strong)" width={width} x={x} y={y} /><circle cx={x + width * .72} cy={y + height * .27} fill={media} opacity=".42" r={Math.min(width, height) * .1} /><path d={`M${x + 3} ${y + height - 4}L${x + width * .38} ${y + height * .47}L${x + width * .56} ${y + height * .67}L${x + width * .7} ${y + height * .53}L${x + width - 3} ${y + height - 4}Z`} fill={media} opacity=".5" /><path d={`M${x + 2} ${y + height - 4}L${x + width * .28} ${y + height * .62}L${x + width * .46} ${y + height - 4}Z`} fill={media} opacity=".7" /></g>;
const cards = (count: number) => Array.from({ length: count }, (_, index) => { const width = (100 - (count - 1) * 6) / count; const x = 10 + index * (width + 6); return <g key={index}><rect height="34" rx="3" stroke="var(--cms-border-strong)" width={width} x={x} y={26} />{box(x + 4, 30, 8, 8, 0.4)}{bar(x + 4, 43, width - 8, 3, 0.8)}{bar(x + 4, 50, width - 12)}</g>; });

export const blockThumbnails: Record<string, ReactNode> = {
  // Biến thể trong thư viện: hình minh họa phải khớp bố cục được khởi tạo, không chỉ khớp loại dữ liệu bên dưới.
  "hero-split": heroLayoutPreviews.split,
  "hero-background": <Frame><rect fill={text} height="63" opacity=".82" rx="3" width="111" x="4.5" y="4.5" />{box(10, 10, 100, 52, .22)}{bar(16, 23, 46, 5, .95)}{bar(16, 33, 36, 3, .72)}<rect fill={media} height="8" rx="4" width="25" x="16" y="43" /></Frame>,
  "hero-centered": <Frame>{bar(36, 12, 48, 5, .92)}{bar(27, 22, 66, 3, .7)}{bar(35, 29, 50, 3, .55)}<rect fill={media} height="8" rx="4" width="25" x="48" y="38" />{box(25, 52, 70, 12, .36)}</Frame>,
  "media-right": <Frame><TextLines width={40} x={12} y={20} />{photo(68, 12, 42, 50)}</Frame>,
  "media-left": <Frame>{photo(10, 12, 42, 50)}<TextLines width={40} x={62} y={20} /></Frame>,
  "features-compact": <Frame>{bar(35, 10, 50, 5, .9)}{bar(25, 18, 70)}{cards(3)}</Frame>,
  "features-visual": <Frame>{bar(35, 9, 50, 5, .9)}{[0, 1, 2].map((index) => <g key={index}><rect height="38" rx="3" stroke="var(--cms-border-strong)" width="30" x={12 + index * 34} y="24" />{box(14 + index * 34, 26, 26, 17, .5)}{bar(16 + index * 34, 49, 20, 3, .85)}{bar(16 + index * 34, 55, 16, 2.5)}</g>)}</Frame>,
  "collection-software": <Frame>{bar(12, 10, 44, 5, .9)}{[0, 1, 2].map((index) => <g key={index}><rect height="34" rx="3" stroke="var(--cms-border-strong)" width="29" x={12 + index * 34} y="24" />{box(16 + index * 34, 28, 9, 9, .55)}{bar(16 + index * 34, 43, 20, 3, .82)}{bar(16 + index * 34, 49, 15, 2.5)}</g>)}</Frame>,
  "collection-solution": <Frame>{bar(12, 10, 46, 5, .9)}{[0, 1, 2].map((index) => <g key={index}><rect height="34" rx="3" stroke="var(--cms-border-strong)" width="29" x={12 + index * 34} y="24" /><circle cx={21 + index * 34} cy="33" fill={media} opacity=".55" r="5" />{bar(16 + index * 34, 43, 20, 3, .82)}{bar(16 + index * 34, 49, 15, 2.5)}</g>)}</Frame>,
  partners: <Frame>{bar(35, 11, 50, 5, .9)}{[0, 1, 2, 3, 4].map((index) => <rect fill={text} height="12" key={index} opacity=".32" rx="3" width="16" x={12 + index * 20} y="32" />)}</Frame>,
  customers: <Frame>{bar(35, 11, 50, 5, .9)}{[0, 1, 2, 3].map((index) => <g key={index}><circle cx={24 + index * 25} cy="35" fill={media} opacity=".45" r="8" /><rect fill={text} height="3" opacity=".45" rx="1.5" width="14" x={17 + index * 25} y="49" /></g>)}</Frame>,
  "cta-contact": <Frame><rect fill={text} height="38" opacity=".85" rx="5" width="100" x="10" y="18" /><rect fill="#fff" height="5" rx="2" width="42" x="18" y="28" /><rect fill="#fff" height="3" opacity=".6" rx="1.5" width="34" x="18" y="37" /><rect fill={media} height="9" rx="4.5" width="25" x="77" y="32" /></Frame>,
  "cta-trial": <Frame><rect fill={text} height="38" opacity=".85" rx="5" width="100" x="10" y="18" /><rect fill="#fff" height="5" rx="2" width="42" x="18" y="28" /><rect fill="#fff" height="3" opacity=".6" rx="1.5" width="34" x="18" y="37" /><rect fill="#fff" height="9" opacity=".94" rx="4.5" width="25" x="77" y="32" /></Frame>,
  "lead-form": <Frame>{bar(30, 10, 60, 5, .9)}{[0, 1, 2].map((index) => <rect height="7" key={index} rx="2" stroke="var(--cms-border-strong)" width="60" x="30" y={22 + index * 10} />)}<rect fill={media} height="8" rx="4" width="30" x="45" y="54" /></Frame>,
  // Khối nhiều cột: các hình khớp số cột và tỉ lệ được khởi tạo.
  "columns-two": <Frame>{box(10, 12, 48, 48, .3)}{box(62, 12, 48, 48, .3)}{bar(15, 20, 36, 4, .8)}{bar(15, 29, 30)}{bar(67, 20, 36, 4, .8)}{bar(67, 29, 30)}</Frame>,
  "columns-two-wide": <Frame>{box(10, 12, 62, 48, .3)}{box(76, 12, 34, 48, .3)}{bar(15, 20, 46, 4, .8)}{bar(15, 29, 40)}{bar(15, 36, 44)}{bar(81, 20, 22, 4, .8)}</Frame>,
  "columns-three": <Frame>{[0, 1, 2].map((index) => <g key={index}>{box(10 + index * 34, 12, 30, 48, .3)}{bar(14 + index * 34, 20, 22, 4, .8)}{bar(14 + index * 34, 29, 18)}</g>)}</Frame>,
  "columns-four": <Frame>{[0, 1, 2, 3].map((index) => <g key={index}>{box(8 + index * 26, 12, 23, 48, .3)}{bar(11 + index * 26, 20, 17, 4, .8)}{bar(11 + index * 26, 29, 14)}</g>)}</Frame>,
  columns: <Frame>{box(10, 12, 48, 48, .3)}{box(62, 12, 48, 48, .3)}{bar(15, 20, 36, 4, .8)}{bar(67, 20, 36, 4, .8)}</Frame>,
  "media-story": <Frame>{box(10, 10, 100, 30, .48)}{bar(22, 48, 76, 4, .9)}{bar(30, 56, 60, 3, .55)}</Frame>,
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
  // `partners` ở trên dùng riêng cho biến thể logo đối tác; khóa loại gốc không còn xuất hiện trong thư viện mới.
  cta: <Frame><rect fill={text} height="34" opacity=".85" rx="5" width="100" x="10" y="19" /><rect fill="#fff" height="5" rx="2" width="44" x="18" y="30" /><rect fill="#fff" height="3" opacity=".6" rx="1.5" width="34" x="18" y="39" /><rect fill="#fff" height="8" rx="4" width="22" x="80" y="31" /></Frame>,
  lead_form: <Frame>{bar(30, 10, 60, 5, 0.9)}{[0, 1].map((index) => <rect height="8" key={index} rx="2" stroke="var(--cms-border-strong)" width="60" x="30" y={22 + index * 12} />)}<rect fill={media} height="8" rx="4" width="30" x="45" y="50" /></Frame>,
  faq: <Frame>{bar(35, 8, 50, 5, 0.9)}{[0, 1, 2, 3].map((index) => <g key={index}><rect height="9" rx="2" stroke="var(--cms-border-strong)" width="90" x="15" y={19 + index * 12} />{bar(19, 22 + index * 12, 40)}<text fill={media} fontSize="8" x="98" y={26 + index * 12}>+</text></g>)}</Frame>,
  rich_text: <Frame>{bar(25, 12, 50, 5, 0.9)}{[0, 1, 2, 3, 4, 5].map((index) => <g key={index}>{bar(25, 24 + index * 7, index === 5 ? 40 : 70)}</g>)}</Frame>,
  image: <Frame>{box(10, 10, 100, 44, 0.3)}{bar(40, 59, 40)}</Frame>,
  video: <Frame>{bar(40, 7, 40, 4, 0.9)}<rect fill={text} height="44" opacity=".85" rx="4" width="78" x="21" y="15" /><rect fill="#e62117" height="14" rx="4" width="20" x="50" y="30" /><path d="M57.5 33.5v7l6-3.5z" fill="#fff" />{bar(45, 64, 30)}</Frame>,
};

export type BlockLibraryItem<Value extends string> = { value: Value; label: string; description: string; group: string; disabledReason?: string; thumbnail?: string };

// Thư viện thành phần: hộp thoại có ô tìm, chia nhóm, mỗi thành phần một thẻ có hình minh họa.
// Dùng <dialog> của trình duyệt nên có sẵn khóa focus, Esc để đóng và nền mờ.
export function BlockLibrary<Value extends string>({ disabled, groups, items, onPick, showGroupPicker = false }: { disabled?: boolean; groups: readonly string[]; items: ReadonlyArray<BlockLibraryItem<Value>>; onPick: (value: Value) => void; showGroupPicker?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const keyword = query.trim().toLocaleLowerCase("vi");
  const searchedItems = keyword ? items.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase("vi").includes(keyword)) : items;
  const shown = activeGroup ? searchedItems.filter((item) => item.group === activeGroup) : searchedItems;
  function close() { dialog.current?.close(); setQuery(""); setActiveGroup(null); }
  function open(group: string | null = null) { setQuery(""); setActiveGroup(group); dialog.current?.showModal(); }
  return <>
    {showGroupPicker ? <section aria-label="Nhóm thành phần" className="admin-block-library__quick">
      <div><strong>Chọn nhóm thành phần</strong><small>Bắt đầu từ mục đích của phần nội dung, rồi chọn kiểu hiển thị phù hợp.</small></div>
      <div className="admin-block-library__quick-groups">{groups.map((group) => {
        const count = items.filter((item) => item.group === group).length;
        return <button disabled={disabled || count === 0} key={group} onClick={() => open(group)} type="button"><strong>{group}</strong><small>{count} thành phần</small></button>;
      })}</div>
    </section> : null}
    <button className="admin-button admin-button--secondary admin-button--sm admin-block-library__open" disabled={disabled} onClick={() => open()} type="button"><Plus aria-hidden="true" size={15} />Thêm thành phần</button>
    <dialog aria-labelledby="block-library-title" className="admin-block-library" onClose={() => setQuery("")} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }} ref={dialog}>
      <header className="admin-block-library__head">
        <h2 id="block-library-title">Thêm thành phần</h2>
        <label className="admin-block-library__search"><Search aria-hidden="true" size={15} /><span className="sr-only">Tìm thành phần</span><input autoFocus className="admin-input" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm: bảng giá, ảnh, đánh giá…" type="search" value={query} /></label>
        <button aria-label="Đóng" className="admin-block-library__close" onClick={close} type="button"><X aria-hidden="true" size={18} /></button>
      </header>
      <div className="admin-block-library__body">
        <nav aria-label="Nhóm thành phần" className="admin-block-library__groups">
          <button aria-pressed={activeGroup === null} onClick={() => setActiveGroup(null)} type="button">Tất cả</button>
          {groups.map((group) => <button aria-pressed={activeGroup === group} key={group} onClick={() => setActiveGroup(group)} type="button">{group}</button>)}
        </nav>
        {groups.map((group) => {
          const groupItems = shown.filter((item) => item.group === group);
          if (!groupItems.length) return null;
          return <section aria-label={group} className="admin-block-library__group" key={group}>
            <h3>{group}</h3>
            <div className="admin-block-library__grid">{groupItems.map((item) => <button className="admin-block-library__item" disabled={Boolean(item.disabledReason)} key={item.value} onClick={() => { onPick(item.value); close(); }} title={item.disabledReason} type="button">
              <span aria-hidden="true" className="admin-block-library__thumb">{blockThumbnails[item.thumbnail ?? item.value]}</span>
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

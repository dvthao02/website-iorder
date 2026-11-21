"use client";

import { ChevronDown, Search } from "lucide-react";
import { useRef, useState } from "react";

import { blockIconGroups, blockIconLabel, blockIcons, type BlockIcon as BlockIconName } from "@iorder/shared/server/shared/block-icons";

import { BlockIcon } from "./block-icon";

// Bộ chọn biểu tượng: bấm ô vuông để mở lưới biểu tượng chia nhóm, có ô tìm theo tên tiếng Việt.
// Người vận hành chọn bằng hình, không phải gõ tên icon.
export function IconPicker({ label, value, onChange, allowNone = true }: { label: string; value: BlockIconName | null; onChange: (value: BlockIconName | null) => void; allowNone?: boolean }) {
  const details = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const keyword = query.trim().toLocaleLowerCase("vi");
  const shown = keyword ? blockIcons.filter((icon) => `${icon.label} ${icon.value}`.toLocaleLowerCase("vi").includes(keyword)) : blockIcons;
  const current = blockIconLabel(value);
  function pick(next: BlockIconName | null) {
    onChange(next);
    setQuery("");
    if (details.current) details.current.open = false;
  }
  return <details className="admin-popover admin-icon-picker" ref={details}>
    <summary aria-label={`${label}: ${current ?? "chưa chọn"}`} className="admin-icon-picker__trigger" title={current ?? "Chọn biểu tượng"}>
      {value ? <BlockIcon name={value} size={18} /> : <span className="admin-icon-picker__empty">—</span>}
      <ChevronDown aria-hidden="true" size={13} />
    </summary>
    <div className="admin-icon-picker__panel" role="dialog" aria-label={label}>
      <label className="admin-icon-picker__search"><Search aria-hidden="true" size={14} /><span className="sr-only">Tìm biểu tượng</span><input className="admin-input" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm: cafe, máy in, spa…" type="search" value={query} /></label>
      <div className="admin-icon-picker__body">
        {allowNone && !keyword ? <button className="admin-icon-picker__none" onClick={() => pick(null)} type="button">Không dùng biểu tượng</button> : null}
        {blockIconGroups.map((group) => {
          const icons = shown.filter((icon) => icon.group === group);
          if (!icons.length) return null;
          return <section aria-label={group} key={group}>
            <h4>{group}</h4>
            <div className="admin-icon-picker__grid">{icons.map((icon) => <button aria-label={icon.label} aria-pressed={icon.value === value} className="admin-icon-picker__option" key={icon.value} onClick={() => pick(icon.value)} title={icon.label} type="button"><BlockIcon name={icon.value} size={18} /></button>)}</div>
          </section>;
        })}
        {shown.length ? null : <p className="admin-help">Không tìm thấy biểu tượng phù hợp.</p>}
      </div>
    </div>
  </details>;
}

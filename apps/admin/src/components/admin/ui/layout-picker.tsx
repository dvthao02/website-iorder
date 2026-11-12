"use client";

import type { ReactNode } from "react";

export type LayoutOption<Value extends string> = { value: Value; label: string; hint: string; preview: ReactNode };

// Chọn kiểu bố cục của một thành phần trang bằng hình minh họa (thay cho danh sách chữ khó hình dung).
// Là nhóm radio thật: bàn phím dùng mũi tên để đổi, trình đọc màn hình đọc nhãn và gợi ý.
export function LayoutPicker<Value extends string>({ label, name, options, value, onChange }: { label: string; name: string; options: ReadonlyArray<LayoutOption<Value>>; value: Value; onChange: (value: Value) => void }) {
  return <fieldset className="admin-layout-picker">
    <legend>{label}</legend>
    <div className="admin-layout-picker__grid">{options.map((option) => <label className={option.value === value ? "admin-layout-picker__option admin-layout-picker__option--active" : "admin-layout-picker__option"} key={option.value} title={option.hint}>
      <input checked={option.value === value} className="sr-only" name={name} onChange={() => onChange(option.value)} type="radio" value={option.value} />
      <span aria-hidden="true" className="admin-layout-picker__preview">{option.preview}</span>
      <span className="admin-layout-picker__label">{option.label}</span>
    </label>)}</div>
    <p className="admin-help">{options.find((option) => option.value === value)?.hint}</p>
  </fieldset>;
}

// Hình minh họa: khung 120×72, khối xám là chữ, khối xanh là ảnh, viên tròn là nút.
export const text = "var(--cms-muted)";
export const media = "var(--cms-primary)";
export function Frame({ children }: { children: ReactNode }) {
  return <svg fill="none" viewBox="0 0 120 72" xmlns="http://www.w3.org/2000/svg"><rect height="71" rx="5" stroke="var(--cms-border-strong)" width="119" x=".5" y=".5" />{children}</svg>;
}
export function TextLines({ x, y, width, light = false }: { x: number; y: number; width: number; light?: boolean }) {
  const color = light ? "#fff" : text;
  return <><rect fill={color} height="6" opacity=".9" rx="2" width={width} x={x} y={y} /><rect fill={color} height="3" opacity=".5" rx="1.5" width={width * 0.85} x={x} y={y + 11} /><rect fill={color} height="3" opacity=".5" rx="1.5" width={width * 0.7} x={x} y={y + 17} /><rect fill={light ? "#fff" : media} height="6" rx="3" width="18" x={x} y={y + 26} /></>;
}

export const heroLayoutPreviews = {
  split: <Frame><TextLines width={44} x={10} y={20} /><rect fill={media} height="44" opacity=".25" rx="4" width="48" x={62} y={14} /></Frame>,
  split_reverse: <Frame><rect fill={media} height="44" opacity=".25" rx="4" width="48" x={10} y={14} /><TextLines width={44} x={66} y={20} /></Frame>,
  background: <Frame><rect fill={media} height="63" opacity=".45" rx="3" width="111" x={4.5} y={4.5} /><TextLines light width={50} x={14} y={20} /></Frame>,
  slider: <Frame><rect fill={media} height="63" opacity=".35" rx="3" width="111" x={4.5} y={4.5} /><path d="M12 36l5-5m-5 5l5 5M108 36l-5-5m5 5l-5 5" stroke="#fff" strokeLinecap="round" strokeWidth="2" /><circle cx="52" cy="62" fill="#fff" r="2" /><circle cx="60" cy="62" fill="#fff" opacity=".5" r="2" /><circle cx="68" cy="62" fill="#fff" opacity=".5" r="2" /></Frame>,
  centered: <Frame><rect fill={text} height="6" opacity=".9" rx="2" width="60" x={30} y={14} /><rect fill={text} height="3" opacity=".5" rx="1.5" width="70" x={25} y={25} /><rect fill={text} height="3" opacity=".5" rx="1.5" width="50" x={35} y={31} /><rect fill={media} height="6" rx="3" width="18" x={41} y={40} /><rect fill={text} height="6" opacity=".35" rx="3" width="18" x={62} y={40} /><rect fill={media} height="12" opacity=".2" rx="3" width="70" x={25} y={52} /></Frame>,
} as const;

// Kiểu thẻ của "Lưới thẻ": gọn (biểu tượng nhỏ), thẻ ảnh (ảnh trên cùng), thẻ lớn nổi bật (1 thẻ to + 4 thẻ nhỏ).
const cardOutline = (x: number, y: number, width: number, height: number) => <rect height={height} rx="3" stroke="var(--cms-border-strong)" width={width} x={x} y={y} />;
export const cardStylePreviews = {
  compact: <Frame>{[0, 1, 2].map((index) => <g key={index}>{cardOutline(10 + index * 35, 14, 30, 44)}<rect fill={media} height="7" opacity=".5" rx="2" width="7" x={14 + index * 35} y="19" /><rect fill={text} height="4" opacity=".9" rx="2" width="20" x={14 + index * 35} y="31" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="22" x={14 + index * 35} y="39" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="16" x={14 + index * 35} y="45" /></g>)}</Frame>,
  visual: <Frame>{[0, 1, 2].map((index) => <g key={index}>{cardOutline(10 + index * 35, 12, 30, 48)}<rect fill={media} height="20" opacity=".3" rx="3" width="30" x={10 + index * 35} y="12" /><rect fill={text} height="4" opacity=".9" rx="2" width="20" x={14 + index * 35} y="38" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="22" x={14 + index * 35} y="46" /></g>)}</Frame>,
  bento: <Frame>{cardOutline(8, 8, 52, 56)}<rect fill={media} height="34" opacity=".3" rx="3" width="52" x="8" y="8" /><rect fill={text} height="5" opacity=".9" rx="2" width="30" x="13" y="47" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="38" x="13" y="56" />{[0, 1, 2, 3].map((index) => { const x = 64 + (index % 2) * 25; const y = 8 + Math.floor(index / 2) * 29; return <g key={index}>{cardOutline(x, y, 22, 27)}<rect fill={media} height="11" opacity=".25" rx="3" width="22" x={x} y={y} /><rect fill={text} height="3" opacity=".8" rx="1.5" width="14" x={x + 3} y={y + 16} /></g>; })}</Frame>,
} as const;

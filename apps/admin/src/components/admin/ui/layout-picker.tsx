"use client";

import React, { type ReactNode } from "react";

import { AdminHelpTip } from "./admin-help-tip";

export type LayoutOption<Value extends string> = { value: Value; label: string; hint: string; preview: ReactNode };

// Chọn kiểu bố cục của một thành phần trang bằng hình minh họa (thay cho danh sách chữ khó hình dung).
// Là nhóm radio thật: bàn phím dùng mũi tên để đổi, trình đọc màn hình đọc nhãn và gợi ý.
export function LayoutPicker<Value extends string>({ label, name, note, options, value, onChange }: { label: string; name: string; /** Lưu ý thêm (nối sau gợi ý của kiểu đang chọn trong chú thích ⓘ). */ note?: string; options: ReadonlyArray<LayoutOption<Value>>; value: Value; onChange: (value: Value) => void }) {
  return <fieldset className="admin-layout-picker">
    <legend>{label}</legend>
    <div className="admin-layout-picker__grid">{options.map((option) => <label className={option.value === value ? "admin-layout-picker__option admin-layout-picker__option--active" : "admin-layout-picker__option"} key={option.value} title={option.hint}>
      <input checked={option.value === value} className="sr-only" name={name} onChange={() => onChange(option.value)} type="radio" value={option.value} />
      <span aria-hidden="true" className="admin-layout-picker__preview">{option.preview}</span>
      <span className="admin-layout-picker__label">{option.label}</span>
    </label>)}</div>
    <AdminHelpTip className="admin-help-tip--corner" label={`Giải thích: ${label}`}>{options.find((option) => option.value === value)?.hint}{note ? <><br />{note}</> : null}</AdminHelpTip>
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
  orbit: <Frame><circle cx="60" cy="40" fill="none" r="17" stroke="var(--cms-primary)" strokeDasharray="2 3" strokeLinecap="round" strokeWidth="1.2" /><circle cx="60" cy="40" fill={media} opacity=".16" r="10.5" /><rect fill={media} height="4" opacity=".75" rx="2" width="9" x="55.5" y="38" />{[[44, 6], [6, 26], [6, 50], [76, 26], [76, 50]].map(([x, y]) => <g key={`${x}-${y}`}><rect fill={media} height="7" opacity=".45" rx="2" width="7" x={x} y={y} /><rect fill={text} height="3" opacity=".85" rx="1.5" width="18" x={x + 10} y={y + 1.5} /><rect fill={text} height="2.5" opacity=".45" rx="1.2" width="26" x={x} y={y + 10} /></g>)}</Frame>,
  document: <Frame>{[0, 1, 2, 3].map((index) => { const x = 8 + index * 27; return <g key={index}>{cardOutline(x, 12, 24, 50)}<rect fill={media} height="26" opacity=".18" rx="2" width="20" x={x + 2} y="14" /><rect fill={media} height="20" opacity=".5" rx="1" width="11" x={x + 6.5} y="17" /><rect fill={text} height="3" opacity=".85" rx="1.5" width="14" x={x + 3} y="46" /><rect fill={text} height="2.5" opacity=".45" rx="1.2" width="18" x={x + 3} y="53" /></g>; })}</Frame>,
  gallery: <Frame>{[[8, 8, 50, 56], [62, 8, 24, 26], [90, 8, 22, 26], [62, 38, 24, 26], [90, 38, 22, 26]].map(([x, y, w, h]) => <g key={`${x}-${y}`}><rect fill={media} height={h} opacity=".28" rx="3" width={w} x={x} y={y} /><rect fill={text} height="2.5" opacity=".8" rx="1.2" width={Math.max(10, w - 12)} x={x + 4} y={y + h - 8} /></g>)}</Frame>,
  network: <Frame><rect fill="var(--cms-primary)" height="10" opacity=".85" rx="5" width="26" x="47" y="5" /><path d="M60 15v6M22 21h76M22 21v6M60 21v6M98 21v6" stroke="var(--cms-primary)" strokeLinecap="round" strokeOpacity=".6" strokeWidth="1.6" fill="none" />{[0, 1, 2].map((index) => <g key={index}>{cardOutline(10 + index * 35, 27, 30, 36)}<rect fill={media} height="14" opacity=".3" rx="3" width="30" x={10 + index * 35} y="27" /><rect fill={text} height="4" opacity=".9" rx="2" width="20" x={15 + index * 35} y="46" /></g>)}<path d="M40 45h5M75 45h5" stroke="var(--cms-primary)" strokeLinecap="round" strokeWidth="1.6" /></Frame>,
  slider: <Frame>{[[8, 12, 33, 40], [45, 12, 33, 40], [82, 12, 30, 40]].map(([x, y, w, h], index) => <g key={x}><rect fill={media} height={h} opacity={index === 1 ? .45 : .28} rx="3" width={w} x={x} y={y} />{index === 1 ? <><rect fill={text} height="3" opacity=".85" rx="1.5" width="20" x="51" y="38" /><rect fill={text} height="2.5" opacity=".5" rx="1.2" width="16" x="51" y="44" /></> : null}</g>)}<rect fill="var(--cms-primary)" height="4" opacity=".9" rx="2" width="14" x="46" y="60" />{[38, 74].map((x) => <circle cx={x} cy="62" fill={text} key={x} opacity=".4" r="2" />)}</Frame>,
  mosaic: <Frame>{[[8, 8, 50, 26], [62, 8, 50, 26], [8, 38, 33, 26], [45, 38, 33, 26], [82, 38, 30, 26]].map(([x, y, w, h]) => <g key={`${x}-${y}`}><rect fill={media} height={h} opacity=".3" rx="3" width={w} x={x} y={y} /><rect fill={text} height="3" opacity=".85" rx="1.5" width={Math.max(10, w - 18)} x={x + 4} y={y + h - 8} /></g>)}</Frame>,
  compact: <Frame>{[0, 1, 2].map((index) => <g key={index}>{cardOutline(10 + index * 35, 14, 30, 44)}<rect fill={media} height="7" opacity=".5" rx="2" width="7" x={14 + index * 35} y="19" /><rect fill={text} height="4" opacity=".9" rx="2" width="20" x={14 + index * 35} y="31" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="22" x={14 + index * 35} y="39" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="16" x={14 + index * 35} y="45" /></g>)}</Frame>,
  visual: <Frame>{[0, 1, 2].map((index) => <g key={index}>{cardOutline(10 + index * 35, 12, 30, 48)}<rect fill={media} height="20" opacity=".3" rx="3" width="30" x={10 + index * 35} y="12" /><rect fill={text} height="4" opacity=".9" rx="2" width="20" x={14 + index * 35} y="38" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="22" x={14 + index * 35} y="46" /></g>)}</Frame>,
  bento: <Frame>{cardOutline(8, 8, 52, 56)}<rect fill={media} height="34" opacity=".3" rx="3" width="52" x="8" y="8" /><rect fill={text} height="5" opacity=".9" rx="2" width="30" x="13" y="47" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="38" x="13" y="56" />{[0, 1, 2, 3].map((index) => { const x = 64 + (index % 2) * 25; const y = 8 + Math.floor(index / 2) * 29; return <g key={index}>{cardOutline(x, y, 22, 27)}<rect fill={media} height="11" opacity=".25" rx="3" width="22" x={x} y={y} /><rect fill={text} height="3" opacity=".8" rx="1.5" width="14" x={x + 3} y={y + 16} /></g>; })}</Frame>,
} as const;

// Kiểu hiển thị danh sách bài viết: lưới thẻ (ảnh trên, chữ dưới), một bài nổi bật + danh sách gọn, từng hàng ảnh trái – chữ phải.
export const collectionLayoutPreviews = {
  grid: <Frame>{[0, 1, 2].map((index) => <g key={index}>{cardOutline(10 + index * 35, 12, 30, 48)}<rect fill={media} height="20" opacity=".3" rx="3" width="30" x={10 + index * 35} y="12" /><rect fill={text} height="4" opacity=".9" rx="2" width="20" x={15 + index * 35} y="38" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="16" x={15 + index * 35} y="47" /></g>)}</Frame>,
  featured: <Frame>{cardOutline(8, 9, 62, 54)}<rect fill={media} height="30" opacity=".3" rx="3" width="62" x="8" y="9" /><rect fill={text} height="5" opacity=".9" rx="2" width="40" x="14" y="46" /><rect fill={text} height="3" opacity=".5" rx="1.5" width="30" x="14" y="55" />{[0, 1, 2].map((index) => <g key={index}>{cardOutline(76, 9 + index * 19, 36, 16)}<rect fill={media} height="10" opacity=".3" rx="2" width="12" x="79" y={12 + index * 19} /><rect fill={text} height="3" opacity=".8" rx="1.5" width="16" x="94" y={13 + index * 19} /><rect fill={text} height="3" opacity=".5" rx="1.5" width="12" x="94" y={19 + index * 19} /></g>)}</Frame>,
  list: <Frame>{[0, 1].map((column) => [0, 1, 2].map((row) => <g key={`${column}-${row}`}>{cardOutline(8 + column * 55, 9 + row * 19, 50, 16)}<rect fill={media} height="10" opacity=".3" rx="2" width="14" x={11 + column * 55} y={12 + row * 19} /><rect fill={text} height="3" opacity=".8" rx="1.5" width="24" x={29 + column * 55} y={13 + row * 19} /><rect fill={text} height="3" opacity=".5" rx="1.5" width="18" x={29 + column * 55} y={19 + row * 19} /></g>))}</Frame>,
} as const;

"use client";

import { detailHeroLayoutSchema, type DetailHeroLayout } from "@iorder/shared/server/shared/appearance";
import { LayoutPicker, heroLayoutPreviews, type LayoutOption } from "./layout-picker";

const layoutOptions: ReadonlyArray<LayoutOption<DetailHeroLayout["layout"]>> = [
  { value: "split", label: "Chữ trái · ảnh phải", hint: "Tên, mô tả và nút bên trái; ảnh bìa bên phải.", preview: heroLayoutPreviews.split },
  { value: "split_reverse", label: "Ảnh trái · chữ phải", hint: "Ảnh bìa bên trái; tên, mô tả và nút bên phải.", preview: heroLayoutPreviews.split_reverse },
  { value: "centered", label: "Chữ ở giữa", hint: "Chữ căn giữa, ảnh bìa nằm bên dưới. Hợp với ảnh rộng.", preview: heroLayoutPreviews.centered },
];

/** Bố cục phần đầu trang chi tiết (sản phẩm, dịch vụ, thiết bị): vị trí ảnh, chiều cao, nền. Thiếu giá trị thì dùng mặc định. */
export function DetailHeroLayoutFields({ name, value, onChange, disabled }: { name: string; value: Partial<DetailHeroLayout> | null | undefined; onChange: (next: DetailHeroLayout) => void; disabled?: boolean }) {
  const layout = detailHeroLayoutSchema.parse(value ?? {});
  const set = (patch: Partial<DetailHeroLayout>) => onChange({ ...layout, ...patch });
  return <>
    <LayoutPicker label="Vị trí ảnh" name={name} onChange={next => set({ layout: next })} options={layoutOptions} value={layout.layout} />
    <div className="admin-form-grid">
      <label className="admin-field">Chiều cao<select className="admin-input" disabled={disabled} onChange={event => set({ height: event.target.value as DetailHeroLayout["height"] })} value={layout.height}><option value="screen">Cả màn hình</option><option value="auto">Theo nội dung</option></select></label>
      <label className="admin-field">Nền<select className="admin-input" disabled={disabled} onChange={event => set({ background: event.target.value as DetailHeroLayout["background"] })} value={layout.background}><option value="default">Xám nhạt (mặc định)</option><option value="white">Trắng</option><option value="tinted">Xanh nhạt</option></select></label>
    </div>
  </>;
}

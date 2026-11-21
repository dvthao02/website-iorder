"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { detailHeroLayoutSchema, type DetailHeroLayout } from "@iorder/shared/server/shared/appearance";
import { MediaPicker } from "../media-picker";
import { AdminButton } from "./admin-button";
import { AdminListRowControls, moveListItem } from "./admin-list-editor";
import { AppearanceEditor, MinHeightControl, defaultAppearance } from "../block-appearance-fields";
import { LayoutPicker, heroLayoutPreviews, type LayoutOption } from "./layout-picker";

const layoutOptions: ReadonlyArray<LayoutOption<DetailHeroLayout["layout"]>> = [
  { value: "split", label: "Chữ trái · ảnh phải", hint: "Tên, mô tả và nút bên trái; ảnh bìa bên phải.", preview: heroLayoutPreviews.split },
  { value: "split_reverse", label: "Ảnh trái · chữ phải", hint: "Ảnh bìa bên trái; tên, mô tả và nút bên phải.", preview: heroLayoutPreviews.split_reverse },
  { value: "centered", label: "Chữ ở giữa", hint: "Chữ căn giữa, ảnh bìa nằm bên dưới. Hợp với ảnh rộng.", preview: heroLayoutPreviews.centered },
  { value: "background", label: "Ảnh nền tràn màn hình", hint: "Ảnh bìa trải làm nền, chữ trắng nằm trên lớp phủ tối. Hợp với ảnh rộng, ít chi tiết.", preview: heroLayoutPreviews.background },
];

const maxExtraImages = 7;

// Ảnh trượt thêm (ngoài ảnh bìa). Ô vừa thêm chưa chọn ảnh chỉ nằm trong form, không gửi đi cho tới khi chọn ảnh.
function HeroExtraImages({ ids, onChange, disabled, onUploadingChange }: { ids: string[]; onChange: (ids: string[]) => void; disabled?: boolean; onUploadingChange?: (pending: boolean) => void }) {
  const [draft, setDraft] = useState(ids);
  // Giá trị đổi từ bên ngoài (bỏ thay đổi, khôi phục phiên bản) thì lấy lại theo đó.
  if (draft.filter(Boolean).join() !== ids.join()) setDraft(ids);
  const update = (next: string[]) => { setDraft(next); onChange(next.filter(Boolean)); };
  return <div className="admin-field admin-field--wide">
    <span className="admin-label-row">Ảnh trượt thêm ({ids.length}/{maxExtraImages})</span>
    <p className="admin-help">Thêm ảnh để phần đầu trang tự chuyển ảnh (ảnh bìa là ảnh đầu tiên), kèm chấm để xem từng ảnh. Dùng được với mọi vị trí ảnh, kể cả “Ảnh nền tràn màn hình”. Nên chọn ảnh cùng tỉ lệ với ảnh bìa.</p>
    {draft.length ? <ol className="admin-list-editor__rows">{draft.map((id, index) => <li className="admin-list-editor__row" key={index}>
      <span aria-hidden="true" className="admin-list-editor__index">{index + 1}</span>
      <MediaPicker compact disabled={disabled} label={`Ảnh trượt ${index + 1}`} onChange={next => update(draft.map((entry, entryIndex) => entryIndex === index ? next ?? "" : entry))} onUploadingChange={onUploadingChange ?? (() => {})} preview value={id || null} />
      <AdminListRowControls index={index} label={`ảnh trượt ${index + 1}`} length={draft.length} onMove={direction => update(moveListItem(draft, index, direction))} onRemove={() => update(draft.filter((_, entryIndex) => entryIndex !== index))} />
    </li>)}</ol> : null}
    <AdminButton className="justify-self-start" disabled={disabled || draft.length >= maxExtraImages} leadingIcon={<Plus aria-hidden="true" size={15} />} onClick={() => setDraft([...draft, ""])} size="sm" variant="secondary">Thêm ảnh trượt</AdminButton>
  </div>;
}

/**
 * Bố cục phần đầu trang chi tiết (sản phẩm, dịch vụ, thiết bị): vị trí ảnh, chiều cao, rồi nền với cùng một bộ lựa chọn như mọi phần khác
 * (xám nhạt / trắng / xanh nhạt / tối / màu tự chọn, ảnh nền phủ lớp màu). Thiếu giá trị thì dùng mặc định.
 */
export function DetailHeroLayoutFields({ name, value, onChange, disabled, onUploadingChange }: { name: string; value: Partial<DetailHeroLayout> | null | undefined; onChange: (next: DetailHeroLayout) => void; disabled?: boolean; onUploadingChange?: (pending: boolean) => void }) {
  const layout = detailHeroLayoutSchema.parse(value ?? {});
  const set = (patch: Partial<DetailHeroLayout>) => onChange({ ...layout, ...patch });
  // Dữ liệu cũ chọn nền trong ô riêng (background): hiện đúng lựa chọn đó, và chuyển hẳn sang ô nền chung khi người vận hành đổi.
  const appearance = { ...defaultAppearance, ...layout.appearance };
  const shown = appearance.tone === "auto" && layout.background !== "default" ? { ...appearance, tone: layout.background } : appearance;
  return <>
    <LayoutPicker label="Vị trí ảnh" name={name} onChange={next => set({ layout: next })} options={layoutOptions} value={layout.layout} />
    <HeroExtraImages disabled={disabled} ids={layout.extraMediaIds} onChange={extraMediaIds => set({ extraMediaIds })} onUploadingChange={onUploadingChange} />
    <div className="admin-form-grid">
      <label className="admin-field">Chiều cao<select className="admin-input" disabled={disabled} onChange={event => set({ height: event.target.value as DetailHeroLayout["height"] })} value={layout.height}><option value="screen">Cả màn hình</option><option value="three_quarter">3/4 màn hình</option><option value="half">Một nửa màn hình</option><option value="auto">Theo nội dung</option><option value="custom">Tùy chỉnh (px, vh, tỉ lệ)</option></select></label>
    </div>
    {layout.height === "custom" ? <MinHeightControl disabled={disabled} minHeight={shown.minHeight} onChange={patch => set({ appearance: { ...shown, ...patch } })} unit={shown.minHeightUnit} /> : null}
    <AppearanceEditor disabled={disabled} onChange={patch => set({ background: "default", appearance: { ...shown, ...patch } })} onUploadingChange={onUploadingChange} options={{ autoLabel: "Xám nhạt (mặc định)", spacing: false, width: true }} value={shown} />
  </>;
}

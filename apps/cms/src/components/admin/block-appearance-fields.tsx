"use client";

import { useEffect, useState } from "react";

import { mediaAssetSchema } from "@iorder/core/server/media/media.contract";
import { blockAnchor, blockSupportsDarkTone, isDarkColor } from "@iorder/core/server/pages/block-layout";
import {
  blockOverlayLimits, blockSpacingSchema, blockToneSchema, blockWidthLimits,
  type BlockAppearance, type BlockSpacing, type BlockTone, type PageBlock,
} from "@iorder/core/server/pages/pages.contract";
import { readAdminJson } from "@/lib/admin-api";
import { MediaPicker } from "./media-picker";

// Vỏ chung của mọi khối (trừ phần đầu trang): nền (màu có sẵn, màu tự chọn, ảnh nền), độ rộng nội dung,
// khoảng cách, mã neo. "Tự động" để website giữ nhịp đều: nền xen kẽ trắng / xanh nhạt, khoảng cách chuẩn theo loại khối.
// Ô xem trước bên cạnh vẽ đúng màu chữ website sẽ dùng (màu tối → chữ trắng), lớp phủ ảnh nền và độ rộng.
export const defaultAppearance: BlockAppearance = { anchor: null, tone: "auto", spacing: "auto", width: null, backgroundColor: null, backgroundMediaId: null, backgroundOverlay: 80 };

const toneLabels: Record<BlockTone, string> = { auto: "Tự động (xen kẽ với phần trước)", white: "Trắng", tinted: "Xanh nhạt", dark: "Tối (chữ trắng)", custom: "Màu tự chọn…" };
const spacingLabels: Record<BlockSpacing, string> = { auto: "Tự động", sm: "Gọn", md: "Vừa", lg: "Rộng" };
// Màu gợi ý hợp với bộ màu website: tông sáng (chữ đậm) và vài tông đậm làm điểm nhấn (chữ trắng).
const swatches = [
  { value: "#ffffff", label: "Trắng" },
  { value: "#f1f7fe", label: "Xanh rất nhạt" },
  { value: "#d9ebff", label: "Xanh nhạt" },
  { value: "#f8fafc", label: "Xám nhạt" },
  { value: "#fff7ed", label: "Cam nhạt" },
  { value: "#ecfdf5", label: "Xanh lá nhạt" },
  { value: "#f5f3ff", label: "Tím nhạt" },
  { value: "#1570e0", label: "Xanh thương hiệu" },
  { value: "#0a2a57", label: "Xanh đêm" },
  { value: "#0d1b33", label: "Đen than" },
] as const;
const toneColors = { white: "#ffffff", tinted: "#f1f7fe", dark: "#0a2a57" } as const;
const widthPresets = [60, 70, 80, 90, 100] as const;
const hexPattern = /^#[0-9a-f]{6}$/i;

/** Gắn mã neo vào vỏ chung; trường neo cũ của "Kêu gọi hành động" và "Danh sách nội dung" chuyển hẳn sang đây. */
function withAnchor(block: PageBlock, anchor: string | null): PageBlock {
  const appearance = { ...defaultAppearance, ...block.appearance, anchor };
  if (block.type === "cta") return { ...block, appearance, data: { ...block.data, id: null } };
  if (block.type === "collection_list") return { ...block, appearance, data: { ...block.data, anchor: null } };
  return { ...block, appearance };
}

// Địa chỉ ảnh nền đã chọn, để vẽ ô xem trước (lỗi hoặc không phải ảnh thì xem trước không có ảnh).
function useMediaUrl(id: string | null) {
  const [result, setResult] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/admin/media/${encodeURIComponent(id)}`, { signal: controller.signal }).then(async (response) => {
      const payload = await readAdminJson(response);
      const parsed = mediaAssetSchema.safeParse(payload?.asset);
      if (!controller.signal.aborted) setResult({ id, url: response.ok && parsed.success && parsed.data.mimeType.startsWith("image/") ? parsed.data.url : null });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ id, url: null });
    });
    return () => controller.abort();
  }, [id]);
  return id && result?.id === id ? result.url : null;
}

export function BlockAppearanceFields({ block, onChange, disabled, onUploadingChange }: { block: PageBlock; onChange: (block: PageBlock) => void; disabled?: boolean; onUploadingChange?: (pending: boolean) => void }) {
  const appearance = { ...defaultAppearance, ...block.appearance };
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const imageUrl = useMediaUrl(appearance.backgroundMediaId);
  // "Ảnh + chữ" cũ chọn nền xanh nhạt trong ô riêng: hiện đúng lựa chọn đó, đổi nền thì bỏ ô cũ.
  const tone = appearance.tone === "auto" && block.type === "media_text" && block.data.tone === "tinted" ? "tinted" : appearance.tone;
  const darkAllowed = blockSupportsDarkTone(block.type);
  const tones = blockToneSchema.options.filter((value) => value !== "dark" || darkAllowed);

  function update(patch: Partial<BlockAppearance>) {
    const updated = { ...block, appearance: { ...appearance, ...patch } } as PageBlock;
    onChange("tone" in patch && updated.type === "media_text" ? { ...updated, data: { ...updated.data, tone: "light" } } : updated);
  }
  function setTone(next: BlockTone) {
    update(next === "custom" && !appearance.backgroundColor ? { tone: next, backgroundColor: swatches[1].value } : { tone: next });
  }

  // Cùng quy tắc với website (block-layout.ts): màu tối → chữ trắng; khối không hợp nền tối thì về xanh nhạt.
  const color = tone === "custom" ? appearance.backgroundColor ?? swatches[1].value : null;
  const colorDark = color ? isDarkColor(color) : false;
  const darkFallback = colorDark && !darkAllowed;
  const previewDark = color ? colorDark && darkAllowed : tone === "dark";
  const previewColor = color && !darkFallback ? color : toneColors[previewDark ? "dark" : tone === "tinted" || darkFallback ? "tinted" : "white"];
  const width = appearance.width ?? 100;
  const setWidth = (value: number) => update({ width: value >= blockWidthLimits.max ? null : Math.max(blockWidthLimits.min, value) });

  return <fieldset className="admin-block-group">
    <legend>Giao diện khối: nền, độ rộng, khoảng cách</legend>
    <div className="admin-appearance">
      <div className="admin-appearance__controls">
        <div className="admin-form-grid">
          <label className="admin-field">Nền<select className="admin-input" disabled={disabled} onChange={(event) => setTone(event.target.value as BlockTone)} value={tone}>{tones.map((value) => <option key={value} value={value}>{toneLabels[value]}</option>)}</select></label>
          <label className="admin-field">Khoảng cách trên dưới<select className="admin-input" disabled={disabled} onChange={(event) => update({ spacing: event.target.value as BlockSpacing })} value={appearance.spacing}>{blockSpacingSchema.options.map((value) => <option key={value} value={value}>{spacingLabels[value]}</option>)}</select></label>
        </div>

        {color ? <div className="admin-appearance__colors">
          <div aria-label="Màu nền gợi ý" className="admin-swatches" role="radiogroup">{swatches.map((swatch) => <button aria-checked={color === swatch.value} aria-label={swatch.label} className="admin-swatch" disabled={disabled} key={swatch.value} onClick={() => { setHexDraft(null); update({ backgroundColor: swatch.value }); }} role="radio" style={{ background: swatch.value }} title={swatch.label} type="button" />)}</div>
          <div className="admin-appearance__picker">
            <input aria-label="Chọn màu nền khác" disabled={disabled} onChange={(event) => { setHexDraft(null); update({ backgroundColor: event.target.value.toLowerCase() }); }} type="color" value={color} />
            <input aria-label="Mã màu nền" className="admin-input" disabled={disabled} maxLength={7} onBlur={() => setHexDraft(null)} onChange={(event) => {
              const next = event.target.value.trim();
              setHexDraft(next);
              if (hexPattern.test(next)) update({ backgroundColor: next.toLowerCase() });
            }} placeholder="#f1f7fe" spellCheck={false} value={hexDraft ?? color} />
          </div>
          <p className={darkFallback ? "admin-help admin-text-warning" : "admin-help"}>{darkFallback
            ? "Khối này có nhiều chữ hoặc ô nhập, đặt trên nền tối sẽ khó đọc nên website dùng nền xanh nhạt. Chọn màu sáng hơn để giữ màu riêng."
            : colorDark ? "Màu tối: website tự dùng chữ trắng." : "Màu sáng: website dùng chữ đậm như bình thường."}</p>
        </div> : null}

        <MediaPicker disabled={disabled} hint="Ảnh phủ kín nền khối, bên trên là một lớp màu nền để chữ luôn đọc được. Nên dùng ảnh ngang, ít chi tiết." label="Ảnh nền (tùy chọn)" onChange={(backgroundMediaId) => update({ backgroundMediaId })} onUploadingChange={onUploadingChange} preview value={appearance.backgroundMediaId} />
        {appearance.backgroundMediaId ? <label className="admin-field">Độ phủ màu nền lên ảnh: {appearance.backgroundOverlay}%
          <input className="admin-range" disabled={disabled} max={blockOverlayLimits.max} min={blockOverlayLimits.min} onChange={(event) => update({ backgroundOverlay: Number(event.target.value) })} step={5} type="range" value={appearance.backgroundOverlay} />
          <small className="admin-help">Càng cao ảnh càng mờ, chữ càng dễ đọc. Khoảng 70–85% hợp với khối nhiều chữ.</small>
        </label> : null}

        <div className="admin-field">
          <span>Độ rộng nội dung: <strong>{appearance.width ? `${width}%` : "Mặc định (100%)"}</strong></span>
          <div className="admin-appearance__width">
            <input aria-label="Độ rộng nội dung (%)" className="admin-range" disabled={disabled} max={blockWidthLimits.max} min={blockWidthLimits.min} onChange={(event) => setWidth(Number(event.target.value))} step={5} type="range" value={width} />
            <div aria-label="Độ rộng có sẵn" className="admin-chips" role="group">{widthPresets.map((value) => <button aria-pressed={width === value} className={width === value ? "admin-chip admin-chip--active" : "admin-chip"} disabled={disabled} key={value} onClick={() => setWidth(value)} type="button">{value === 100 ? "Mặc định" : `${value}%`}</button>)}</div>
          </div>
          <small className="admin-help">Thu hẹp phần nội dung và căn giữa (nền vẫn tràn hết bề ngang). Điện thoại luôn rộng hết khung.</small>
        </div>

        <label className="admin-field">Mã neo (tùy chọn, ví dụ bang-gia để liên kết tới #bang-gia)<input disabled={disabled} onChange={(event) => onChange(withAnchor(block, event.target.value === "" ? null : event.target.value.trim().toLowerCase()))} value={blockAnchor(block) ?? ""} /></label>
      </div>

      <figure className="admin-appearance__preview">
        <div aria-hidden="true" className="admin-appearance__surface" style={{ backgroundColor: previewColor, color: previewDark ? "#ffffff" : "#0d1b33" }}>
          {imageUrl ? <>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước trong CMS, không cần tối ưu */}
            <img alt="" className="admin-appearance__image" src={imageUrl} />
            <span className="admin-appearance__overlay" style={{ background: previewColor, opacity: appearance.backgroundOverlay / 100 }} />
          </> : null}
          <span className="admin-appearance__content" style={{ width: `${width}%` }}>
            <strong>Tiêu đề phần</strong>
            <span>Chữ mô tả hiển thị trên nền này.</span>
            <span className="admin-appearance__cards"><i /><i /><i /></span>
          </span>
        </div>
        <figcaption className="admin-help">{tone === "auto" ? "Xem trước nền trắng; “Tự động” thì website chọn trắng hoặc xanh nhạt khác phần ngay trước." : "Xem trước nền, màu chữ và độ rộng trên máy tính."}</figcaption>
      </figure>
    </div>
    <p className="admin-help">Hai phần liền nhau cùng nền trắng / xanh nhạt thì website thêm vạch ngăn mảnh. Nên dùng nền tối hoặc màu đậm cho tối đa một hai phần mỗi trang để làm điểm nhấn.</p>
  </fieldset>;
}

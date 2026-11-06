"use client";

import { Pipette } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { mediaAssetSchema } from "@iorder/core/server/media/media.contract";
import { blockAnchor, blockSupportsDarkTone } from "@iorder/core/server/pages/block-layout";
import { heroToneOf, type PageBlock } from "@iorder/core/server/pages/pages.contract";
import {
  blockOverlayLimits, blockSpacingSchema, blockWidthLimits, isDarkColor,
  type BlockAppearance, type BlockSpacing, type BlockTone,
} from "@iorder/core/server/shared/appearance";
import { readAdminJson } from "@/lib/admin-api";
import { MediaPicker } from "./media-picker";

// Giao diện của một phần trang (khối trang, phần đầu trang, các phần của trang sản phẩm): nền (màu có sẵn, màu tự chọn,
// ảnh nền), độ rộng nội dung, khoảng cách, mã neo. "Tự động" để website giữ nhịp đều: nền xen kẽ trắng / xanh nhạt.
// Ô xem trước bên cạnh vẽ đúng màu chữ website sẽ dùng (màu tối → chữ trắng), lớp phủ ảnh nền và độ rộng.
export const defaultAppearance: BlockAppearance = { anchor: null, tone: "auto", spacing: "auto", width: null, backgroundColor: null, backgroundMediaId: null, backgroundOverlay: 80 };

const toneLabels: Record<BlockTone, string> = { auto: "Tự động (xen kẽ với phần trước)", white: "Trắng", tinted: "Xanh nhạt", dark: "Tối (chữ trắng)", custom: "Màu tự chọn…" };
const spacingLabels: Record<BlockSpacing, string> = { auto: "Tự động", sm: "Gọn", md: "Vừa", lg: "Rộng" };
// Màu gợi ý hợp với bộ màu website: tông sáng (chữ đậm) và vài tông đậm làm điểm nhấn (chữ trắng).
export const colorSwatches = [
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

// Ống hút màu của trình duyệt (Chrome/Edge máy tính); trình duyệt chưa hỗ trợ thì không hiện nút.
const subscribeNever = () => () => {};
type EyeDropperApi = { open: () => Promise<{ sRGBHex: string }> };
function useEyeDropper() {
  const supported = useSyncExternalStore(subscribeNever, () => "EyeDropper" in window, () => false);
  if (!supported) return null;
  return async () => {
    const Dropper = (window as unknown as { EyeDropper: new () => EyeDropperApi }).EyeDropper;
    try {
      const { sRGBHex } = await new Dropper().open();
      return hexPattern.test(sRGBHex) ? sRGBHex.toLowerCase() : null;
    } catch {
      return null; // Người dùng bấm Esc.
    }
  };
}

/** Ô chọn màu: dải màu gợi ý, ô màu của trình duyệt, ống hút, mã hex. `allowNone`: thêm lựa chọn "Mặc định" (không màu riêng). */
export function ColorField({ value, onChange, disabled, allowNone = false, compact = false, label = "Màu nền" }: { value: string | null; onChange: (value: string | null) => void; disabled?: boolean; allowNone?: boolean; compact?: boolean; label?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const pick = useEyeDropper();
  const set = (next: string | null) => { setDraft(null); onChange(next); };
  return <div className={compact ? "admin-color-field admin-color-field--compact" : "admin-color-field"}>
    <div aria-label={`${label}: màu gợi ý`} className="admin-swatches" role="radiogroup">
      {allowNone ? <button aria-checked={value === null} aria-label="Mặc định" className="admin-swatch admin-swatch--none" disabled={disabled} onClick={() => set(null)} role="radio" title="Mặc định (không màu riêng)" type="button" /> : null}
      {colorSwatches.map((swatch) => <button aria-checked={value === swatch.value} aria-label={swatch.label} className="admin-swatch" disabled={disabled} key={swatch.value} onClick={() => set(swatch.value)} role="radio" style={{ background: swatch.value }} title={swatch.label} type="button" />)}
    </div>
    <div className="admin-appearance__picker">
      <input aria-label={`${label}: chọn màu khác`} disabled={disabled} onChange={(event) => set(event.target.value.toLowerCase())} type="color" value={value ?? "#ffffff"} />
      {pick ? <button aria-label="Hút màu trên màn hình" className="admin-eyedropper" disabled={disabled} onClick={async () => { const color = await pick(); if (color) set(color); }} title="Hút màu: bấm rồi chọn một điểm bất kỳ trên màn hình (logo, ảnh…)" type="button"><Pipette aria-hidden="true" size={16} /></button> : null}
      <input aria-label={`${label}: mã màu`} className="admin-input" disabled={disabled} maxLength={7} onBlur={() => setDraft(null)} onChange={(event) => {
        const next = event.target.value.trim();
        setDraft(next);
        if (hexPattern.test(next)) onChange(next.toLowerCase());
        else if (allowNone && next === "") onChange(null);
      }} placeholder={allowNone ? "Mặc định" : "#f1f7fe"} spellCheck={false} value={draft ?? value ?? ""} />
    </div>
  </div>;
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

export type AppearanceEditorOptions = {
  /** Các lựa chọn của ô "Nền" (mặc định: đủ, bỏ "Tối" khi phần không hợp nền tối). */
  tones?: readonly BlockTone[];
  /** Nhãn riêng cho "Tự động" (ví dụ phần đầu trang: theo ô Nền của chính nó). */
  autoLabel?: string;
  /** Màu và sắc thái chữ để xem trước khi để "Tự động". */
  autoPreview?: { color: string; dark: boolean };
  darkAllowed?: boolean;
  spacing?: boolean;
  image?: boolean;
  /** Lý do không có ảnh nền (hiện thay cho ô chọn ảnh). */
  imageNote?: string;
  width?: boolean;
};

/** Trình chỉnh giao diện theo giá trị; `extra` (ví dụ ô mã neo) nằm cuối cột điều khiển. */
export function AppearanceEditor({ value, onChange, disabled, onUploadingChange, options = {}, extra }: { value: Partial<BlockAppearance> | null | undefined; onChange: (patch: Partial<BlockAppearance>) => void; disabled?: boolean; onUploadingChange?: (pending: boolean) => void; options?: AppearanceEditorOptions; extra?: ReactNode }) {
  const appearance = { ...defaultAppearance, ...value };
  const imageUrl = useMediaUrl(options.image === false ? null : appearance.backgroundMediaId);
  const darkAllowed = options.darkAllowed ?? true;
  const tones = (options.tones ?? (["auto", "white", "tinted", "dark", "custom"] as const)).filter((tone) => tone !== "dark" || darkAllowed);
  const tone = tones.includes(appearance.tone) ? appearance.tone : "auto";
  const setTone = (next: BlockTone) => onChange(next === "custom" && !appearance.backgroundColor ? { tone: next, backgroundColor: colorSwatches[1].value } : { tone: next });

  // Cùng quy tắc với website (block-layout.ts): màu tối → chữ trắng; phần không hợp nền tối thì về xanh nhạt.
  const color = tone === "custom" ? appearance.backgroundColor ?? colorSwatches[1].value : null;
  const colorDark = color ? isDarkColor(color) : false;
  const darkFallback = colorDark && !darkAllowed;
  const auto = options.autoPreview ?? { color: toneColors.white, dark: false };
  const previewDark = color ? colorDark && darkAllowed : tone === "auto" ? auto.dark : tone === "dark";
  const previewColor = color && !darkFallback ? color : darkFallback ? toneColors.tinted : tone === "auto" ? auto.color : toneColors[tone === "dark" ? "dark" : tone === "tinted" ? "tinted" : "white"];
  const width = appearance.width ?? 100;
  const setWidth = (next: number) => onChange({ width: next >= blockWidthLimits.max ? null : Math.max(blockWidthLimits.min, next) });
  const showImage = options.image !== false;
  const showWidth = options.width !== false;

  return <div className="admin-appearance">
    <div className="admin-appearance__controls">
      <div className="admin-form-grid">
        <label className="admin-field">Nền<select className="admin-input" disabled={disabled} onChange={(event) => setTone(event.target.value as BlockTone)} value={tone}>{tones.map((value) => <option key={value} value={value}>{value === "auto" && options.autoLabel ? options.autoLabel : toneLabels[value]}</option>)}</select></label>
        {options.spacing !== false ? <label className="admin-field">Khoảng cách trên dưới<select className="admin-input" disabled={disabled} onChange={(event) => onChange({ spacing: event.target.value as BlockSpacing })} value={appearance.spacing}>{blockSpacingSchema.options.map((value) => <option key={value} value={value}>{spacingLabels[value]}</option>)}</select></label> : null}
      </div>

      {color ? <div className="admin-appearance__colors">
        <ColorField disabled={disabled} onChange={(next) => onChange({ backgroundColor: next ?? colorSwatches[1].value })} value={color} />
        <p className={darkFallback ? "admin-help admin-text-warning" : "admin-help"}>{darkFallback
          ? "Phần này có nhiều chữ hoặc ô nhập, đặt trên nền tối sẽ khó đọc nên website dùng nền xanh nhạt. Chọn màu sáng hơn để giữ màu riêng."
          : colorDark ? "Màu tối: website tự dùng chữ trắng." : "Màu sáng: website dùng chữ đậm như bình thường."}</p>
      </div> : null}

      {showImage ? <>
        <MediaPicker disabled={disabled} hint="Ảnh phủ kín nền, bên trên là một lớp màu nền để chữ luôn đọc được. Nên dùng ảnh ngang, ít chi tiết." label="Ảnh nền (tùy chọn)" onChange={(backgroundMediaId) => onChange({ backgroundMediaId })} onUploadingChange={onUploadingChange} preview value={appearance.backgroundMediaId} />
        {appearance.backgroundMediaId ? <label className="admin-field">Độ phủ màu nền lên ảnh: {appearance.backgroundOverlay}%
          <input className="admin-range" disabled={disabled} max={blockOverlayLimits.max} min={blockOverlayLimits.min} onChange={(event) => onChange({ backgroundOverlay: Number(event.target.value) })} step={5} type="range" value={appearance.backgroundOverlay} />
          <small className="admin-help">Càng cao ảnh càng mờ, chữ càng dễ đọc. Khoảng 70–85% hợp với phần nhiều chữ.</small>
        </label> : null}
      </> : options.imageNote ? <p className="admin-help">{options.imageNote}</p> : null}

      {showWidth ? <div className="admin-field">
        <span>Độ rộng nội dung: <strong>{appearance.width ? `${width}%` : "Mặc định (100%)"}</strong></span>
        <div className="admin-appearance__width">
          <input aria-label="Độ rộng nội dung (%)" className="admin-range" disabled={disabled} max={blockWidthLimits.max} min={blockWidthLimits.min} onChange={(event) => setWidth(Number(event.target.value))} step={5} type="range" value={width} />
          <div aria-label="Độ rộng có sẵn" className="admin-chips" role="group">{widthPresets.map((value) => <button aria-pressed={width === value} className={width === value ? "admin-chip admin-chip--active" : "admin-chip"} disabled={disabled} key={value} onClick={() => setWidth(value)} type="button">{value === 100 ? "Mặc định" : `${value}%`}</button>)}</div>
        </div>
        <small className="admin-help">Thu hẹp phần nội dung và căn giữa (nền vẫn tràn hết bề ngang). Điện thoại luôn rộng hết khung.</small>
      </div> : null}
      {extra}
    </div>

    <figure className="admin-appearance__preview">
      <div aria-hidden="true" className="admin-appearance__surface" style={{ backgroundColor: previewColor, color: previewDark ? "#ffffff" : "#0d1b33" }}>
        {imageUrl ? <>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh xem trước trong CMS, không cần tối ưu */}
          <img alt="" className="admin-appearance__image" src={imageUrl} />
          <span className="admin-appearance__overlay" style={{ background: previewColor, opacity: appearance.backgroundOverlay / 100 }} />
        </> : null}
        <span className="admin-appearance__content" style={{ width: `${showWidth ? width : 100}%` }}>
          <strong>Tiêu đề phần</strong>
          <span>Chữ mô tả hiển thị trên nền này.</span>
          <span className="admin-appearance__cards"><i /><i /><i /></span>
        </span>
      </div>
      <figcaption className="admin-help">{tone === "auto" && !options.autoPreview ? "Xem trước nền trắng; “Tự động” thì website chọn trắng hoặc xanh nhạt khác phần ngay trước." : "Xem trước nền, màu chữ và độ rộng trên máy tính."}</figcaption>
    </figure>
  </div>;
}

/** Gắn mã neo vào vỏ chung; trường neo cũ của "Kêu gọi hành động" và "Danh sách nội dung" chuyển hẳn sang đây. */
function withAnchor(block: PageBlock, anchor: string | null): PageBlock {
  const appearance = { ...defaultAppearance, ...block.appearance, anchor };
  if (block.type === "cta") return { ...block, appearance, data: { ...block.data, id: null } };
  if (block.type === "collection_list") return { ...block, appearance, data: { ...block.data, anchor: null } };
  return { ...block, appearance };
}

const heroPreview = { light: { color: "#ffffff", dark: false }, tinted: { color: "#eef6ff", dark: false }, dark: { color: "#115bbf", dark: true } } as const;

/** Vỏ chung của một khối trang trong trình sửa trang. */
export function BlockAppearanceFields({ block, onChange, disabled, onUploadingChange }: { block: PageBlock; onChange: (block: PageBlock) => void; disabled?: boolean; onUploadingChange?: (pending: boolean) => void }) {
  const appearance = { ...defaultAppearance, ...block.appearance };
  // "Ảnh + chữ" cũ chọn nền xanh nhạt trong ô riêng: hiện đúng lựa chọn đó, đổi nền thì bỏ ô cũ.
  const value = appearance.tone === "auto" && block.type === "media_text" && block.data.tone === "tinted" ? { ...appearance, tone: "tinted" as const } : appearance;
  function update(patch: Partial<BlockAppearance>) {
    const updated = { ...block, appearance: { ...appearance, ...patch } } as PageBlock;
    onChange("tone" in patch && updated.type === "media_text" ? { ...updated, data: { ...updated.data, tone: "light" } } : updated);
  }
  const anchorField = <label className="admin-field">Mã neo (tùy chọn, ví dụ bang-gia để liên kết tới #bang-gia)<input disabled={disabled} onChange={(event) => onChange(withAnchor(block, event.target.value === "" ? null : event.target.value.trim().toLowerCase()))} value={blockAnchor(block) ?? ""} /></label>;

  // Phần đầu trang: nền chọn ở ô "Nền" của chính nó (sáng / xanh nhạt / tối theo kiểu bố cục); ở đây chỉ ghi đè bằng màu tự chọn.
  // Kiểu ảnh nền và trượt ảnh đã có ảnh riêng nên không thêm ảnh nền; trượt ảnh chiếm trọn bề ngang nên không chỉnh độ rộng.
  const hero = block.type === "hero" ? block : null;
  const options: AppearanceEditorOptions = hero ? {
    tones: ["auto", "custom"],
    autoLabel: "Theo ô Nền của phần đầu trang",
    autoPreview: heroPreview[heroToneOf(hero.data)],
    spacing: false,
    image: hero.data.layout !== "background" && hero.data.layout !== "slider",
    imageNote: hero.data.layout === "slider" ? "Kiểu trượt nhiều ảnh dùng ảnh của từng slide làm nền, nên màu tự chọn và độ rộng không áp dụng." : "Kiểu ảnh nền đã dùng ảnh chính làm nền; màu tự chọn thay cho lớp phủ màu trên ảnh.",
    width: hero.data.layout !== "slider",
  } : { darkAllowed: blockSupportsDarkTone(block.type) };

  return <fieldset className="admin-block-group">
    <legend>{hero ? "Giao diện phần đầu trang: màu nền, ảnh nền, độ rộng" : "Giao diện khối: nền, độ rộng, khoảng cách"}</legend>
    <AppearanceEditor disabled={disabled} extra={anchorField} onChange={update} onUploadingChange={onUploadingChange} options={options} value={value} />
    <p className="admin-help">{hero ? "Màu tối thì chữ, nút và menu phía trên tự chuyển sang màu sáng." : "Hai phần liền nhau cùng nền trắng / xanh nhạt thì website thêm vạch ngăn mảnh. Nên dùng nền tối hoặc màu đậm cho tối đa một hai phần mỗi trang để làm điểm nhấn."}</p>
  </fieldset>;
}

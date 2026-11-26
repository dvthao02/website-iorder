"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AdminFormField } from "./ui/admin-form-field";
import { timingPresets, type PopupDisplay, type TimingPreset } from "./use-popup-setting-editor";

type NumberField = "scrollPercent" | "delaySeconds" | "repeatDays";
export type DisplayField = keyof PopupDisplay;

export function timingSummary(value: PopupDisplay) {
  const repeat = value.repeatDays === 0 ? "chỉ ghi nhớ trong phiên hiện tại" : `không hiện lại trong ${value.repeatDays} ngày`;
  return `Sau khi khách lướt ${value.scrollPercent}% trang và ở lại ít nhất ${value.delaySeconds} giây; ${repeat}.`;
}

function Choice({ checked, description, label, name, onChange, value }: { checked: boolean; description: string; label: string; name: string; onChange: () => void; value: string }) {
  return <label className={checked ? "admin-consult-popup__choice admin-consult-popup__choice--active" : "admin-consult-popup__choice"}>
    <input checked={checked} name={name} onChange={onChange} type="radio" value={value} />
    <span><strong>{label}</strong><small>{description}</small></span>
  </label>;
}

/** Thanh bật/tắt ở đầu màn; `id` nối mô tả với công tắc cho trình đọc màn hình. */
export function PopupStatusSwitch({ checked, description, disabled, id, label, onChange }: { checked: boolean; description: string; disabled: boolean; id: string; label: string; onChange: (enabled: boolean) => void }) {
  const descriptionId = `${id}-status-description`;
  return <div className="admin-consult-popup__statusbar" data-testid="feature-status">
    <div><strong>{label}</strong><span id={descriptionId}>{description}</span></div>
    <label className="admin-consult-popup__switch">
      <input aria-describedby={descriptionId} aria-label={`Bật ${label.toLocaleLowerCase("vi")}`} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span aria-hidden="true" className="admin-consult-popup__switch-track"><span /></span>
      <span>{checked ? "Bật" : "Tắt"}</span>
    </label>
  </div>;
}

/**
 * Hai hộp tự hiện dùng chung một khung trang: nói rõ cho người vận hành biết hộp còn lại đang ra sao
 * và điều gì xảy ra khi cả hai cùng bật, để họ không phải thử trên website thật.
 */
export function PopupSiblingNote({ siblingEnabled, siblingHref, siblingLabel, thisEnabled }: { siblingEnabled: boolean; siblingHref: string; siblingLabel: string; thisEnabled: boolean }) {
  const both = siblingEnabled && thisEnabled;
  return <p className="admin-consult-popup__sibling" data-testid="popup-sibling-note">
    <strong>{siblingLabel} đang {siblingEnabled ? "bật" : "tắt"}.</strong>{" "}
    {both ? "Mỗi lượt xem trang chỉ hiện một hộp: hộp nào đủ điều kiện trước sẽ hiện, nếu đến cùng lúc thì quảng cáo hiện trước." : "Hai hộp có lịch hiển thị riêng, đổi bên này không ảnh hưởng bên kia."}{" "}
    <Link href={siblingHref}>Mở {siblingLabel.toLocaleLowerCase("vi")}</Link>
  </p>;
}

type DisplayValidation = {
  props: (field: DisplayField) => { id: string; "aria-invalid": boolean | undefined; "aria-describedby": string | undefined };
  message: (field: DisplayField) => ReactNode;
};

const timingOptions: Array<{ preset: Exclude<TimingPreset, "custom">; label: string; detail: string }> = [
  { preset: "late", label: "Gần cuối trang", detail: "85% trang · chờ 8 giây · nhắc lại sau 3 ngày" },
  { preset: "balanced", label: "Cân bằng", detail: "60% trang · chờ 5 giây · nhắc lại sau 7 ngày" },
];

const numberFields: Array<{ key: NumberField; label: string; hint: string; min: number; max: number }> = [
  { key: "scrollPercent", label: "Lướt đến (% trang)", hint: "Tính theo quãng đường cuộn thực tế.", min: 30, max: 100 },
  { key: "delaySeconds", label: "Chờ ít nhất (giây)", hint: "Tính từ lúc mở trang.", min: 0, max: 300 },
  { key: "repeatDays", label: "Không hiện lại (ngày)", hint: "Nhập 0 để chỉ nhớ trong phiên hiện tại.", min: 0, max: 365 },
];

/** Trang hiển thị + thời điểm/tần suất: phần cấu hình lịch hiện giống hệt nhau ở cả hai hộp. */
export function PopupDisplayFields({ name, onChange, setTimingMode, timingMode, validation, value }: {
  name: string;
  onChange: (key: DisplayField, value: PopupDisplay[DisplayField]) => void;
  setTimingMode: (mode: TimingPreset) => void;
  timingMode: TimingPreset;
  validation: DisplayValidation;
  value: PopupDisplay;
}) {
  const applyTiming = (preset: Exclude<TimingPreset, "custom">) => {
    setTimingMode(preset);
    for (const key of Object.keys(timingPresets[preset]) as NumberField[]) onChange(key, timingPresets[preset][key]);
  };
  const optionClass = (active: boolean) => active ? "admin-consult-popup__timing-option admin-consult-popup__timing-option--active" : "admin-consult-popup__timing-option";

  return <>
    <fieldset {...validation.props("scope")} className="admin-consult-popup__choice-field">
      <legend>Trang hiển thị</legend>
      <div className="admin-consult-popup__choices admin-consult-popup__choices--compact">
        <Choice checked={value.scope === "all"} description="Không hiện ở trang Liên hệ, bản xem trước và trình dựng trang." label="Mọi trang phù hợp" name={`${name}-scope`} onChange={() => onChange("scope", "all")} value="all" />
        <Choice checked={value.scope === "home"} description="Chỉ xuất hiện khi khách đang ở trang chủ." label="Chỉ trang chủ" name={`${name}-scope`} onChange={() => onChange("scope", "home")} value="home" />
      </div>
      {validation.message("scope")}
    </fieldset>
    <fieldset className="admin-consult-popup__choice-field">
      <legend>Thời điểm và tần suất</legend>
      <div className="admin-consult-popup__timing">
        {timingOptions.map((option) => <label className={optionClass(timingMode === option.preset)} key={option.preset}>
          <input checked={timingMode === option.preset} name={`${name}-timing`} onChange={() => applyTiming(option.preset)} type="radio" />
          <span><strong>{option.label}</strong><small>{option.detail}</small></span>
        </label>)}
        <label className={optionClass(timingMode === "custom")}>
          <input checked={timingMode === "custom"} name={`${name}-timing`} onChange={() => setTimingMode("custom")} type="radio" />
          <span><strong>Tùy chỉnh</strong><small>Tự đặt ba thông số bên dưới</small></span>
        </label>
      </div>
    </fieldset>
    {timingMode === "custom" ? <div className="admin-consult-popup__custom-timing">
      {numberFields.map((field) => <AdminFormField error={validation.message(field.key)} hint={field.hint} id={validation.props(field.key).id} key={field.key} label={field.label}>
        <input {...validation.props(field.key)} className="block w-full" max={field.max} min={field.min} onChange={(event) => { setTimingMode("custom"); onChange(field.key, event.currentTarget.valueAsNumber); }} type="number" value={Number.isFinite(value[field.key]) ? value[field.key] : ""} />
      </AdminFormField>)}
    </div> : null}
    <p className="admin-consult-popup__summary"><strong>Cách hoạt động:</strong> {timingSummary(value)}</p>
  </>;
}

import React, { useId, type ReactNode } from "react";

/**
 * Hàng bật/tắt một tính năng: tên, mô tả ngắn và công tắc (công tắc đã có chữ Bật/Tắt nên không thêm huy hiệu trạng thái).
 * `onChange` nhận giá trị mới; việc lưu (ngay hay bấm Lưu) do nơi dùng quyết định.
 */
export function AdminSwitch({ checked, description, disabled = false, label, onChange }: { checked: boolean; description?: ReactNode; disabled?: boolean; label: string; onChange: (enabled: boolean) => void }) {
  const descriptionId = useId();
  return <div className="admin-switch-row">
    <div>
      <strong>{label}</strong>
      {description ? <span id={descriptionId}>{description}</span> : null}
    </div>
    <label className="admin-switch">
      <input aria-describedby={description ? descriptionId : undefined} aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} role="switch" type="checkbox" />
      <span aria-hidden="true" className="admin-switch__track"><span /></span>
      <span aria-hidden="true">{checked ? "Bật" : "Tắt"}</span>
    </label>
  </div>;
}

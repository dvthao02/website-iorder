import React, { useId, type ReactNode } from "react";

import { AdminStatusBadge } from "./admin-feedback";

/**
 * Hàng bật/tắt một tính năng: huy hiệu "Đang bật/Đang tắt", tên, mô tả ngắn và công tắc.
 * `onChange` nhận giá trị mới; việc lưu (ngay hay bấm Lưu) do nơi dùng quyết định.
 */
export function AdminSwitch({ checked, description, disabled = false, label, onChange }: { checked: boolean; description?: ReactNode; disabled?: boolean; label: string; onChange: (enabled: boolean) => void }) {
  const descriptionId = useId();
  return <div className="admin-switch-row" data-active={checked ? "true" : "false"}>
    <div>
      <AdminStatusBadge tone={checked ? "success" : "neutral"}>{checked ? "Đang bật" : "Đang tắt"}</AdminStatusBadge>
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

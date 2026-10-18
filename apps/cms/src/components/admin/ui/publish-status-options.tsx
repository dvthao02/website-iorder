"use client";

import React from "react";

const statusOptions = [["draft", "Bản nháp"], ["review", "Chờ duyệt"], ["scheduled", "Hẹn giờ"], ["published", "Xuất bản"], ["archived", "Lưu trữ"]] as const;
const liveStatuses = new Set<string>(["scheduled", "published"]);

// Các lựa chọn trạng thái cho editor nội dung. Người thiếu quyền `publish` không chọn được
// "Hẹn giờ"/"Xuất bản" (API cũng sẽ từ chối); trạng thái đang chọn luôn giữ được để select hợp lệ.
export function PublishStatusOptions({ canPublish, current }: { canPublish: boolean; current: string }) {
  return <>{statusOptions.map(([value, label]) => {
    const locked = !canPublish && liveStatuses.has(value) && value !== current;
    return <option disabled={locked} key={value} value={value}>{locked ? `${label} (cần quyền xuất bản)` : label}</option>;
  })}</>;
}

export function PublishPermissionHint({ canPublish }: { canPublish: boolean }) {
  return canPublish ? null : <p className="text-xs font-medium text-[var(--cms-muted)] sm:col-span-2">Bạn có thể lưu bản nháp hoặc gửi “Chờ duyệt”. Xuất bản, hẹn giờ và sửa nội dung đang hiển thị cần quyền xuất bản.</p>;
}

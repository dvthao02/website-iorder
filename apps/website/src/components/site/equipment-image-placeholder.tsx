import { ImageOff } from "lucide-react";

import { createTranslate } from "../../lib/translate";

// Thành phần thuần dùng ở cả máy chủ và trình duyệt: chữ "Chưa có hình ảnh" truyền qua `label` (nơi gọi đã có hàm dịch); không truyền thì tiếng Việt.
export function EquipmentImagePlaceholder({ size = 32, label = createTranslate()("common.noImage") }: { size?: number; label?: string }) {
  return <span className="equipment-image-placeholder"><ImageOff aria-hidden="true" size={size} strokeWidth={1.5} /><span>{label}</span></span>;
}

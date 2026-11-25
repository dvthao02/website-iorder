import React from "react";
import type { EquipmentAvailability } from "@iorder/shared/server/equipment/equipment-availability";
import type { UiMessageKey } from "@iorder/shared/server/translations/ui-messages";

import { createTranslate, type Translate } from "../../lib/translate";

// Màu theo token thương hiệu của website: xanh lá = còn, vàng = sắp hết, tím = đặt trước, hồng đỏ = hết, xám = ngừng bán.
const tones: Record<EquipmentAvailability, string> = {
  in_stock: "bg-accent-green-soft text-accent-green",
  limited: "bg-accent-amber-soft text-accent-amber",
  pre_order: "bg-accent-violet-soft text-accent-violet",
  out_of_stock: "bg-accent-rose-soft text-accent-rose",
  discontinued: "bg-subtle text-muted",
};

// Nhãn theo ngôn ngữ khách chọn (CMS vẫn dùng equipmentAvailabilityLabels tiếng Việt; chữ gốc hai nơi giống hệt nhau, có test giữ khớp).
export const availabilityLabelKeys: Record<EquipmentAvailability, UiMessageKey> = {
  in_stock: "availability.inStock",
  limited: "availability.limited",
  pre_order: "availability.preOrder",
  out_of_stock: "availability.outOfStock",
  discontinued: "availability.discontinued",
};

/**
 * Nhãn tình trạng hàng. Mặc định chỉ hiện khi khác "Còn hàng" để lưới thiết bị không rối;
 * trang chi tiết truyền `always` để luôn nói rõ (khớp với dữ liệu cấu trúc gửi Google). Nơi dùng truyền `t` để nhãn theo ngôn ngữ khách chọn.
 */
export function AvailabilityBadge({ availability, always = false, className = "", t = createTranslate() }: { availability?: EquipmentAvailability | null; always?: boolean; className?: string; t?: Translate }) {
  const value = availability ?? "in_stock";
  if (value === "in_stock" && !always) return null;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[value]} ${className}`.trim()} data-availability={value} data-testid="availability-badge">{t(availabilityLabelKeys[value])}</span>;
}

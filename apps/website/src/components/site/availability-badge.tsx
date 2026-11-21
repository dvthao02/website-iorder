import React from "react";
import { equipmentAvailabilityLabels, type EquipmentAvailability } from "@iorder/shared/server/equipment/equipment-availability";

// Màu theo token thương hiệu của website: xanh lá = còn, vàng = sắp hết, tím = đặt trước, hồng đỏ = hết, xám = ngừng bán.
const tones: Record<EquipmentAvailability, string> = {
  in_stock: "bg-accent-green-soft text-accent-green",
  limited: "bg-accent-amber-soft text-accent-amber",
  pre_order: "bg-accent-violet-soft text-accent-violet",
  out_of_stock: "bg-accent-rose-soft text-accent-rose",
  discontinued: "bg-subtle text-muted",
};

/**
 * Nhãn tình trạng hàng. Mặc định chỉ hiện khi khác "Còn hàng" để lưới thiết bị không rối;
 * trang chi tiết truyền `always` để luôn nói rõ (khớp với dữ liệu cấu trúc gửi Google).
 */
export function AvailabilityBadge({ availability, always = false, className = "" }: { availability?: EquipmentAvailability | null; always?: boolean; className?: string }) {
  const value = availability ?? "in_stock";
  if (value === "in_stock" && !always) return null;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[value]} ${className}`.trim()} data-availability={value} data-testid="availability-badge">{equipmentAvailabilityLabels[value]}</span>;
}

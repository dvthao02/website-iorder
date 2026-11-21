// Tình trạng bán của thiết bị. Tệp nhẹ (không phụ thuộc zod) để cả CMS lẫn website, kể cả thành phần chạy ở trình duyệt, dùng chung nhãn.
export const equipmentAvailabilityValues = ["in_stock", "limited", "pre_order", "out_of_stock", "discontinued"] as const;
export type EquipmentAvailability = (typeof equipmentAvailabilityValues)[number];

export const equipmentAvailabilityLabels: Record<EquipmentAvailability, string> = {
  in_stock: "Còn hàng", limited: "Sắp hết hàng", pre_order: "Đặt trước", out_of_stock: "Hết hàng", discontinued: "Ngừng kinh doanh",
};

// schema.org/ItemAvailability tương ứng (Google đọc từ dữ liệu cấu trúc của sản phẩm).
export const equipmentAvailabilitySchemaOrg: Record<EquipmentAvailability, string> = {
  in_stock: "https://schema.org/InStock", limited: "https://schema.org/LimitedAvailability", pre_order: "https://schema.org/PreOrder",
  out_of_stock: "https://schema.org/OutOfStock", discontinued: "https://schema.org/Discontinued",
};

/** Hiển thị ở danh sách: chỉ nhãn khác "Còn hàng" mới cần nhắc, để lưới thiết bị không rối. */
export function equipmentAvailabilityNotice(availability: EquipmentAvailability | null | undefined) {
  return availability && availability !== "in_stock" ? equipmentAvailabilityLabels[availability] : null;
}

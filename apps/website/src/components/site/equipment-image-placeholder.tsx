import { ImageOff } from "lucide-react";

export function EquipmentImagePlaceholder({ size = 32 }: { size?: number }) {
  return <span className="equipment-image-placeholder"><ImageOff aria-hidden="true" size={size} strokeWidth={1.5} /><span>Chưa có hình ảnh</span></span>;
}

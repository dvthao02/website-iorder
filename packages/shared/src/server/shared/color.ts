// Màu nền tự chọn: website tự chọn chữ trắng hay chữ đậm theo độ sáng (không phụ thuộc zod để dùng được ở component phía trình duyệt).

// Độ sáng tương đối (WCAG) của màu #rrggbb.
function luminance(hex: string) {
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
const inkLuminance = luminance("#0d1b33");

/** Màu nền tối (chữ trắng tương phản tốt hơn chữ đậm của website). */
export function isDarkColor(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const value = luminance(hex);
  return 1.05 / (value + 0.05) > (value + 0.05) / (inkLuminance + 0.05);
}

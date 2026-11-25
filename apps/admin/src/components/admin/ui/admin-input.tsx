"use client";

import type { InputHTMLAttributes, MouseEvent } from "react";

const pickerTypes = new Set(["date", "datetime-local", "time", "month", "week"]);
// Biểu tượng lịch/đồng hồ nằm ở mép phải ô và tự mở bảng chọn: bấm vào đó không gọi thêm lần nữa để bảng không đóng rồi mở lại.
const nativeIndicatorWidth = 36;

/**
 * Ô ngày/giờ: bấm vào bất kỳ chỗ nào của ô (không chỉ biểu tượng ở góc) cũng mở bảng chọn; vẫn gõ được bằng bàn phím.
 * Trình duyệt không hỗ trợ showPicker hoặc từ chối thì giữ hành vi mặc định.
 */
export function openPickerOnClick(event: Pick<MouseEvent<HTMLInputElement>, "currentTarget" | "nativeEvent" | "defaultPrevented">) {
  const input = event.currentTarget;
  if (event.defaultPrevented || input.disabled || input.readOnly || typeof input.showPicker !== "function") return false;
  if (event.nativeEvent.offsetX >= input.clientWidth - nativeIndicatorWidth) return false;
  try {
    input.showPicker();
    return true;
  } catch {
    return false;
  }
}

export function AdminInput({ className = "", onClick, type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const picker = type !== undefined && pickerTypes.has(type);
  return <input className={`admin-input ${className}`.trim()} onClick={picker ? (event) => { onClick?.(event); openPickerOnClick(event); } : onClick} type={type} {...props} />;
}

import { useSyncExternalStore } from "react";

// Giờ hiện tại làm tròn theo phút, dùng chung cho mọi chỗ hiện "5 phút trước". Dùng useSyncExternalStore để lúc dựng trên máy chủ và lúc
// nạp lại trên trình duyệt đều trả 0 (khớp nhau, không lệch nội dung), rồi mới có giờ thật; sau đó cập nhật mỗi phút.
const listeners = new Set<() => void>();
let current = 0;
let timer: number | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = Date.now();
    timer = window.setInterval(() => { current = Date.now(); listeners.forEach((notify) => notify()); }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.clearInterval(timer);
  };
}

/** Mili giây của thời điểm hiện tại (cập nhật mỗi phút); 0 khi chưa có giờ trình duyệt (lúc dựng trên máy chủ) nên không hiện phần "trước đây". */
export function useNowMinute() {
  return useSyncExternalStore(subscribe, () => current, () => 0);
}

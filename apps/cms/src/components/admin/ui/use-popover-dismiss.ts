"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Menu thả xuống dựng bằng <details> (AdminPopover, chọn biểu tượng, mẫu bài trong trình soạn thảo) chỉ đóng khi
// bấm lại đúng nút. Một bộ xử lý chung trong khung CMS cho mọi menu đó, kể cả menu vẽ từ Server Component:
// bấm ra ngoài, Esc (đóng menu trong cùng, trả focus về nút), mở menu khác, hoặc chuyển trang thì đóng.
// Khung bung trong trang (lịch sử phiên bản, tùy chọn hiển thị…) không thuộc danh sách này.
const floatingSelector = "details.admin-popover, details.admin-rte__menu";
const openFloating = () => Array.from(document.querySelectorAll<HTMLDetailsElement>(`details.admin-popover[open], details.admin-rte__menu[open]`));

export function usePopoverDismiss() {
  const pathname = usePathname();

  useEffect(() => {
    for (const menu of openFloating()) menu.open = false;
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      for (const menu of openFloating()) if (!target || !menu.contains(target)) menu.open = false;
    };
    // Bắt ở pha capture trên window, chạy trước bẫy focus của khung trượt: Esc chỉ đóng menu, không đóng cả khung.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const innermost = openFloating().at(-1);
      if (!innermost) return;
      innermost.open = false;
      innermost.querySelector("summary")?.focus();
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    // "toggle" không nổi bọt nên nghe ở pha capture; menu lồng trong menu đang mở thì giữ menu ngoài.
    const onToggle = (event: Event) => {
      const opened = event.target;
      if (!(opened instanceof HTMLDetailsElement) || !opened.open || !opened.matches(floatingSelector)) return;
      for (const menu of openFloating()) if (menu !== opened && !menu.contains(opened)) menu.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
}

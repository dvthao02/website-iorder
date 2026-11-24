"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { adminNotificationsResponseSchema, type AdminNotification, type AdminNotificationAction } from "@iorder/shared/server/dashboard/notifications.contract";

const refreshIntervalMs = 60_000;
const endpoint = "/api/v1/admin/notifications";

/** Thông báo "mới tới": mã kèm dấu hiệu nội dung, nên thông báo cũ đổi diễn biến (quá hạn, sửa lại) cũng tính là mới tới. */
const arrivalKey = (item: AdminNotification) => `${item.id}|${item.fingerprint ?? ""}`;

async function fetchNotifications(): Promise<AdminNotification[] | null> {
  try {
    const response = await fetch(endpoint, { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const parsed = adminNotificationsResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.notifications : null;
  } catch {
    return null;
  }
}

// Áp thao tác lên danh sách ngay trên trình duyệt (để bấm là thấy đổi), rồi Backend trả danh sách chính thức thay thế.
function applyLocally(items: AdminNotification[], action: AdminNotificationAction): AdminNotification[] {
  switch (action.action) {
    case "read": return items.map((item) => action.ids.includes(item.id) ? { ...item, read: true } : item);
    case "unread": return items.map((item) => action.ids.includes(item.id) ? { ...item, read: false } : item);
    case "dismiss": return items.filter((item) => !action.ids.includes(item.id));
    case "read_all": return items.map((item) => ({ ...item, read: true }));
    case "dismiss_all": return [];
  }
}

/**
 * Thông báo cho chuông CMS. Layout tải lúc điều hướng; hook này tự làm mới mỗi phút (khi tab đang hiện) và ngay khi quay lại tab, để việc mới tới lúc
 * người vận hành đang để yên một trang vẫn lên chuông (`onArrival` được gọi với các thông báo chưa đọc vừa tới, chỉ ở lần làm mới tự động).
 * Đọc / bỏ đọc / xóa được lưu theo từng người ở Backend; lỗi mạng hoặc phiên hết hạn thì giữ danh sách cũ và đồng bộ lại ở lần sau.
 * Layout trả danh sách mới (sau điều hướng) thì dùng luôn danh sách đó.
 */
export function useAdminNotifications(initial: AdminNotification[], onArrival?: (items: AdminNotification[]) => void) {
  const [state, setState] = useState({ base: initial, current: initial });
  if (state.base !== initial) setState({ base: initial, current: initial });
  const current = state.current;

  const currentRef = useRef(current);
  const arrivalRef = useRef(onArrival);
  const pending = useRef(0);
  const latest = useRef(0);
  useEffect(() => { currentRef.current = current; arrivalRef.current = onArrival; });

  useEffect(() => {
    let active = true;
    async function refresh() {
      // Đang gửi thao tác của người dùng thì chưa làm mới (danh sách cũ trên máy chủ sẽ ghi đè thay đổi vừa bấm).
      if (pending.current > 0 || document.visibilityState === "hidden") return;
      const list = await fetchNotifications();
      if (!list || !active || pending.current > 0) return;
      const known = new Set(currentRef.current.filter((item) => !item.read).map(arrivalKey));
      const arrived = list.filter((item) => !item.read && !known.has(arrivalKey(item)));
      setState((previous) => ({ ...previous, current: list }));
      if (arrived.length > 0) arrivalRef.current?.(arrived);
    }
    const timer = window.setInterval(() => void refresh(), refreshIntervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const act = useCallback(async (action: AdminNotificationAction) => {
    const request = ++latest.current;
    pending.current += 1;
    setState((previous) => ({ ...previous, current: applyLocally(previous.current, action) }));
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(action) });
      const parsed = response.ok ? adminNotificationsResponseSchema.safeParse(await response.json()) : null;
      // Chỉ thao tác gửi sau cùng được quyền đặt lại danh sách; lỗi thì tải lại từ Backend để không để giao diện lệch.
      if (request === latest.current) {
        const list = parsed?.success ? parsed.data.notifications : await fetchNotifications();
        if (list) setState((previous) => ({ ...previous, current: list }));
      }
    } catch {
      if (request === latest.current) {
        const list = await fetchNotifications();
        if (list) setState((previous) => ({ ...previous, current: list }));
      }
    } finally {
      pending.current -= 1;
    }
  }, []);

  return {
    items: current,
    markRead: useCallback((ids: string[]) => act({ action: "read", ids }), [act]),
    markUnread: useCallback((ids: string[]) => act({ action: "unread", ids }), [act]),
    dismiss: useCallback((ids: string[]) => act({ action: "dismiss", ids }), [act]),
    markAllRead: useCallback(() => act({ action: "read_all" }), [act]),
    dismissAll: useCallback(() => act({ action: "dismiss_all" }), [act]),
  };
}

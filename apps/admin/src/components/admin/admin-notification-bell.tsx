"use client";

import { Bell, Check, CheckCheck, CircleCheck, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";

import { unreadNotificationCount, type AdminNotification } from "@iorder/shared/server/dashboard/notifications.contract";
import { useAdminNotifications } from "@/lib/use-admin-notifications";
import { useAdminToast } from "./ui/admin-feedback";
import { AdminPopover } from "./ui/admin-popover";

// Chuông thông báo ở thanh trên của CMS. Mỗi việc cần xử lý là một dòng: bấm vào mở thẳng việc đó và tự đánh dấu đã đọc; nút ✓ đánh dấu đã đọc / chưa đọc,
// nút × xóa (ẩn với riêng người này cho tới khi thông báo đó có diễn biến mới). Số đỏ là số việc chưa đọc. Việc mới tới trong lúc đang mở CMS hiện một thông báo nổi.
export function AdminNotificationBell({ initial, canCheckPublishing }: { initial: AdminNotification[]; canCheckPublishing: boolean }) {
  const { show } = useAdminToast();
  const onArrival = useCallback((items: AdminNotification[]) => {
    show(items.length === 1 ? `Thông báo mới: ${items[0].label}` : `Có ${items.length} thông báo mới.`, "info");
  }, [show]);
  const { items, markRead, markUnread, dismiss, markAllRead, dismissAll } = useAdminNotifications(initial, onArrival);
  const unread = unreadNotificationCount(items);

  return <AdminPopover
    className="admin-notifications"
    label={unread > 0 ? `Xem thông báo, ${unread} việc chưa đọc` : "Xem thông báo"}
    trigger={<>
      <Bell aria-hidden="true" className="admin-notifications__icon" size={18} />
      {unread > 0 ? <b aria-hidden="true">{unread > 9 ? "9+" : unread}</b> : null}
    </>}
  >
    <div className="admin-header-popover admin-header-popover--notifications">
      <header><strong>Việc cần xử lý</strong>{canCheckPublishing ? <Link href="/admin/seo/publish-check">Kiểm tra xuất bản</Link> : null}</header>
      {items.length > 0 ? <>
        <div className="admin-notifications__toolbar">
          <span>{unread > 0 ? `${unread} chưa đọc` : "Đã đọc hết"}</span>
          <span>
            <button disabled={unread === 0} onClick={() => void markAllRead()} type="button"><CheckCheck aria-hidden="true" size={14} />Đọc tất cả</button>
            <button onClick={() => void dismissAll()} type="button"><Trash2 aria-hidden="true" size={14} />Xóa tất cả</button>
          </span>
        </div>
        <div className="admin-notifications__list">{items.map((item) => <div className="admin-notifications__item" data-read={item.read ? "" : undefined} data-tone={item.tone} key={item.id}>
          <Link href={item.href} onClick={() => { if (!item.read) void markRead([item.id]); }}><strong>{item.label}</strong><small>{item.detail}</small></Link>
          <span className="admin-notifications__actions">
            <button aria-label={item.read ? `Đánh dấu chưa đọc: ${item.label}` : `Đánh dấu đã đọc: ${item.label}`} onClick={() => void (item.read ? markUnread([item.id]) : markRead([item.id]))} title={item.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"} type="button">{item.read ? <RotateCcw aria-hidden="true" size={14} /> : <Check aria-hidden="true" size={15} />}</button>
            <button aria-label={`Xóa thông báo: ${item.label}`} onClick={() => void dismiss([item.id])} title="Xóa thông báo" type="button"><X aria-hidden="true" size={15} /></button>
          </span>
        </div>)}</div>
      </> : <div className="admin-notifications__empty"><CircleCheck aria-hidden="true" size={22} /><strong>Không có việc cần xử lý</strong><small>Không có liên hệ mới, nội dung chờ duyệt hay cảnh báo hệ thống.</small></div>}
    </div>
  </AdminPopover>;
}

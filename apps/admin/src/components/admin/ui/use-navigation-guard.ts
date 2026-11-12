"use client";

import { useEffect } from "react";
import { shouldConfirmHistoryNavigation, shouldConfirmNavigation } from "./navigation-guard-policy";

const dirtyForms = new Map<symbol, (() => void) | undefined>();
const title = "Rời màn hình khi chưa lưu?";
const message = "Bạn có thay đổi chưa lưu. Nếu rời màn hình này, các thay đổi đó sẽ mất.";

// Hộp xác nhận của CMS (AdminConfirmProvider đăng ký); chưa có thì mới dùng hộp của trình duyệt.
type LeaveConfirm = (options: { title: string; message: string; confirmLabel: string; cancelLabel: string; tone: "danger" }) => Promise<boolean>;
let leaveConfirm: LeaveConfirm | undefined;
export function registerLeaveConfirm(confirm: LeaveConfirm | undefined) { leaveConfirm = confirm; }

function askToLeave() {
  if (!leaveConfirm) return Promise.resolve(window.confirm(message));
  return leaveConfirm({ title, message, confirmLabel: "Rời trang", cancelLabel: "Ở lại", tone: "danger" });
}

function blockingCallback() {
  return Array.from(dirtyForms.values()).find((callback) => callback !== undefined);
}

/** Dùng trước thao tác rời màn hình tự viết (ví dụ đăng xuất). */
export async function confirmLeavingUnsavedChanges() {
  if (!dirtyForms.size) return true;
  const block = blockingCallback();
  if (block) { block(); return false; }
  return askToLeave();
}

// Sau khi người dùng đồng ý, cho lần điều hướng kế tiếp đi qua mà không hỏi lại.
let bypassNext = false;
let asking = false;
let historyNavigation: EventTarget | undefined;

type HistoryNavigateEvent = Event & {
  navigationType: string;
  destination: { url: string; key?: string };
};
type NavigationApi = EventTarget & { traverseTo?: (key: string) => unknown; navigate?: (url: string) => unknown };

function navigateHistory(event: Event) {
  if (bypassNext) { bypassNext = false; return; }
  const navigation = event as HistoryNavigateEvent;
  if (!dirtyForms.size || event.defaultPrevented || !navigation.destination || !shouldConfirmHistoryNavigation({
    href: navigation.destination.url, currentHref: window.location.href,
    navigationType: navigation.navigationType, cancelable: event.cancelable,
  })) return;
  event.preventDefault();
  const block = blockingCallback();
  if (block) { block(); return; }
  if (asking) return;
  asking = true;
  void askToLeave().then((leave) => {
    asking = false;
    if (!leave) return;
    bypassNext = true;
    const api = historyNavigation as NavigationApi | undefined;
    if (navigation.navigationType === "traverse" && navigation.destination.key && api?.traverseTo) api.traverseTo(navigation.destination.key);
    else window.location.assign(navigation.destination.url);
  });
}

function beforeUnload(event: BeforeUnloadEvent) {
  // Đóng tab/tải lại: trình duyệt bắt buộc dùng hộp hỏi của nó (trang web không thay được).
  if (!dirtyForms.size) return;
  event.preventDefault();
  event.returnValue = "";
}

function clickLink(event: MouseEvent) {
  if (bypassNext) { bypassNext = false; return; }
  if (!dirtyForms.size || event.defaultPrevented) return;
  const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!anchor || !shouldConfirmNavigation({
    href: anchor.href, currentHref: window.location.href, target: anchor.target,
    download: anchor.hasAttribute("download"), button: event.button,
    modified: event.ctrlKey || event.metaKey || event.shiftKey || event.altKey,
  })) return;
  event.preventDefault();
  event.stopPropagation();
  const block = blockingCallback();
  if (block) { block(); return; }
  if (asking) return;
  asking = true;
  void askToLeave().then((leave) => {
    asking = false;
    if (!leave) return;
    // Bấm lại đúng liên kết để Next tự chuyển trang (không tải lại cả trang).
    bypassNext = true;
    anchor.click();
  });
}

// Một listener chung dù cả panel và editor cùng đăng ký; không hỏi hai lần.
export function useNavigationGuard(isDirty: boolean, onBlocked?: () => void) {
  useEffect(() => {
    if (!isDirty) return;
    const token = Symbol("dirty-form");
    if (!dirtyForms.size) {
      document.addEventListener("click", clickLink, true);
      window.addEventListener("beforeunload", beforeUnload);
      historyNavigation = (window as Window & { navigation?: EventTarget }).navigation;
      historyNavigation?.addEventListener("navigate", navigateHistory);
    }
    dirtyForms.set(token, onBlocked);
    return () => {
      dirtyForms.delete(token);
      if (!dirtyForms.size) {
        document.removeEventListener("click", clickLink, true);
        window.removeEventListener("beforeunload", beforeUnload);
        historyNavigation?.removeEventListener("navigate", navigateHistory);
        historyNavigation = undefined;
      }
    };
  }, [isDirty, onBlocked]);
}

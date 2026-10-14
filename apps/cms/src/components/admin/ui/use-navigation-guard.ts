"use client";

import { useEffect } from "react";
import { shouldConfirmHistoryNavigation, shouldConfirmNavigation } from "./navigation-guard-policy";

const dirtyForms = new Map<symbol, (() => void) | undefined>();
const message = "Bạn có thay đổi chưa lưu. Bạn vẫn muốn rời khỏi màn hình này?";
export function confirmLeavingUnsavedChanges() {
  if (!dirtyForms.size) return true;
  const block = Array.from(dirtyForms.values()).find(callback => callback !== undefined);
  if (block) { block(); return false; }
  return window.confirm(message);
}
let historyNavigation: EventTarget | undefined;

type HistoryNavigateEvent = Event & {
  navigationType: string;
  destination: { url: string };
};

function navigateHistory(event: Event) {
  const navigation = event as HistoryNavigateEvent;
  if (!dirtyForms.size || event.defaultPrevented || !navigation.destination || !shouldConfirmHistoryNavigation({
    href: navigation.destination.url, currentHref: window.location.href,
    navigationType: navigation.navigationType, cancelable: event.cancelable,
  })) return;
  const block = Array.from(dirtyForms.values()).find(callback => callback !== undefined);
  if (block || !window.confirm(message)) {
    event.preventDefault();
    block?.();
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirtyForms.size) return;
  event.preventDefault();
  event.returnValue = "";
}

function clickLink(event: MouseEvent) {
  if (!dirtyForms.size || event.defaultPrevented) return;
  const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!anchor || !shouldConfirmNavigation({
    href: anchor.href, currentHref: window.location.href, target: anchor.target,
    download: anchor.hasAttribute("download"), button: event.button,
    modified: event.ctrlKey || event.metaKey || event.shiftKey || event.altKey,
  })) return;
  const block = Array.from(dirtyForms.values()).find((callback) => callback !== undefined);
  if (block || !window.confirm(message)) {
    event.preventDefault();
    event.stopPropagation();
    block?.();
  }
}

// Một listener chung dù cả panel và editor cùng đăng ký; không hỏi confirm hai lần.
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

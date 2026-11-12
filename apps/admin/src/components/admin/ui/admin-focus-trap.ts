"use client";

import { useEffect, useRef, type RefObject } from "react";

type UseAdminFocusTrapOptions = {
  containerRef: RefObject<HTMLElement | null>;
  initialFocusSelector?: string;
  isOpen: boolean;
  onClose: () => void;
};

// Traps can nest (a confirm dialog opened from a side panel). Every trap
// listens on document, so only the most recently opened one may react to
// Escape/Tab; otherwise the panel underneath would close or steal focus.
const openTraps: object[] = [];

export function isTopAdminFocusTrap(token: object) {
  return openTraps[openTraps.length - 1] === token;
}

export function pushAdminFocusTrap(token: object) {
  openTraps.push(token);
  return () => {
    const index = openTraps.lastIndexOf(token);
    if (index !== -1) openTraps.splice(index, 1);
  };
}

export function useAdminFocusTrap({ containerRef, initialFocusSelector, isOpen, onClose }: UseAdminFocusTrapOptions) {
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const container = containerRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableElements = () => Array.from(container.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"))
      .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled, [aria-disabled='true']") && element.getClientRects().length > 0);
    const initialFocus = initialFocusSelector ? container.querySelector<HTMLElement>(initialFocusSelector) : null;

    (initialFocus?.isConnected ? initialFocus : focusableElements()[0] ?? container).focus();
    const token = {};
    const releaseTrap = pushAdminFocusTrap(token);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || !isTopAdminFocusTrap(token)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === "Tab") {
        const elements = focusableElements();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first || !last) {
          event.preventDefault();
          container.focus();
        } else if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      releaseTrap();
      if (opener?.isConnected) opener.focus();
    };
  }, [containerRef, initialFocusSelector, isOpen]);
}

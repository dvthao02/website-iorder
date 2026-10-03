"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Thanh tiến trình dùng chung cho chuyển trang và các request phát sinh trong CMS. */
export function AdminLoadingBar() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "loading" | "complete">("idle");
  const [progress, setProgress] = useState(0);
  const pendingCount = useRef(0);
  const navigationPending = useRef(false);
  const navigationTimer = useRef<number | undefined>(undefined);
  const completeTimer = useRef<number | undefined>(undefined);
  const progressTimer = useRef<number | undefined>(undefined);

  const clearProgressTimer = useCallback(() => {
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    progressTimer.current = undefined;
  }, []);

  const start = useCallback(() => {
    pendingCount.current += 1;
    if (pendingCount.current !== 1) return;
    if (completeTimer.current) window.clearTimeout(completeTimer.current);
    completeTimer.current = undefined;
    clearProgressTimer();
    setProgress(0);
    setPhase("loading");
    window.requestAnimationFrame(() => setProgress(8));
    progressTimer.current = window.setInterval(() => {
      setProgress((current) => Math.min(92, current + Math.max(1.2, (92 - current) * 0.12)));
    }, 130);
  }, [clearProgressTimer]);

  const finish = useCallback(() => {
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    if (pendingCount.current !== 0) return;
    clearProgressTimer();
    setProgress(100);
    setPhase("complete");
    completeTimer.current = window.setTimeout(() => {
      setPhase("idle");
      setProgress(0);
    }, 260);
  }, [clearProgressTimer]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      start();
      try {
        return await originalFetch(...args);
      } finally {
        finish();
      }
    };

    return () => {
      window.fetch = originalFetch;
      clearProgressTimer();
      if (completeTimer.current) window.clearTimeout(completeTimer.current);
    };
  }, [clearProgressTimer, finish, start]);

  useEffect(() => {
    const handleRouteClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin") || url.href === window.location.href) return;
      if (navigationPending.current) return;
      navigationPending.current = true;
      start();
      navigationTimer.current = window.setTimeout(() => {
        if (!navigationPending.current) return;
        navigationPending.current = false;
        finish();
      }, 8_000);
    };

    document.addEventListener("click", handleRouteClick, true);
    return () => {
      document.removeEventListener("click", handleRouteClick, true);
      if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    };
  }, [finish, start]);

  useEffect(() => {
    if (!navigationPending.current) return;
    navigationPending.current = false;
    if (navigationTimer.current) window.clearTimeout(navigationTimer.current);
    navigationTimer.current = undefined;
    finish();
  }, [finish, pathname]);

  return <div aria-hidden="true" className={phase === "idle" ? "admin-loading-bar" : `admin-loading-bar admin-loading-bar--${phase}`}><span style={{ width: `${progress}%` }} /></div>;
}

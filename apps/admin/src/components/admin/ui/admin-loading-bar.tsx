"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// Request tải trước của Next (prefetch link khi hiện/rê chuột) không phải việc người dùng đang chờ.
function isBackgroundRequest(args: Parameters<typeof fetch>) {
  const [input, init] = args;
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return headers.has("next-router-prefetch") || headers.get("purpose") === "prefetch";
}

/**
 * Thanh tiến trình cho chuyển trang và request trong CMS. Mỗi lượt chạy một chiều 0 → 100:
 * lượt mới dựng lại thanh (key) nên không có hiệu ứng kéo lùi; request đến khi thanh đang ẩn dần thì chạy tiếp.
 */
export function AdminLoadingBar() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "loading" | "complete">("idle");
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState(0);
  const pendingCount = useRef(0);
  const phaseRef = useRef<"idle" | "loading" | "complete">("idle");
  const navigationPending = useRef(false);
  const navigationTimer = useRef<number | undefined>(undefined);
  const completeTimer = useRef<number | undefined>(undefined);
  const progressTimer = useRef<number | undefined>(undefined);

  const setPhaseBoth = useCallback((next: "idle" | "loading" | "complete") => { phaseRef.current = next; setPhase(next); }, []);
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
    if (phaseRef.current !== "loading") {
      // Lượt mới: thanh dựng lại ở 0 (không chuyển động lùi), rồi mới tăng dần.
      setRun((value) => value + 1);
      setProgress(0);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setProgress(8)));
    }
    setPhaseBoth("loading");
    progressTimer.current = window.setInterval(() => {
      setProgress((current) => Math.min(92, current + Math.max(0.6, (92 - current) * 0.1)));
    }, 160);
  }, [clearProgressTimer, setPhaseBoth]);

  const finish = useCallback(() => {
    pendingCount.current = Math.max(0, pendingCount.current - 1);
    if (pendingCount.current !== 0) return;
    clearProgressTimer();
    setProgress(100);
    setPhaseBoth("complete");
    completeTimer.current = window.setTimeout(() => setPhaseBoth("idle"), 320);
  }, [clearProgressTimer, setPhaseBoth]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      if (isBackgroundRequest(args)) return originalFetch(...args);
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

  return <div aria-hidden="true" className={phase === "idle" ? "admin-loading-bar" : `admin-loading-bar admin-loading-bar--${phase}`}><span key={run} style={{ width: `${progress}%` }} /></div>;
}

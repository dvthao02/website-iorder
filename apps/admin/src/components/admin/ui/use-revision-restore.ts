"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Keep controls locked until reload, release this workflow's guard after success. */
export function useRevisionRestore() {
  const pending = useRef(false);
  const [restoring, setRestoring] = useState(false);
  const [completing, setCompleting] = useState(false);
  const onPendingChange = useCallback((value: boolean) => {
    pending.current = value;
    setRestoring(value);
  }, []);
  const onRestored = useCallback(() => setCompleting(true), []);
  useEffect(() => {
    if (completing) window.location.reload();
  }, [completing]);
  return { pending, restoring, completing, onPendingChange, onRestored };
}

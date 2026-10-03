"use client";

import { useCallback, useEffect, useRef } from "react";

function snapshot(value: unknown) {
  return JSON.stringify(value) ?? "";
}

export function useUnsavedChanges(value: unknown) {
  const currentSnapshot = snapshot(value);
  const savedSnapshot = useRef(currentSnapshot);
  const isDirty = savedSnapshot.current !== currentSnapshot;

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const markSaved = useCallback(() => {
    savedSnapshot.current = currentSnapshot;
  }, [currentSnapshot]);

  return { isDirty, markSaved };
}

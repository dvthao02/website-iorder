"use client";

import { useCallback, useRef, useState } from "react";
import { useNavigationGuard } from "./use-navigation-guard";

function snapshot(value: unknown) {
  return JSON.stringify(value) ?? "";
}

export function useUnsavedChanges<T>(value: T, initialSavedValue: T = value) {
  const currentSnapshot = snapshot(value);
  // Bản phục hồi vẫn phải so với dữ liệu đã lưu, không tự coi là sạch.
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot(initialSavedValue));
  const savedValue = useRef(initialSavedValue);
  const isDirty = savedSnapshot !== currentSnapshot;

  useNavigationGuard(isDirty);

  const markSaved = useCallback(() => {
    savedValue.current = structuredClone(value);
    setSavedSnapshot(currentSnapshot);
  }, [currentSnapshot, value]);

  const getSavedValue = useCallback(() => structuredClone(savedValue.current), []);

  return { isDirty, markSaved, getSavedValue };
}

"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

// Các nút mở form chỉ bật sau hydration, tránh mất lần bấm đầu khi thanh hành động chuyển vào portal.
export function useAdminClientReady() {
  return useSyncExternalStore(subscribe, clientReady, serverReady);
}

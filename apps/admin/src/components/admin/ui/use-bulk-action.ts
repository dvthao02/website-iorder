"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { adminApiError } from "@/lib/admin-api";
import { useAdminConfirm } from "./admin-confirm-dialog";
import { useAdminToast } from "./admin-feedback";

type BulkRequest = { url: string; method: "PATCH" | "DELETE" | "POST"; body?: unknown };

/**
 * Chạy một thao tác cho từng dòng đã chọn, lần lượt từng request (mỗi request vẫn kiểm phiên bản
 * và quyền như thao tác đơn lẻ). Dòng lỗi (ví dụ 409 do người khác vừa sửa) không chặn các dòng còn lại.
 */
export function useBulkAction() {
  const router = useRouter();
  const { confirm } = useAdminConfirm();
  const { show } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  async function run<Item>(options: {
    items: Item[];
    request: (item: Item) => BulkRequest;
    verb: string;
    noun: string;
    confirmMessage?: string;
    tone?: "danger" | "default";
    onDone?: () => void;
  }) {
    const { items, request, verb, noun } = options;
    if (running.current || items.length === 0) return;
    if (options.confirmMessage && !(await confirm({ title: `${verb} ${items.length} ${noun}?`, message: options.confirmMessage, confirmLabel: verb, tone: options.tone }))) return;
    running.current = true;
    setBusy(true);
    let succeeded = 0;
    const failures: string[] = [];
    try {
      for (const item of items) {
        const next = request(item);
        try {
          const response = await fetch(next.url, { method: next.method, ...(next.body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(next.body) }) });
          if (response.ok) succeeded++;
          else failures.push(adminApiError(await response.json().catch(() => null), `Không thể ${verb.toLocaleLowerCase("vi")}.`).message);
        } catch {
          failures.push("Mất kết nối tới máy chủ.");
        }
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
    if (failures.length === 0) show(`Đã ${verb.toLocaleLowerCase("vi")} ${succeeded} ${noun}.`, "success");
    else show(`${verb} được ${succeeded}/${items.length} ${noun}. Lỗi: ${[...new Set(failures)].slice(0, 2).join(" ")}`, succeeded ? "warning" : "error");
    options.onDone?.();
    router.refresh();
  }

  return { busy, run };
}

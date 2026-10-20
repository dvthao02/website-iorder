"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { formatDisplayDateTime } from "@/lib/local-date-time";
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { revisionHistoryResponseSchema } from "@iorder/core/server/revisions/revisions.contract";
import { AdminButton } from "./ui/admin-button";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminStatusBadge } from "./ui/admin-feedback";

type Revision = { id: string; version: number; note: string | null; snapshot: unknown; createdAt?: string };

const statusLabels: Record<string, string> = { draft: "Bản nháp", review: "Chờ duyệt", scheduled: "Hẹn giờ", published: "Đã xuất bản", archived: "Lưu trữ" };

// Tóm tắt dễ đọc của một phiên bản (tiêu đề/tên + trạng thái) thay cho dữ liệu thô.
function describe(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") return { title: null, status: null };
  const record = snapshot as Record<string, unknown>;
  const title = [record.title, record.name, record.label].find((value): value is string => typeof value === "string" && value.trim() !== "") ?? null;
  const status = typeof record.status === "string" ? statusLabels[record.status] ?? null : typeof record.isEnabled === "boolean" ? (record.isEnabled ? "Đang hiện" : "Đang ẩn") : null;
  return { title, status };
}

async function fetchHistory(url: string): Promise<{ rows: Revision[]; message: string }> {
  try {
    const response = await fetch(url);
    const payload = await readAdminJson(response);
    if (!response.ok) throw adminApiError(payload, "Không tải được lịch sử.");
    const parsed = revisionHistoryResponseSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Phản hồi lịch sử không hợp lệ. Vui lòng tải lại.");
    return { rows: parsed.data.revisions, message: parsed.data.revisions.length ? "" : "Chưa có phiên bản đã lưu." };
  } catch (error) {
    return { rows: [], message: error instanceof Error ? error.message : "Không tải được lịch sử." };
  }
}

function formatDate(value: string | undefined) {
  return formatDisplayDateTime(value) || null;
}

/** Danh sách phiên bản đã lưu (mới nhất trước); tự tải khi hiện ra, khôi phục qua hộp xác nhận của CMS. */
export function RevisionHistory({ target, id, disabled = false, expectedVersion, onRestorePendingChange, onRestored }: { target: "posts" | "offerings" | "pages" | "equipment" | "navigation" | "downloads"; id: string; disabled?: boolean; expectedVersion?: number; onRestorePendingChange?: (pending: boolean) => void; onRestored?: () => void }) {
  const { confirm } = useAdminConfirm();
  const [rows, setRows] = useState<Revision[]>([]);
  const [message, setMessage] = useState("Đang tải lịch sử…");
  const [busy, setBusy] = useState(true);
  const pending = useRef(false);
  const url = `/api/admin/revisions/${target}/${id}`;
  // Tự tải khi hiện ra; bỏ kết quả nếu component đã bị gỡ.
  useEffect(() => {
    let active = true;
    void fetchHistory(url).then((result) => {
      if (!active) return;
      setRows(result.rows);
      setMessage(result.message);
      setBusy(false);
    });
    return () => { active = false; };
  }, [url]);
  async function load() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("Đang tải lịch sử…");
    const result = await fetchHistory(url);
    setRows(result.rows);
    setMessage(result.message);
    pending.current = false;
    setBusy(false);
  }

  async function restore(row: Revision) {
    if (pending.current) return;
    if (disabled) {
      setMessage("Hãy lưu hoặc bỏ thay đổi hiện tại trước khi khôi phục phiên bản.");
      return;
    }
    if (!await confirm({ title: `Khôi phục phiên bản ${row.version}?`, message: "Nội dung hiện tại được thay bằng phiên bản này (tạo một phiên bản mới, có thể khôi phục lại). Nếu nội dung đang xuất bản, website đổi ngay.", confirmLabel: "Khôi phục", tone: "danger" })) return;
    pending.current = true;
    setBusy(true);
    try {
      onRestorePendingChange?.(true);
      setMessage("Đang khôi phục phiên bản…");
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ revisionId: row.id, expectedVersion }) });
      const payload = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không khôi phục được phiên bản.");
      if (payload.restored !== true) throw new Error("Phản hồi khôi phục không hợp lệ. Vui lòng kiểm tra nội dung trước khi thử lại.");
      if (onRestored) {
        setMessage("Đã khôi phục. Đang tải nội dung mới…");
        onRestored();
      }
      else window.location.reload();
    } catch (error) { pending.current = false; onRestorePendingChange?.(false); setMessage(error instanceof Error ? error.message : "Không khôi phục được phiên bản."); setBusy(false); }
  }

  return <div className="admin-revisions">
    {message ? <p className="admin-help" role="status">{message}</p> : null}
    {rows.length ? <ol className="admin-revisions__list">{rows.map((row) => {
      const { title, status } = describe(row.snapshot);
      const current = expectedVersion !== undefined && row.version === expectedVersion;
      const date = formatDate(row.createdAt);
      return <li className="admin-revisions__item" key={row.id}>
        <span className="admin-revisions__text">
          <strong>Phiên bản {row.version}{date ? <small> · {date}</small> : null}</strong>
          <span>{[title, status, row.note].filter(Boolean).join(" · ") || "Không có mô tả"}</span>
        </span>
        {current ? <AdminStatusBadge tone="success">Đang dùng</AdminStatusBadge> : <AdminButton disabled={busy || disabled} onClick={() => void restore(row)} size="sm" title={disabled ? "Lưu hoặc bỏ thay đổi trước khi khôi phục" : undefined} variant="secondary"><RotateCcw aria-hidden="true" size={14} />Khôi phục</AdminButton>}
      </li>;
    })}</ol> : null}
    <AdminButton className="justify-self-start" disabled={busy} onClick={() => void load()} size="sm" variant="ghost">Tải lại</AdminButton>
  </div>;
}

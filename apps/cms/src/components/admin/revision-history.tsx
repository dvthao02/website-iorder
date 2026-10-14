"use client";

import { useRef, useState } from "react";
import { revisionHistoryResponseSchema } from "@iorder/core/server/revisions/revisions.contract";

type Revision = { id: string; version: number; note: string | null; snapshot: unknown };

export function RevisionHistory({ target, id, disabled = false, expectedVersion, onRestorePendingChange, onRestored }: { target: "posts" | "offerings" | "pages" | "equipment" | "navigation" | "downloads"; id: string; disabled?: boolean; expectedVersion?: number; onRestorePendingChange?: (pending: boolean) => void; onRestored?: () => void }) {
  const [rows, setRows] = useState<Revision[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>();
  const pending = useRef(false);
  const url = `/api/admin/revisions/${target}/${id}`;
  async function load() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const response = await fetch(url);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Không tải được lịch sử.");
      const parsed = revisionHistoryResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Phản hồi lịch sử không hợp lệ. Vui lòng tải lại.");
      setRows(parsed.data.revisions);
      setMessage(parsed.data.revisions.length ? "" : "Chưa có phiên bản đã lưu.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không tải được lịch sử."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function restore(revisionId: string) {
    if (pending.current) return;
    if (disabled) {
      setMessage("Hãy lưu hoặc bỏ thay đổi hiện tại trước khi khôi phục phiên bản.");
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      onRestorePendingChange?.(true);
      setMessage("Đang khôi phục phiên bản…");
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ revisionId, expectedVersion }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Không khôi phục được phiên bản.");
      if (payload.restored !== true) throw new Error("Phản hồi khôi phục không hợp lệ. Vui lòng kiểm tra nội dung trước khi thử lại.");
      if (onRestored) {
        setMessage("Đã khôi phục. Đang tải nội dung mới…");
        onRestored();
      }
      else window.location.reload();
    } catch (error) { pending.current = false; onRestorePendingChange?.(false); setMessage(error instanceof Error ? error.message : "Không khôi phục được phiên bản."); setBusy(false); }
  }
  return <section className="mt-6 grid gap-3 rounded border p-4">
    <h3 className="font-bold">Lịch sử nội dung</h3>
    <button type="button" disabled={busy} onClick={load}>Tải lịch sử phiên bản</button>
    <p role="status">{message}</p>
    {rows.map(row => <details key={row.id}>
      <summary>Phiên bản {row.version} · {row.note}</summary>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(row.snapshot, null, 2)}</pre>
      <button type="button" disabled={busy || disabled} onClick={() => setSelected(row.id)}>Chọn khôi phục</button>
      {selected === row.id ? <div className="rounded bg-amber-50 p-3">
        <p>Thao tác tạo phiên bản mới và thay nội dung hiện tại. Nếu đang xuất bản, thay đổi hiển thị ngay trên website. Những sửa đổi chưa lưu trong biểu mẫu sẽ mất.</p>
        <button type="button" disabled={busy || disabled} onClick={() => restore(row.id)}>Khôi phục phiên bản này</button>
        <button type="button" disabled={busy} onClick={() => setSelected(undefined)}>Hủy</button>
      </div> : null}
    </details>)}
  </section>;
}

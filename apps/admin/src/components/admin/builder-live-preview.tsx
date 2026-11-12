"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import { builderPreviewDocumentSchema, builderPreviewResponseSchema, builderSelectionMessageSchema } from "@iorder/shared/server/publishing/builder-preview.contract";
import { publishedPublicUrl } from "@/lib/published-public-url";
import { AdminApiError, adminApiError, readAdminJson } from "@/lib/admin-api";
import { AdminButton } from "./ui/admin-button";
import { AdminNotice } from "./ui/admin-feedback";
import { useAdminClientReady } from "./ui/use-admin-client-ready";

const readySchema = z.object({ type: z.literal("iorder:preview-ready") }).strict();

// getRandomValues dùng được cả trên CMS HTTP trong mạng nội bộ; randomUUID chỉ có ở secure context.
function createPreviewId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function BuilderLivePreview({ document, documentId, selectedIndex, onSelect }: { document: unknown; documentId: string | null; selectedIndex: number | null; onSelect: (index: number) => void }) {
  const [preview, setPreview] = useState<{ token: string; sequence: number; document: string } | null>(null);
  const token = preview?.token ?? "";
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [isOpen, setIsOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const clientReady = useAdminClientReady();
  const dialog = useRef<HTMLDialogElement>(null);
  const popup = useRef<Window | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const previewId = useRef<string | null>(null);
  const sequence = useRef(0);
  const callbacks = useRef({ onSelect, selectedIndex });
  useEffect(() => { callbacks.current = { onSelect, selectedIndex }; }, [onSelect, selectedIndex]);
  const serialized = JSON.stringify(document);
  const validDocument = builderPreviewDocumentSchema.safeParse(document).success;
  const origin = new URL(publishedPublicUrl("/")).origin;
  const active = isOpen || popupOpen;
  const previewUrl = token ? publishedPublicUrl(`/cms-preview?token=${encodeURIComponent(token)}&version=${preview?.sequence ?? 0}`) : "";

  useEffect(() => {
    const parsed = builderPreviewDocumentSchema.safeParse(JSON.parse(serialized ?? "null"));
    if (!active || !parsed.success) return;
    const controller = new AbortController();
    const current = ++sequence.current;
    const timer = window.setTimeout(async () => {
      setPending(true);
      setMessage("");
      try {
        previewId.current ??= createPreviewId();
        const response = await fetch("/api/admin/builder-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ previewId: previewId.current, documentId, sequence: current, parentOrigin: window.location.origin, document: parsed.data }), signal: controller.signal });
        const body: unknown = await readAdminJson(response);
        if (!response.ok) throw adminApiError(body, "Không cập nhật được bản xem trước.");
        const parsedResponse = builderPreviewResponseSchema.safeParse(body);
        if (!parsedResponse.success) throw new AdminApiError("Phản hồi xem trước không hợp lệ. Hãy thử lại.");
        const result = parsedResponse.data;
        if (!controller.signal.aborted && current === sequence.current && result.sequence === current) {
          setPreview({ ...result, document: serialized ?? "null" });
        }
      } catch (error) { if (!controller.signal.aborted && current === sequence.current) setMessage(error instanceof AdminApiError ? error.message : "Không kết nối được máy chủ xem trước. Bản nhập của bạn vẫn được giữ lại."); }
      finally { if (!controller.signal.aborted && current === sequence.current) setPending(false); }
    }, 600);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [serialized, documentId, attempt, active]);

  useEffect(() => {
    if (popupOpen && popup.current && !popup.current.closed && previewUrl) popup.current.location.replace(previewUrl);
  }, [previewUrl, popupOpen]);

  useEffect(() => {
    if (!popupOpen) return;
    const timer = window.setInterval(() => { if (!popup.current || popup.current.closed) { popup.current = null; setPopupOpen(false); } }, 500);
    return () => clearInterval(timer);
  }, [popupOpen]);
  useEffect(() => () => { popup.current?.close(); }, []);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== origin || (event.source !== frame.current?.contentWindow && event.source !== popup.current)) return;
      const selection = builderSelectionMessageSchema.safeParse(event.data);
      if (selection.success) callbacks.current.onSelect(selection.data.index);
      if (readySchema.safeParse(event.data).success && callbacks.current.selectedIndex !== null) (event.source as Window).postMessage({ type: "iorder:highlight-block", index: callbacks.current.selectedIndex }, origin);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [origin]);
  useEffect(() => { if (selectedIndex !== null) { frame.current?.contentWindow?.postMessage({ type: "iorder:highlight-block", index: selectedIndex }, origin); if (popup.current && !popup.current.closed) popup.current.postMessage({ type: "iorder:highlight-block", index: selectedIndex }, origin); } }, [selectedIndex, origin]);

  function openPopup() {
    previewId.current ??= createPreviewId();
    const target = window.open(previewUrl || "about:blank", `iorder-preview-${previewId.current}`, "popup,width=1280,height=900,resizable=yes,scrollbars=yes");
    if (!target) { setMessage("Trình duyệt đang chặn cửa sổ mới. Bạn có thể dùng Xem trước trang hoặc cho phép cửa sổ bật lên cho CMS."); dialog.current?.showModal(); setIsOpen(true); return; }
    if (!previewUrl) { target.document.title = "Đang tải bản xem trước"; target.document.body.textContent = "Đang tải bản xem trước từ CMS…"; }
    popup.current = target;
    setPopupOpen(true);
    target.focus();
  }

  return <section aria-label="Xem trước trực tiếp" className="admin-builder-preview">
    <p className="admin-help">Xem trang thật với nội dung đang nhập, chưa cần lưu.</p>
    <div className="admin-builder-preview__devices"><AdminButton disabled={!clientReady} onClick={() => { dialog.current?.showModal(); setIsOpen(true); }} size="sm" variant="secondary">Xem trước trang</AdminButton><AdminButton disabled={!clientReady || !validDocument} onClick={openPopup} size="sm" variant="ghost">Cửa sổ riêng ↗</AdminButton></div>
    {popupOpen && !isOpen ? <div className="admin-builder-preview__status" aria-live="polite">{!validDocument ? <AdminNotice tone="warning">Hoàn thiện các trường bắt buộc để cập nhật cửa sổ xem trước. Cửa sổ vẫn giữ lần hợp lệ gần nhất.</AdminNotice> : message ? <><AdminNotice tone="warning">{message}</AdminNotice><AdminButton onClick={() => setAttempt(value => value + 1)} size="sm" variant="secondary">Thử cập nhật xem trước</AdminButton></> : <p className="admin-help">{pending || preview?.document !== serialized ? "Đang cập nhật cửa sổ xem trước…" : "Cửa sổ xem trước đã cập nhật · Nội dung chưa được lưu."}</p>}</div> : null}
    {clientReady ? createPortal(<dialog aria-labelledby="builder-preview-title" className="admin-builder-preview-dialog" onClose={() => setIsOpen(false)} ref={dialog}>
    <header><strong id="builder-preview-title">Xem trước trang</strong><div className="admin-builder-preview__devices"><AdminButton onClick={() => setAttempt(value => value + 1)} size="sm" variant="ghost">Làm mới</AdminButton><AdminButton aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} size="sm" variant="ghost">Máy tính</AdminButton><AdminButton aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} size="sm" variant="ghost">Điện thoại</AdminButton><AdminButton disabled={!validDocument} onClick={openPopup} size="sm" variant="ghost">Cửa sổ riêng ↗</AdminButton><AdminButton onClick={() => dialog.current?.close()} size="sm" variant="secondary">Đóng xem trước</AdminButton></div></header>
    <p className="admin-help" role="status">{!validDocument ? "Chưa đủ thông tin để cập nhật xem trước." : message ? "Bản xem trước chưa được cập nhật." : pending || preview?.document !== serialized ? "Đang cập nhật xem trước…" : "Đã cập nhật bản đang nhập · Chưa lưu vào nội dung."}</p>
    {!validDocument ? <AdminNotice tone="warning">Hoàn thiện tên, đường dẫn và các trường bắt buộc để cập nhật xem trước. Bản đang hiển thị là lần hợp lệ gần nhất.</AdminNotice> : message ? <div className="grid gap-2"><AdminNotice tone="warning">{message}</AdminNotice><AdminButton onClick={() => setAttempt(value => value + 1)} size="sm" variant="secondary">Thử cập nhật xem trước</AdminButton></div> : null}
    <div className={`admin-builder-preview__viewport${device === "mobile" ? " admin-builder-preview__viewport--mobile" : ""}`}>
      {token && isOpen ? <iframe ref={frame} title="Bản xem trước website" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" src={previewUrl} /> : <p className="admin-help">Bản xem trước sẽ xuất hiện khi nội dung hợp lệ.</p>}
    </div>
    </dialog>, window.document.body) : null}
  </section>;
}

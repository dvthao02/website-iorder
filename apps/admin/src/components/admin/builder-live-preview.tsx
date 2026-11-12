"use client";

import { CircleCheck, Clock, ExternalLink, Eye, LoaderCircle, Maximize2, Minimize2, Monitor, Redo2, RefreshCw, Smartphone, Tablet, TriangleAlert, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { z } from "zod";
import { builderPreviewDocumentSchema, builderPreviewResponseSchema, builderSelectionMessageSchema } from "@iorder/shared/server/publishing/builder-preview.contract";
import { browserPublicUrl } from "@/lib/published-public-url";
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

// Bề ngang thật của website trong canvas theo thiết bị; canvas thu nhỏ vừa khung (không bao giờ phóng to quá 100%),
// nên website luôn dựng đúng bố cục máy tính / máy tính bảng / điện thoại dù khung canvas hẹp.
const deviceWidths = { desktop: 1280, tablet: 768, mobile: 390 } as const;

export function BuilderLivePreview({ document, documentId, selectedIndex, onSelect, wide = false, onToggleWide, onUndo, onRedo, canUndo = false, canRedo = false }: { document: unknown; documentId: string | null; selectedIndex: number | null; onSelect: (index: number, item?: string, field?: string) => void; wide?: boolean; onToggleWide?: () => void; onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean }) {
  const [preview, setPreview] = useState<{ token: string; sequence: number; document: string } | null>(null);
  const token = preview?.token ?? "";
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  // Thu phóng canvas: "fit" = vừa khung (không quá 100%); số cố định thì khung xem trước cuộn khi lớn hơn.
  const [zoom, setZoom] = useState<"fit" | 0.5 | 0.75 | 1>("fit");
  const [isOpen, setIsOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const clientReady = useAdminClientReady();
  const dialog = useRef<HTMLDialogElement>(null);
  const popup = useRef<Window | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvasFrame = useRef<HTMLIFrameElement>(null);
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  // Đo theo vỏ ngoài (bề ngang do lưới quyết định, không phụ thuộc iframe bên trong) để tính tỉ lệ thu nhỏ.
  useEffect(() => {
    const outer = root.current;
    const inner = viewport.current;
    if (!outer || !inner) return;
    const measure = () => setBox({ width: Math.max(0, outer.clientWidth - 2), height: Math.max(0, inner.clientHeight - 2) });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);
  const previewId = useRef<string | null>(null);
  const sequence = useRef(0);
  const callbacks = useRef({ onSelect, selectedIndex });
  useEffect(() => { callbacks.current = { onSelect, selectedIndex }; }, [onSelect, selectedIndex]);
  const serialized = JSON.stringify(document);
  const validDocument = builderPreviewDocumentSchema.safeParse(document).success;
  const origin = new URL(browserPublicUrl("/")).origin;
  // Bản xem trước chỉ gửi lên máy chủ khi mở canvas lần đầu và khi bấm nút cập nhật, không gửi sau mỗi lần gõ.
  const active = clientReady || isOpen || popupOpen;
  const latestDocument = useRef(serialized);
  useEffect(() => { latestDocument.current = serialized; }, [serialized]);
  const previewUrl = token ? browserPublicUrl(`/cms-preview?token=${encodeURIComponent(token)}&version=${preview?.sequence ?? 0}`) : "";

  useEffect(() => {
    const sent = latestDocument.current ?? "null";
    const parsed = builderPreviewDocumentSchema.safeParse(JSON.parse(sent));
    if (!active || !parsed.success) return;
    const controller = new AbortController();
    const current = ++sequence.current;
    void (async () => {
      setPending(true);
      setMessage("");
      try {
        previewId.current ??= createPreviewId();
        const response = await fetch("/api/v1/admin/builder-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ previewId: previewId.current, documentId, sequence: current, parentOrigin: window.location.origin, document: parsed.data }), signal: controller.signal });
        const body: unknown = await readAdminJson(response);
        if (!response.ok) throw adminApiError(body, "Không cập nhật được bản xem trước.");
        const parsedResponse = builderPreviewResponseSchema.safeParse(body);
        if (!parsedResponse.success) throw new AdminApiError("Phản hồi xem trước không hợp lệ. Hãy thử lại.");
        const result = parsedResponse.data;
        if (!controller.signal.aborted && current === sequence.current && result.sequence === current) {
          setPreview({ ...result, document: sent });
        }
      } catch (error) { if (!controller.signal.aborted && current === sequence.current) setMessage(error instanceof AdminApiError ? error.message : "Không kết nối được máy chủ xem trước. Bản nhập của bạn vẫn được giữ lại."); }
      finally { if (!controller.signal.aborted && current === sequence.current) setPending(false); }
    })();
    return () => controller.abort();
  }, [documentId, attempt, active]);

  // Tự cập nhật khi bạn ngừng thao tác một lúc (không gửi sau mỗi lần gõ); bản đang lỗi và lúc đang gửi thì không tự gửi lại.
  const dirty = preview?.document !== serialized;
  useEffect(() => {
    if (!clientReady || !validDocument || !dirty || pending || message) return;
    const timer = window.setTimeout(() => setAttempt(value => value + 1), 1500);
    return () => window.clearTimeout(timer);
  }, [clientReady, validDocument, dirty, pending, message, serialized]);
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
      if (event.origin !== origin || (event.source !== frame.current?.contentWindow && event.source !== canvasFrame.current?.contentWindow && event.source !== popup.current)) return;
      const selection = builderSelectionMessageSchema.safeParse(event.data);
      if (selection.success) callbacks.current.onSelect(selection.data.index, selection.data.item, selection.data.field);
      if (readySchema.safeParse(event.data).success && callbacks.current.selectedIndex !== null) (event.source as Window).postMessage({ type: "iorder:highlight-block", index: callbacks.current.selectedIndex }, origin);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [origin]);
  useEffect(() => { if (selectedIndex !== null) { frame.current?.contentWindow?.postMessage({ type: "iorder:highlight-block", index: selectedIndex }, origin); canvasFrame.current?.contentWindow?.postMessage({ type: "iorder:highlight-block", index: selectedIndex }, origin); if (popup.current && !popup.current.closed) popup.current.postMessage({ type: "iorder:highlight-block", index: selectedIndex }, origin); } }, [selectedIndex, origin]);

  function openPopup() {
    if (outdated) refresh();
    previewId.current ??= createPreviewId();
    const target = window.open(previewUrl || "about:blank", `iorder-preview-${previewId.current}`, "popup,width=1280,height=900,resizable=yes,scrollbars=yes");
    if (!target) { setMessage("Trình duyệt đang chặn cửa sổ mới. Bạn có thể dùng Xem trước trang hoặc cho phép cửa sổ bật lên cho CMS."); dialog.current?.showModal(); setIsOpen(true); return; }
    if (!previewUrl) { target.document.title = "Đang tải bản xem trước"; target.document.body.textContent = "Đang tải bản xem trước từ CMS…"; }
    popup.current = target;
    setPopupOpen(true);
    target.focus();
  }

  const outdated = validDocument && !pending && !message && preview?.document !== serialized;
  const canvasStatus = !validDocument ? "Chưa đủ thông tin để cập nhật. Đang hiện lần hợp lệ gần nhất." : message ? "Bản xem trước chưa được cập nhật." : pending ? "Đang cập nhật…" : outdated ? "Có thay đổi, canvas tự cập nhật sau giây lát (hoặc bấm nút cập nhật)." : "Xem trước đã khớp nội dung đang nhập · Chưa lưu vào nội dung.";
  const refresh = () => setAttempt(value => value + 1);
  const virtualWidth = deviceWidths[device];
  const fitScale = box.width ? Math.min(1, box.width / virtualWidth) : 1;
  const scale = zoom === "fit" ? fitScale : zoom;
  // Chiều cao khung của trang: lấp đầy canvas nhưng không quá 1000px để phần "cao một màn hình" không bị kéo giãn bất thường.
  const virtualHeight = box.height ? Math.min(1000, Math.max(480, Math.round(box.height / scale))) : 720;
  const busy = validDocument && !message && pending;
  const StatusIcon = !validDocument || message ? TriangleAlert : busy ? LoaderCircle : outdated ? Clock : CircleCheck;
  const devices = [{ value: "desktop", label: "Máy tính", Icon: Monitor }, { value: "tablet", label: "Máy tính bảng", Icon: Tablet }, { value: "mobile", label: "Điện thoại", Icon: Smartphone }] as const;
  return <section aria-label="Xem trước trực tiếp" className="admin-builder-preview" ref={root}>
    <div className="admin-builder-canvas__toolbar">
      <div aria-label="Thiết bị xem trước" className="admin-canvas-segment" role="radiogroup">
        {devices.map(({ value, label, Icon }) => <button aria-checked={device === value} aria-label={label} className="admin-canvas-tool" key={value} onClick={() => setDevice(value)} role="radio" title={label} type="button"><Icon aria-hidden="true" size={16} /></button>)}
      </div>
      <select aria-label="Thu phóng canvas" className="admin-canvas-zoom" onChange={event => setZoom(event.target.value === "fit" ? "fit" : Number(event.target.value) as 0.5 | 0.75 | 1)} title="Thu phóng canvas so với kích thước thật" value={String(zoom)}>
        <option value="fit">Vừa khung ({Math.round(fitScale * 100)}%)</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option>
      </select>
      {onUndo && onRedo ? <div aria-label="Hoàn tác và làm lại" className="admin-canvas-segment" role="group">
        <button aria-label="Hoàn tác" className="admin-canvas-tool" disabled={!canUndo} onClick={onUndo} title="Hoàn tác (Ctrl+Z)" type="button"><Undo2 aria-hidden="true" size={16} /></button>
        <button aria-label="Làm lại" className="admin-canvas-tool" disabled={!canRedo} onClick={onRedo} title="Làm lại (Ctrl+Shift+Z)" type="button"><Redo2 aria-hidden="true" size={16} /></button>
      </div> : null}
      <span aria-live="polite" className={`admin-canvas-status${!validDocument || message ? " admin-canvas-status--warn" : ""}`} role="status" title={`${canvasStatus} Bấm vào một phần trên canvas để chọn và sửa.`}><StatusIcon aria-hidden="true" className={busy ? "admin-canvas-spin" : undefined} size={16} /><span className="sr-only">{canvasStatus}</span></span>
      <div className="admin-canvas-actions">
        {onToggleWide ? <button aria-label={wide ? "Thu lại" : "Mở rộng canvas"} aria-pressed={wide} className="admin-canvas-tool" onClick={onToggleWide} title={wide ? "Thu lại (hiện danh sách và thuộc tính)" : "Mở rộng canvas: ẩn danh sách và thuộc tính. Bấm một phần trên canvas sẽ tự thu lại"} type="button">{wide ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}</button> : null}
        <button aria-label="Cập nhật xem trước" className="admin-canvas-tool admin-canvas-update" data-outdated={outdated ? "true" : undefined} disabled={!validDocument || pending} onClick={refresh} title={outdated ? "Có thay đổi chưa hiện trên xem trước. Bấm để cập nhật" : "Cập nhật xem trước với nội dung đang nhập"} type="button"><RefreshCw aria-hidden="true" className={busy ? "admin-canvas-spin" : undefined} size={16} /></button>
        <button aria-label="Xem trước trang" className="admin-canvas-tool" disabled={!clientReady} onClick={() => { if (outdated) refresh(); dialog.current?.showModal(); setIsOpen(true); }} title="Xem trước trang toàn màn hình" type="button"><Eye aria-hidden="true" size={16} /></button>
        <button aria-label="Cửa sổ riêng ↗" className="admin-canvas-tool" disabled={!clientReady || !validDocument} onClick={openPopup} title="Mở trong cửa sổ riêng" type="button"><ExternalLink aria-hidden="true" size={16} /></button>
      </div>
    </div>
    {message ? <div className="grid gap-2"><AdminNotice tone="warning">{message}</AdminNotice><AdminButton onClick={() => setAttempt(value => value + 1)} size="sm" variant="secondary">Thử cập nhật xem trước</AdminButton></div> : null}
    <div className="admin-builder-canvas__viewport" ref={viewport}>
      {token && box.width > 0 ? <div className="admin-builder-canvas__stage" style={{ width: Math.round(virtualWidth * scale), height: Math.round(virtualHeight * scale) }}><iframe ref={canvasFrame} title="Canvas xem trước website" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" src={previewUrl} style={{ width: virtualWidth, height: virtualHeight, transform: `scale(${scale})` }} /></div> : <p className="admin-help">{validDocument ? "Đang tải bản xem trước…" : "Bản xem trước sẽ xuất hiện khi nội dung hợp lệ."}</p>}
    </div>
    {popupOpen && !isOpen ? <div className="admin-builder-preview__status" aria-live="polite">{!validDocument ? <AdminNotice tone="warning">Hoàn thiện các trường bắt buộc để cập nhật cửa sổ xem trước. Cửa sổ vẫn giữ lần hợp lệ gần nhất.</AdminNotice> : message ? <><AdminNotice tone="warning">{message}</AdminNotice><AdminButton onClick={() => setAttempt(value => value + 1)} size="sm" variant="secondary">Thử cập nhật xem trước</AdminButton></> : <p className="admin-help">{pending ? "Đang cập nhật cửa sổ xem trước…" : outdated ? "Có thay đổi chưa cập nhật. Bấm nút cập nhật xem trước." : "Cửa sổ xem trước đã khớp nội dung đang nhập · Nội dung chưa được lưu."}</p>}</div> : null}
    {clientReady ? createPortal(<dialog aria-labelledby="builder-preview-title" className="admin-builder-preview-dialog" onClose={() => setIsOpen(false)} ref={dialog}>
    <header><strong id="builder-preview-title">Xem trước trang</strong><div className="admin-builder-preview__devices"><AdminButton onClick={() => setAttempt(value => value + 1)} size="sm" variant="ghost">Làm mới</AdminButton><AdminButton aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} size="sm" variant="ghost">Máy tính</AdminButton><AdminButton aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} size="sm" variant="ghost">Điện thoại</AdminButton><AdminButton disabled={!validDocument} onClick={openPopup} size="sm" variant="ghost">Cửa sổ riêng ↗</AdminButton><AdminButton onClick={() => dialog.current?.close()} size="sm" variant="secondary">Đóng xem trước</AdminButton></div></header>
    <p className="admin-help" role="status">{!validDocument ? "Chưa đủ thông tin để cập nhật xem trước." : message ? "Bản xem trước chưa được cập nhật." : pending ? "Đang cập nhật xem trước…" : outdated ? "Có thay đổi chưa cập nhật. Bấm Làm mới để cập nhật." : "Đã khớp bản đang nhập · Chưa lưu vào nội dung."}</p>
    {!validDocument ? <AdminNotice tone="warning">Hoàn thiện tên, đường dẫn và các trường bắt buộc để cập nhật xem trước. Bản đang hiển thị là lần hợp lệ gần nhất.</AdminNotice> : message ? <div className="grid gap-2"><AdminNotice tone="warning">{message}</AdminNotice><AdminButton onClick={() => setAttempt(value => value + 1)} size="sm" variant="secondary">Thử cập nhật xem trước</AdminButton></div> : null}
    <div className={`admin-builder-preview__viewport${device === "mobile" ? " admin-builder-preview__viewport--mobile" : ""}`}>
      {token && isOpen ? <iframe ref={frame} title="Bản xem trước website" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" src={previewUrl} /> : <p className="admin-help">Bản xem trước sẽ xuất hiện khi nội dung hợp lệ.</p>}
    </div>
    </dialog>, window.document.body) : null}
  </section>;
}

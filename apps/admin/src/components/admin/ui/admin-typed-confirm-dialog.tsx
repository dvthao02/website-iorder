"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { matchesConfirmationWord } from "@/lib/restore-confirm";
import { AdminButton } from "./admin-button";
import { useAdminFocusTrap } from "./admin-focus-trap";
import { AdminInput } from "./admin-input";

/**
 * Hộp xác nhận cho thao tác không hoàn tác được: phải gõ một từ ngắn (so khớp bỏ qua hoa/thường và dấu, xem
 * restore-confirm.ts) mới bấm được nút xác nhận, để chống bấm nhầm. Dùng cho phục hồi dữ liệu và xóa bản sao lưu.
 */
export function AdminTypedConfirmDialog({ busy, children, confirmDisabled = false, confirmLabel, onClose, onConfirm, title, word }: {
  busy: boolean;
  children: ReactNode;
  /** Chặn nút xác nhận vì lý do khác ngoài việc gõ từ (ví dụ không có gì để xóa). */
  confirmDisabled?: boolean;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  word: string;
}) {
  const [typed, setTyped] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  useAdminFocusTrap({ containerRef: dialogRef, initialFocusSelector: "[data-typed-confirm-input]", isOpen: true, onClose });
  const matches = matchesConfirmationWord(typed, word);
  return <div className="admin-confirm-dialog-backdrop" onMouseDown={() => !busy && onClose()} role="presentation">
    <section aria-labelledby="typed-confirm-title" aria-modal="true" className="admin-confirm-dialog" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="alertdialog" tabIndex={-1}>
      <h2 id="typed-confirm-title">{title}</h2>
      {children}
      <p>Để xác nhận, gõ chữ <strong>{word}</strong> vào ô bên dưới:</p>
      <AdminInput autoComplete="off" data-typed-confirm-input disabled={busy} onChange={(event) => setTyped(event.target.value)} placeholder={word} value={typed} />
      <div className="admin-confirm-dialog__actions">
        <AdminButton disabled={busy} onClick={onClose} variant="secondary">Hủy</AdminButton>
        <AdminButton disabled={!matches || busy || confirmDisabled} onClick={onConfirm} variant="danger">{busy ? <LoaderCircle aria-hidden="true" className="admin-content-actions__spinner" size={16} /> : null}{confirmLabel}</AdminButton>
      </div>
    </section>
  </div>;
}

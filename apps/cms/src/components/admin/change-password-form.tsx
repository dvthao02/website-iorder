"use client";

import { useRef, useState, type FormEvent } from "react";

import { requestAdminJson } from "@/lib/admin-api";

import { AdminButton } from "./ui/admin-button";
import { useAdminToast } from "./ui/admin-feedback";

const blank = { currentPassword: "", newPassword: "", confirmPassword: "" };

// Đổi mật khẩu của chính tài khoản đang đăng nhập; các phiên đăng nhập khác bị đăng xuất sau khi đổi.
export function ChangePasswordForm() {
  const { show: showToast } = useAdminToast();
  const [values, setValues] = useState(blank);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mismatch = values.confirmPassword.length > 0 && values.confirmPassword !== values.newPassword;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    if (values.newPassword !== values.confirmPassword) { showToast("Mật khẩu nhập lại chưa khớp.", "warning"); return; }
    pending.current = true;
    setBusy(true);
    try {
      const payload = await requestAdminJson("/api/admin/account/password", "POST", { currentPassword: values.currentPassword, newPassword: values.newPassword }, "Không thể đổi mật khẩu.");
      const revoked = payload && typeof payload === "object" && "revokedSessions" in payload && typeof payload.revokedSessions === "number" ? payload.revokedSessions : 0;
      setValues(blank);
      showToast(revoked ? `Đã đổi mật khẩu và đăng xuất ${revoked} phiên khác.` : "Đã đổi mật khẩu.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể đổi mật khẩu.", "error");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const set = (key: keyof typeof blank) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));
  return <form className="grid gap-4" onSubmit={submit}>
    <fieldset className="admin-form-grid" disabled={busy}>
      <label className="admin-field admin-field--wide">Mật khẩu hiện tại<input autoComplete="current-password" onChange={set("currentPassword")} required type="password" value={values.currentPassword} /></label>
      <div className="admin-field"><label htmlFor="new-password">Mật khẩu mới</label><input aria-describedby="new-password-hint" autoComplete="new-password" id="new-password" minLength={10} onChange={set("newPassword")} required type="password" value={values.newPassword} /><span className="admin-field__hint" id="new-password-hint">Ít nhất 10 ký tự, khác mật khẩu đang dùng.</span></div>
      <div className="admin-field"><label htmlFor="confirm-password">Nhập lại mật khẩu mới</label><input aria-describedby={mismatch ? "confirm-password-hint" : undefined} aria-invalid={mismatch} autoComplete="new-password" id="confirm-password" onChange={set("confirmPassword")} required type="password" value={values.confirmPassword} />{mismatch ? <span className="admin-field__hint admin-text-error" id="confirm-password-hint">Chưa khớp với mật khẩu mới.</span> : null}</div>
    </fieldset>
    <AdminButton className="justify-self-start" disabled={busy || mismatch} type="submit">{busy ? "Đang lưu…" : "Đổi mật khẩu"}</AdminButton>
  </form>;
}

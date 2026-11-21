"use client";

import { Camera, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { updateOwnProfileSchema } from "@iorder/shared/server/auth/account.contract";

import { AdminAvatar } from "./ui/admin-avatar";
import { AdminButton } from "./ui/admin-button";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";
import { AdminFormField } from "./ui/admin-form-field";
import { AdminHelpTip } from "./ui/admin-help-tip";
import { AdminImageLightbox } from "./ui/admin-image-lightbox";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";

type ProfileFormValues = { fullName: string; email: string; phone: string };
type ProfileFormProps = {
  initial: ProfileFormValues;
  avatarUrl: string | null;
  username: string;
  roleName: string;
  /** Báo cho nơi chứa form (panel tài khoản) biết có thay đổi chưa lưu hoặc đang lưu, để hỏi trước khi đóng. */
  onStatusChange?: (status: { dirty: boolean; busy: boolean }) => void;
};

const avatarTypes = ["image/png", "image/jpeg", "image/webp"];
const avatarMaxBytes = 2 * 1024 * 1024;
const saveResponseSchema = z.object({ profile: z.object({ fullName: z.string(), email: z.string().nullable(), phone: z.string().nullable() }) });
const avatarResponseSchema = z.object({ avatarUrl: z.string().min(1) });

// Hồ sơ của chính người đang đăng nhập: họ tên, email, số điện thoại (lưu bằng nút Lưu) và ảnh đại diện (lưu ngay khi chọn ảnh).
export function ProfileForm({ initial, avatarUrl: initialAvatarUrl, username, roleName, onStatusChange }: ProfileFormProps) {
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const [form, setForm] = useState<ProfileFormValues>(initial);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const { isDirty, markSaved, getSavedValue } = useUnsavedChanges(form);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const avatarPending = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Xem lớn ảnh đại diện như ở thư viện media: rê chuột (sau một nhịp ngắn) thì hiện xem nhanh, bấm thì mở hộp xem ảnh.
  const [viewer, setViewer] = useState<"peek" | "open" | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (peekTimer.current) clearTimeout(peekTimer.current); }, []);
  const startPeek = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setViewer((current) => current ?? "peek"), 250);
  };
  const stopPeek = () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setViewer((current) => current === "peek" ? null : current);
  };
  const validation = useAdminFormValidation<keyof ProfileFormValues>("own-profile", {
    fullName: { label: "Họ và tên", message: "Nhập họ và tên từ 1 đến 180 ký tự." },
    email: { label: "Email", message: "Nhập email hợp lệ (tối đa 320 ký tự) hoặc để trống." },
    phone: { label: "Số điện thoại", message: "Nhập số điện thoại hợp lệ hoặc để trống." },
  });
  const working = busy || avatarBusy;
  useNavigationGuard(isDirty || working, working ? () => showToast("Đang lưu hồ sơ. Vui lòng chờ trước khi rời trang.", "info") : undefined);
  useEffect(() => { onStatusChange?.({ dirty: isDirty, busy: working }); }, [isDirty, onStatusChange, working]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || avatarPending.current || !isDirty) return;
    setMessage("");
    const parsed = updateOwnProfileSchema.safeParse(form);
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    saving.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/admin/account/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      const payload: unknown = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể lưu hồ sơ.");
      const saved = saveResponseSchema.safeParse(payload);
      if (!saved.success) throw new Error("Phản hồi lưu hồ sơ không hợp lệ. Hãy tải lại trang để kiểm tra.");
      const values = { fullName: saved.data.profile.fullName, email: saved.data.profile.email ?? "", phone: saved.data.profile.phone ?? "" };
      setForm(values);
      markSaved(values);
      showToast("Đã lưu hồ sơ.", "success");
      // Tên hiện ở thanh đầu trang và menu tài khoản, vẽ từ máy chủ nên cần làm mới.
      router.refresh();
    } catch (error) {
      const notice = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setMessage(notice);
      showToast(notice, "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || avatarPending.current) return;
    if (!avatarTypes.includes(file.type)) { showToast("Chỉ nhận ảnh PNG, JPEG hoặc WebP.", "warning"); return; }
    if (file.size > avatarMaxBytes) { showToast("Ảnh đại diện không được vượt quá 2 MB.", "warning"); return; }
    avatarPending.current = true;
    setAvatarBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/v1/admin/account/avatar", { method: "POST", body });
      const payload: unknown = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể đổi ảnh đại diện.");
      const saved = avatarResponseSchema.safeParse(payload);
      if (!saved.success) throw new Error("Phản hồi đổi ảnh không hợp lệ. Hãy tải lại trang để kiểm tra.");
      setAvatarUrl(saved.data.avatarUrl);
      showToast("Đã cập nhật ảnh đại diện.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      avatarPending.current = false;
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    if (avatarPending.current || !avatarUrl) return;
    avatarPending.current = true;
    setAvatarBusy(true);
    try {
      const response = await fetch("/api/v1/admin/account/avatar", { method: "DELETE" });
      const payload: unknown = await readAdminJson(response);
      if (!response.ok) throw adminApiError(payload, "Không thể xóa ảnh đại diện.");
      setAvatarUrl(null);
      showToast("Đã xóa ảnh đại diện.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      avatarPending.current = false;
      setAvatarBusy(false);
    }
  }

  const set = (key: keyof ProfileFormValues) => (event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const pickAvatar = () => fileInput.current?.click();
  const openViewer = () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setViewer("open");
  };

  // Ảnh đại diện là nút: có ảnh thì rê chuột xem nhanh, bấm xem lớn; chưa có ảnh thì bấm để chọn. Nút máy ảnh ở góc đổi ảnh
  // (luôn hiện để thiết bị cảm ứng không cần rê chuột). Quy định ảnh và ai quản lý tên đăng nhập, vai trò nằm trong chú thích ⓘ.
  return <div className="admin-account-form">
    <div className="admin-profile-avatar">
      <div className="admin-profile-avatar__frame">
        <button aria-label={avatarUrl ? "Xem ảnh đại diện" : "Chọn ảnh đại diện"} className="admin-profile-avatar__main" data-busy={avatarBusy ? "" : undefined} data-empty={avatarUrl ? undefined : ""} disabled={avatarBusy} onClick={avatarUrl ? openViewer : pickAvatar} onPointerEnter={avatarUrl ? startPeek : undefined} onPointerLeave={avatarUrl ? stopPeek : undefined} type="button">
          <AdminAvatar avatarUrl={avatarUrl} fullName={form.fullName || username} size={88} />
          <span aria-hidden="true" className="admin-profile-avatar__hover">{avatarUrl ? <ZoomIn size={20} /> : <Camera size={20} />}<small>{avatarBusy ? "Đang xử lý…" : avatarUrl ? "Xem ảnh" : "Chọn ảnh"}</small></span>
        </button>
        <button aria-label="Đổi ảnh đại diện" className="admin-profile-avatar__badge" disabled={avatarBusy} onClick={pickAvatar} title="Đổi ảnh" type="button"><Camera aria-hidden="true" size={15} /></button>
        <input accept={avatarTypes.join(",")} aria-label="Chọn tệp ảnh đại diện" hidden onChange={chooseAvatar} ref={fileInput} type="file" />
      </div>
      <div className="admin-profile-avatar__info">
        <span className="admin-profile-avatar__name"><strong>@{username}</strong><AdminHelpTip label="Giải thích: ảnh đại diện, tên đăng nhập và vai trò">Ảnh PNG, JPEG hoặc WebP, tối đa 2 MB, lưu ngay khi chọn. Tên đăng nhập và vai trò do quản trị viên quản lý ở mục Người dùng CMS.</AdminHelpTip></span>
        <span className="admin-profile-avatar__role">{roleName}</span>
        {avatarUrl ? <AdminButton className="admin-profile-avatar__remove" disabled={avatarBusy} onClick={removeAvatar} size="sm" type="button" variant="ghost">Xóa ảnh</AdminButton> : null}
      </div>
    </div>
    {avatarUrl ? <AdminImageLightbox alt="Ảnh đại diện" caption={form.fullName || username} mode={viewer} onClose={() => setViewer(null)} src={avatarUrl} /> : null}
    <form className="admin-account-form" noValidate onSubmit={submit}>
      {validation.summary}
      {message ? <AdminNotice tone="error">{message}</AdminNotice> : null}
      <fieldset className="admin-form-grid" disabled={busy}>
        <AdminFormField error={validation.message("fullName")} id={validation.props("fullName").id} label="Họ và tên">
          <input {...validation.props("fullName")} autoComplete="name" className="block w-full" maxLength={180} name="fullName" onChange={set("fullName")} required value={form.fullName} />
        </AdminFormField>
        <AdminFormField error={validation.message("email")} id={validation.props("email").id} label="Email">
          <input {...validation.props("email")} autoComplete="email" className="block w-full" inputMode="email" maxLength={320} name="email" onChange={set("email")} type="email" value={form.email} />
        </AdminFormField>
        <AdminFormField error={validation.message("phone")} id={validation.props("phone").id} label="Số điện thoại">
          <input {...validation.props("phone")} autoComplete="tel" className="block w-full" inputMode="tel" maxLength={30} name="phone" onChange={set("phone")} type="tel" value={form.phone} />
        </AdminFormField>
      </fieldset>
      <AdminEditorActions className="admin-account-actions" variant="inline">
        <p role="status">{busy ? "Đang lưu hồ sơ…" : isDirty ? "Có thay đổi chưa lưu." : ""}</p>
        {isDirty ? <AdminButton disabled={busy} onClick={() => { setForm(getSavedValue()); setMessage(""); validation.reset(); }} type="button" variant="secondary">Bỏ thay đổi</AdminButton> : null}
        <AdminButton disabled={busy || !isDirty} type="submit">{busy ? "Đang lưu…" : "Lưu hồ sơ"}</AdminButton>
      </AdminEditorActions>
    </form>
  </div>;
}

"use client";

import { adminApiError } from "@/lib/admin-api";
import { useRef, useState, type FormEvent } from "react";

import type { ExternalLinks } from "@iorder/core/server/settings/external-links.contract";
import { useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminEditorActions } from "@/components/admin/ui/admin-editor-actions";
import { AdminButton } from "./ui/admin-button";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";

const fields = [
  ["appLogin", "Trang đăng nhập ứng dụng"],
  ["trial", "Trang đăng ký dùng thử"],
  ["facebook", "Facebook"],
  ["zalo", "Zalo"],
  ["youtube", "YouTube"],
  ["appStore", "Apple App Store"],
  ["googlePlay", "Google Play"],
] as const satisfies ReadonlyArray<readonly [keyof ExternalLinks, string]>;

const emptyLinks: ExternalLinks = {
  appLogin: null,
  trial: null,
  facebook: null,
  zalo: null,
  youtube: null,
  appStore: null,
  googlePlay: null,
};

export function ExternalLinksEditor({ initial, initialVersion }: { initial: ExternalLinks | null; initialVersion: number }) {
  const version = useRef(initialVersion);
  const [links, setLinks] = useState<ExternalLinks>(initial ?? emptyLinks);
  const { isDirty, markSaved } = useUnsavedChanges(links);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();

  function update(key: keyof ExternalLinks, value: string) {
    setLinks(current => ({ ...current, [key]: value || null }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/external-links", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: links, expectedVersion: version.current }),
      });
      const body = await response.json();
      if (response.ok) { if (typeof body.version === "number") version.current = body.version; markSaved(); showToast("Đã cập nhật liên kết ngoài trên website.", "success"); }
      else { const notice = adminApiError(body, "Không thể lưu liên kết ngoài.").message; setMessage(notice); showToast(notice, "error"); }
    } catch {
      const notice = "Không kết nối được máy chủ."; setMessage(notice); showToast(notice, "error");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <form className="grid gap-4" onSubmit={save}>
    <p>Điền URL đầy đủ, ví dụ <code>https://...</code>. Để trống một dịch vụ nếu website chưa sử dụng dịch vụ đó.</p>
    {fields.map(([key, label]) => <label key={key}>{label}<input className="block w-full" type="url" value={links[key] ?? ""} onChange={event => update(key, event.target.value)} placeholder="https://..." /></label>)}
    <AdminEditorActions><p role="status">{message || (isDirty ? "Có thay đổi chưa lưu." : "Không có thay đổi chưa lưu.")}</p><AdminButton disabled={busy || !isDirty} permission="settings.update" type="submit">{busy ? "Đang lưu…" : "Lưu liên kết ngoài"}</AdminButton></AdminEditorActions>
  </form>;
}

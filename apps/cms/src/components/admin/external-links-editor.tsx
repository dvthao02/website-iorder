"use client";

import { useState, type FormEvent } from "react";

import type { ExternalLinks } from "@iorder/core/server/settings/external-links.contract";
import { useAdminToast } from "@/components/admin/ui/admin-feedback";
import { AdminEditorActions } from "@/components/admin/ui/admin-editor-actions";

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

export function ExternalLinksEditor({ initial }: { initial: ExternalLinks | null }) {
  const [links, setLinks] = useState<ExternalLinks>(initial ?? emptyLinks);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();

  function update(key: keyof ExternalLinks, value: string) {
    setLinks(current => ({ ...current, [key]: value.trim() || null }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/external-links", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(links),
      });
      const body = await response.json();
      if (response.ok) showToast("Đã cập nhật liên kết ngoài trên website.", "success");
      else { const notice = body.error?.message ?? "Không thể lưu liên kết ngoài."; setMessage(notice); showToast(notice, "error"); }
    } catch {
      const notice = "Không kết nối được máy chủ."; setMessage(notice); showToast(notice, "error");
    } finally {
      setBusy(false);
    }
  }

  return <form className="grid gap-4" onSubmit={save}>
    <p>Điền URL đầy đủ, ví dụ <code>https://...</code>. Để trống một dịch vụ nếu website chưa sử dụng dịch vụ đó.</p>
    {fields.map(([key, label]) => <label key={key}>{label}<input className="block w-full rounded border p-2" type="url" value={links[key] ?? ""} onChange={event => update(key, event.target.value)} placeholder="https://..." /></label>)}
    <AdminEditorActions><p role="status">{message}</p><button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>{busy ? "Đang lưu…" : "Lưu liên kết ngoài"}</button></AdminEditorActions>
  </form>;
}

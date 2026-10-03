"use client";

import { useState, type FormEvent } from "react";

import type { ListingContent } from "@iorder/core/server/settings/listing-content.contract";
import { AdminEditorActions } from "@/components/admin/ui/admin-editor-actions";
import { useAdminToast } from "@/components/admin/ui/admin-feedback";

type ListingKey = keyof ListingContent;
type Entry = ListingContent[ListingKey];

const labels: Record<ListingKey, string> = { news: "Tin tức", support: "Hỗ trợ", equipment: "Thiết bị", guides: "Hướng dẫn" };
const empty: ListingContent = {
  news: { eyebrow: "", title: "", description: null },
  support: { eyebrow: "", title: "", description: null },
  equipment: { eyebrow: "", title: "", description: null },
  guides: { eyebrow: "", title: "", description: null },
};

export function ListingContentEditor({ initial }: { initial: ListingContent | null }) {
  const [content, setContent] = useState<ListingContent>(initial ?? empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();

  function update(key: ListingKey, value: Entry) { setContent(current => ({ ...current, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/listing-content", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(content) });
      const body = await response.json();
      if (response.ok) showToast("Đã cập nhật nội dung trang danh sách trên website.", "success");
      else { const notice = body.error?.message ?? "Không thể lưu nội dung."; setMessage(notice); showToast(notice, "error"); }
    } catch {
      const notice = "Không kết nối được máy chủ."; setMessage(notice); showToast(notice, "error");
    } finally {
      setBusy(false);
    }
  }

  return <form className="grid gap-5" onSubmit={save}>{(Object.keys(labels) as ListingKey[]).map(key => <fieldset className="grid gap-3 rounded border p-4" key={key}><legend className="px-1 font-semibold">{labels[key]}</legend><label>Dòng giới thiệu<input className="block w-full rounded border p-2" required value={content[key].eyebrow} onChange={event => update(key, { ...content[key], eyebrow: event.target.value })} /></label><label>Tiêu đề<input className="block w-full rounded border p-2" required value={content[key].title} onChange={event => update(key, { ...content[key], title: event.target.value })} /></label><label>Mô tả<textarea className="block w-full rounded border p-2" value={content[key].description ?? ""} onChange={event => update(key, { ...content[key], description: event.target.value.trim() || null })} /></label></fieldset>)}<AdminEditorActions><p className="mr-auto text-sm" role="status">{message}</p><button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>{busy ? "Đang lưu…" : "Lưu nội dung trang danh sách"}</button></AdminEditorActions></form>;
}

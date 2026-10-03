"use client";

import { useState, type FormEvent } from "react";

import type { CatalogContent } from "@iorder/core/server/settings/catalog-content.contract";
import { AdminEditorActions } from "@/components/admin/ui/admin-editor-actions";
import { useAdminToast } from "@/components/admin/ui/admin-feedback";

type CatalogKey = keyof CatalogContent;
type ActiveCatalogKey = Exclude<CatalogKey, "industry">;
type Entry = CatalogContent[CatalogKey];

const labels: Record<ActiveCatalogKey, string> = { software: "Phần mềm", solution: "Giải pháp", service: "Dịch vụ" };
const empty: CatalogContent = {
  software: { eyebrow: "", title: "", description: null },
  solution: { eyebrow: "", title: "", description: null },
  service: { eyebrow: "", title: "", description: null },
  industry: { eyebrow: "", title: "", description: null },
};

export function CatalogContentEditor({ initial }: { initial: CatalogContent | null }) {
  const [content, setContent] = useState<CatalogContent>(initial ?? empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { show: showToast } = useAdminToast();

  function update(key: CatalogKey, value: Entry) { setContent(current => ({ ...current, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/catalog-content", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(content) });
      const body = await response.json();
      if (response.ok) showToast("Đã cập nhật nội dung trang danh mục trên website.", "success");
      else { const notice = body.error?.message ?? "Không thể lưu nội dung."; setMessage(notice); showToast(notice, "error"); }
    } catch {
      const notice = "Không kết nối được máy chủ."; setMessage(notice); showToast(notice, "error");
    } finally {
      setBusy(false);
    }
  }

  return <form className="grid gap-5" onSubmit={save}>{(Object.keys(labels) as ActiveCatalogKey[]).map(key => <fieldset className="grid gap-3 rounded border p-4" key={key}><legend className="px-1 font-semibold">{labels[key]}</legend><label>Dòng giới thiệu<input className="block w-full rounded border p-2" required value={content[key].eyebrow} onChange={event => update(key, { ...content[key], eyebrow: event.target.value })} /></label><label>Tiêu đề<input className="block w-full rounded border p-2" required value={content[key].title} onChange={event => update(key, { ...content[key], title: event.target.value })} /></label><label>Mô tả<textarea className="block w-full rounded border p-2" value={content[key].description ?? ""} onChange={event => update(key, { ...content[key], description: event.target.value.trim() || null })} /></label></fieldset>)}<AdminEditorActions><p className="mr-auto text-sm" role="status">{message}</p><button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>{busy ? "Đang lưu…" : "Lưu nội dung danh mục"}</button></AdminEditorActions></form>;
}

"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { MediaPicker } from "./media-picker";
import { RevisionHistory } from "./revision-history";
import { AdminEditorTabs } from "./ui/admin-editor-tabs";
import { AdminEditorActions } from "./ui/admin-editor-actions";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";
import { AdminNotice } from "./ui/admin-feedback";

import type { AdminOffering, AdminOfferingInput, PublicOfferingType } from "@iorder/core/server/offerings/offering-content.contract";

type Notice = { kind: "error" | "success"; message: string } | undefined;
type OfferingItem = AdminOfferingInput["content"]["items"][number];

type CmsContentManagerProps = {
  initialOfferings: AdminOffering[];
  offeringType?: PublicOfferingType;
  offeringTypeLabel?: string;
  showOfferings?: boolean;
};

const inputClassName = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
const labelClassName = "block text-sm font-bold text-slate-700";

function EditorSection({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return <section className="admin-content-section grid gap-4 rounded-xl border p-4 sm:p-5"><header><h3 className="font-extrabold text-slate-950">{title}</h3>{description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}</header>{children}</section>;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function dateTimeInputValue(value: Date | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function dateTimeOrNull(value: string) {
  return value ? new Date(value) : null;
}

function lines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function faqLines(value: string): [string, string][] {
  return value
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[0]) && Boolean(parts[1]));
}

function moveOfferingItem(items: OfferingItem[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

function OfferingItemsEditor({ items, onChange }: { items: OfferingItem[]; onChange: (items: OfferingItem[]) => void }) {
  return <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4">
    <legend className="px-1 text-sm font-bold text-slate-700">Mục liên quan</legend>
    <p className="text-sm text-slate-600">Mỗi mục có thể chỉ là văn bản, hoặc có đường dẫn nội bộ như <code>/lien-he</code> hay URL ngoài.</p>
    {items.map((item, index) => {
      const linkedItem = typeof item === "string" ? undefined : item;
      const title = typeof item === "string" ? item : item.title;
      return <div className="grid gap-3 rounded-lg bg-slate-50 p-3" key={index}>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <label className={labelClassName}>Loại mục<select className={inputClassName} value={linkedItem ? "link" : "text"} onChange={event => onChange(items.map((entry, entryIndex) => entryIndex !== index ? entry : event.target.value === "link" ? { title, href: "/" } : title))}><option value="text">Văn bản</option><option value="link">Có đường dẫn</option></select></label>
          <label className={labelClassName}>Nội dung<input className={inputClassName} required value={title} onChange={event => onChange(items.map((entry, entryIndex) => entryIndex !== index ? entry : typeof entry === "string" ? event.target.value : { ...entry, title: event.target.value }))} /></label>
        </div>
        {linkedItem ? <label className={labelClassName}>Đường dẫn<input className={inputClassName} required value={linkedItem.href} onChange={event => onChange(items.map((entry, entryIndex) => entryIndex === index && typeof entry !== "string" ? { ...entry, href: event.target.value } : entry))} placeholder="/lien-he hoặc https://..." /></label> : null}
        <div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => onChange(moveOfferingItem(items, index, -1))}>Lên</button><button type="button" disabled={index === items.length - 1} onClick={() => onChange(moveOfferingItem(items, index, 1))}>Xuống</button><button type="button" className="text-red-700" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>Xóa</button></div>
      </div>;
    })}
    <button type="button" className="justify-self-start" onClick={() => onChange([...items, "Mục mới"])}>Thêm mục</button>
  </fieldset>;
}

async function requestJson(url: string, method: "PATCH" | "POST", body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error?: { message?: unknown } }).error?.message
      : undefined;
    throw new Error(typeof message === "string" ? message : "Không thể lưu thay đổi. Vui lòng thử lại.");
  }

  return payload;
}

export function CmsContentManager({ initialOfferings, offeringType, offeringTypeLabel = "Nội dung catalog", showOfferings = true }: CmsContentManagerProps) {
  const searchParams = useSearchParams();
  const requestedOfferingId = searchParams.get("edit");
  const [offerings, setOfferings] = useState(initialOfferings);
  const [activeOfferingId, setActiveOfferingId] = useState<string | undefined>(() => initialOfferings.some(offering => offering.id === requestedOfferingId) ? requestedOfferingId ?? undefined : initialOfferings[0]?.id);
  const [isCreatingOffering, setIsCreatingOffering] = useState(() => searchParams.get("create") === "1");
  const [notice, setNotice] = useState<Notice>();

  const activeOffering = offerings.find((offering) => offering.id === activeOfferingId);

  function notify(nextNotice: Notice) {
    setNotice(nextNotice);
  }

  return (
    <div className="grid gap-12">
      {notice ? <AdminNotice tone={notice.kind}>{notice.message}</AdminNotice> : null}

      {showOfferings ? <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-extrabold tracking-tight text-slate-900">{offeringTypeLabel}</h2>
            <button className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800" onClick={() => { setIsCreatingOffering(true); setActiveOfferingId(undefined); }} type="button">
              Thêm mới
            </button>
          </div>
          <div className="grid gap-2">
            {offerings.map((offering) => (
              <button className={`rounded-xl px-3 py-3 text-left text-sm transition ${offering.id === activeOfferingId && !isCreatingOffering ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50"}`} key={offering.id} onClick={() => { setActiveOfferingId(offering.id); setIsCreatingOffering(false); }} type="button">
                <span className="block font-bold">{offering.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{offering.type} · {offering.status}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {isCreatingOffering || activeOffering ? (
            <OfferingEditor
              key={activeOffering?.id ?? "new"}
              offering={activeOffering}
              offeringType={offeringType}
              offeringTypeLabel={offeringTypeLabel}
              onSaved={(offering, created) => {
                setOfferings((current) => created ? [...current, offering] : current.map((item) => item.id === offering.id ? offering : item));
                setActiveOfferingId(offering.id);
                setIsCreatingOffering(false);
                notify({ kind: "success", message: created ? "Đã tạo nội dung catalog ở trạng thái đã chọn." : "Đã lưu nội dung catalog và tạo phiên bản mới." });
              }}
              onError={(message) => notify({ kind: "error", message })}
            />
          ) : <p className="text-slate-600">Chọn một nội dung catalog để chỉnh sửa.</p>}
        </div>
      </section> : null}

    </div>
  );
}

export function OfferingEditor({ offering, offeringType, offeringTypeLabel, onSaved, onError, onDirtyChange }: {
  offering: AdminOffering | undefined;
  offeringType?: PublicOfferingType;
  offeringTypeLabel: string;
  onSaved: (offering: AdminOffering, created: boolean) => void;
  onError: (message: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}) {
  const [form, setForm] = useState(() => offeringToForm(offering, offeringType));
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const { isDirty, markSaved } = useUnsavedChanges(form);
  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  function update<Field extends keyof typeof form>(field: Field, value: (typeof form)[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const payload = offeringFormToInput(form);
      const typeGuard = offeringType ? `?type=${offeringType}` : "";
      const result = await requestJson(offering ? `/api/admin/offerings/${offering.id}${typeGuard}` : `/api/admin/offerings${typeGuard}`, offering ? "PATCH" : "POST", payload) as { offering: AdminOffering };
      markSaved();
      onSaved(result.offering, !offering);
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : "Không thể lưu nội dung catalog.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <AdminEditorTabs activeId={activeTab} onChange={setActiveTab} tabs={[{ id: "basic", label: "Thông tin" }, { id: "content", label: "Nội dung" }, { id: "publishing", label: "Xuất bản & SEO" }, ...(offering ? [{ id: "history", label: "Lịch sử" }] : [])]} />
      {activeTab === "basic" ? <div className="grid gap-5"><EditorSection title="Thông tin cơ bản"><div className="grid gap-4 sm:grid-cols-2">{offeringType ? <label className={labelClassName}>Nhóm nội dung<input className={inputClassName} readOnly value={offeringTypeLabel} /></label> : <label className={labelClassName}>Nhóm nội dung<select className={inputClassName} onChange={(event) => update("type", event.target.value as typeof form.type)} value={form.type}><option value="software">Phần mềm</option><option value="solution">Giải pháp</option><option value="service">Dịch vụ</option></select></label>}<label className={labelClassName}>Tiêu đề<input className={inputClassName} onChange={(event) => update("title", event.target.value)} required value={form.title} /></label><label className={labelClassName}>Slug<input className={inputClassName} onChange={(event) => update("slug", event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} /></label></div></EditorSection><EditorSection description="Ảnh đại diện hiển thị trong các danh sách và trang chi tiết." title="Media"><MediaPicker value={form.coverMediaId} onChange={value => update("coverMediaId", value)} /></EditorSection></div> : null}
      {activeTab === "content" ? <div className="grid gap-5"><EditorSection title="Nội dung"><label className={labelClassName}>Tóm tắt<textarea className={inputClassName} onChange={(event) => update("summary", event.target.value)} rows={3} value={form.summary} /></label><label className={labelClassName}>Mô tả chi tiết<textarea className={inputClassName} onChange={(event) => update("description", event.target.value)} required rows={5} value={form.description} /></label></EditorSection><EditorSection description="Chỉ thêm các thông tin thực sự xuất hiện với loại nội dung này." title={`Thông tin ${offeringTypeLabel.toLocaleLowerCase("vi")}`}><OfferingItemsEditor items={form.items} onChange={items => update("items", items)} /><div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Tags, mỗi dòng một mục<textarea className={inputClassName} onChange={(event) => update("tags", event.target.value)} rows={4} value={form.tags} /></label><label className={labelClassName}>Chỉ số, mỗi dòng một mục<textarea className={inputClassName} onChange={(event) => update("metrics", event.target.value)} rows={4} value={form.metrics} /></label><label className={labelClassName}>Tính năng, mỗi dòng một mục<textarea className={inputClassName} onChange={(event) => update("features", event.target.value)} rows={5} value={form.features} /></label><label className={labelClassName}>Lợi ích, mỗi dòng một mục<textarea className={inputClassName} onChange={(event) => update("benefits", event.target.value)} rows={5} value={form.benefits} /></label></div><label className={labelClassName}>FAQ, mỗi dòng theo mẫu “Câu hỏi | Trả lời”<textarea className={inputClassName} onChange={(event) => update("faq", event.target.value)} rows={5} value={form.faq} /></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Phù hợp với<input className={inputClassName} onChange={(event) => update("bestFor", event.target.value)} value={form.bestFor} /></label><label className={labelClassName}>Giá trị chính<input className={inputClassName} onChange={(event) => update("keyValue", event.target.value)} value={form.keyValue} /></label><label className={labelClassName}>Danh mục<input className={inputClassName} onChange={(event) => update("category", event.target.value)} value={form.category} /></label><label className={labelClassName}>Biểu tượng<input className={inputClassName} onChange={(event) => update("icon", event.target.value)} value={form.icon} /></label></div></EditorSection></div> : null}
      {activeTab === "publishing" ? <div className="grid gap-5">
        <EditorSection title="SEO"><div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Tiêu đề SEO<input className={inputClassName} onChange={(event) => update("seoTitle", event.target.value)} value={form.seoTitle} /></label><label className={labelClassName}>Mô tả SEO<input className={inputClassName} onChange={(event) => update("seoDescription", event.target.value)} value={form.seoDescription} /></label><label className={labelClassName}>URL chuẩn<input className={inputClassName} onChange={(event) => update("canonicalUrl", event.target.value)} type="url" value={form.canonicalUrl} /></label></div></EditorSection>
        <EditorSection title="Xuất bản"><div className="grid gap-4 sm:grid-cols-2"><label className={labelClassName}>Trạng thái<select className={inputClassName} onChange={(event) => update("status", event.target.value as typeof form.status)} value={form.status}><option value="draft">Bản nháp</option><option value="review">Chờ duyệt</option><option value="scheduled">Hẹn giờ</option><option value="published">Xuất bản</option><option value="archived">Lưu trữ</option></select></label>{form.status === "scheduled" ? <label className={labelClassName}>Thời điểm hẹn giờ<input className={inputClassName} onChange={(event) => update("scheduledAt", event.target.value)} required type="datetime-local" value={form.scheduledAt} /></label> : null}<label className={labelClassName}>Thứ tự<input className={inputClassName} min="0" onChange={(event) => update("sortOrder", Number(event.target.value))} type="number" value={form.sortOrder} /></label><label className="mt-6 flex items-center gap-3 text-sm font-bold text-slate-700"><input checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} type="checkbox" />Nội dung nổi bật</label></div></EditorSection>
      </div> : null}
      {activeTab === "history" && offering ? <EditorSection title="Lịch sử"><RevisionHistory target="offerings" id={offering.id} /></EditorSection> : null}
      <AdminEditorActions>{isDirty ? <p className="mb-0 text-sm text-amber-700" role="status">Có thay đổi chưa lưu.</p> : null}<button className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-blue-800 disabled:cursor-wait disabled:bg-slate-400" disabled={isSaving} type="submit">{isSaving ? "Đang lưu..." : offering ? "Lưu thay đổi" : "Tạo nội dung catalog"}</button></AdminEditorActions>
    </form>
  );
}

function offeringToForm(offering: AdminOffering | undefined, offeringType?: PublicOfferingType) {
  return {
    coverMediaId: offering?.coverMediaId ?? null,
    type: offering?.type ?? offeringType ?? "software",
    title: offering?.title ?? "",
    slug: offering?.slug ?? "",
    summary: offering?.summary ?? "",
    description: offering?.content.description ?? "",
    tags: offering?.content.tags.join("\n") ?? "",
    bestFor: offering?.content.bestFor ?? "",
    keyValue: offering?.content.keyValue ?? "",
    metrics: offering?.content.metrics.join("\n") ?? "",
    features: offering?.content.features.join("\n") ?? "",
    benefits: offering?.content.benefits.join("\n") ?? "",
    faq: offering?.content.faq.map(([question, answer]) => `${question} | ${answer}`).join("\n") ?? "",
    items: offering?.content.items ?? [],
    category: offering?.content.category ?? "",
    icon: offering?.icon ?? "",
    status: offering?.status ?? "draft",
    scheduledAt: dateTimeInputValue(offering?.scheduledAt),
    sortOrder: offering?.sortOrder ?? 0,
    isFeatured: offering?.isFeatured ?? false,
    seoTitle: offering?.seoTitle ?? "",
    seoDescription: offering?.seoDescription ?? "",
    canonicalUrl: offering?.canonicalUrl ?? "",
  };
}

function offeringFormToInput(form: ReturnType<typeof offeringToForm>): AdminOfferingInput {
  return {
    coverMediaId: form.coverMediaId,
    type: form.type,
    title: form.title.trim(),
    slug: form.slug.trim(),
    summary: nullableText(form.summary),
    content: {
      description: form.description.trim(),
      tags: lines(form.tags),
      bestFor: nullableText(form.bestFor),
      keyValue: nullableText(form.keyValue),
      metrics: lines(form.metrics),
      features: lines(form.features),
      benefits: lines(form.benefits),
      faq: faqLines(form.faq),
      items: form.items,
      category: nullableText(form.category),
    },
    icon: nullableText(form.icon),
    status: form.status,
    scheduledAt: dateTimeOrNull(form.scheduledAt),
    sortOrder: form.sortOrder,
    isFeatured: form.isFeatured,
    seoTitle: nullableText(form.seoTitle),
    seoDescription: nullableText(form.seoDescription),
    canonicalUrl: nullableText(form.canonicalUrl),
  };
}

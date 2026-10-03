"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import type {
  PartnerInput,
  TestimonialInput,
} from "@iorder/core/server/supporting/supporting.contract";

import { MediaPicker } from "./media-picker";
import { useAdminToast } from "./ui/admin-feedback";

type Partner = PartnerInput & {
  id: string;
  logo: { url: string; altText: string | null } | null;
};

type Testimonial = TestimonialInput & {
  id: string;
  avatar: { url: string; altText: string | null } | null;
};

type SupportingKind = "partners" | "testimonials";
type VisibilityFilter = "all" | "enabled" | "disabled";

const blankPartner: PartnerInput = {
  logoMediaId: null,
  kind: "partner",
  name: "",
  description: null,
  websiteUrl: null,
  sortOrder: 0,
  isEnabled: true,
};

const blankTestimonial: TestimonialInput = {
  avatarMediaId: null,
  authorName: "",
  authorRole: null,
  company: null,
  quote: "",
  rating: null,
  sortOrder: 0,
  isEnabled: true,
};

function partnerValues(partner: Partner): PartnerInput {
  return {
    logoMediaId: partner.logoMediaId,
    kind: partner.kind,
    name: partner.name,
    description: partner.description,
    websiteUrl: partner.websiteUrl,
    sortOrder: partner.sortOrder,
    isEnabled: partner.isEnabled,
  };
}

function testimonialValues(testimonial: Testimonial): TestimonialInput {
  return {
    avatarMediaId: testimonial.avatarMediaId,
    authorName: testimonial.authorName,
    authorRole: testimonial.authorRole,
    company: testimonial.company,
    quote: testimonial.quote,
    rating: testimonial.rating,
    sortOrder: testimonial.sortOrder,
    isEnabled: testimonial.isEnabled,
  };
}

function equalValues(
  first: PartnerInput | TestimonialInput | null,
  second: PartnerInput | TestimonialInput | null,
) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function SupportingManager({
  partners,
  testimonials,
}: {
  partners: Partner[];
  testimonials: Testimonial[];
}) {
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const [kind, setKind] = useState<SupportingKind>("partners");
  const [filter, setFilter] = useState<VisibilityFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState<PartnerInput | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<TestimonialInput | null>(null);
  const [initialValues, setInitialValues] = useState<PartnerInput | TestimonialInput | null>(null);
  const [busy, setBusy] = useState(false);

  const form = kind === "partners" ? partnerForm : testimonialForm;
  const dirty = !equalValues(form, initialValues);
  const visiblePartners = useMemo(
    () => partners.filter((item) => matchesVisibility(item.isEnabled, filter)),
    [filter, partners],
  );
  const visibleTestimonials = useMemo(
    () => testimonials.filter((item) => matchesVisibility(item.isEnabled, filter)),
    [filter, testimonials],
  );
  const editorOpen = form !== null;

  useEffect(() => {
    if (!editorOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editorOpen]);

  function allowSelectionChange() {
    if (!dirty) return true;
    showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc chọn “Bỏ thay đổi” trước khi chuyển mục.", "warning");
    return false;
  }

  function selectPartner(row?: Partner) {
    if (!allowSelectionChange()) return;
    const values = row ? partnerValues(row) : { ...blankPartner };
    setKind("partners");
    setActiveId(row?.id ?? null);
    setPartnerForm(values);
    setTestimonialForm(null);
    setInitialValues(values);
  }

  function selectTestimonial(row?: Testimonial) {
    if (!allowSelectionChange()) return;
    const values = row ? testimonialValues(row) : { ...blankTestimonial };
    setKind("testimonials");
    setActiveId(row?.id ?? null);
    setTestimonialForm(values);
    setPartnerForm(null);
    setInitialValues(values);
  }

  function changeKind(nextKind: SupportingKind) {
    if (nextKind === kind || !allowSelectionChange()) return;
    setKind(nextKind);
    setActiveId(null);
    setPartnerForm(null);
    setTestimonialForm(null);
    setInitialValues(null);
  }

  function discardChanges() {
    if (!initialValues) return;
    if (kind === "partners") setPartnerForm(initialValues as PartnerInput);
    else setTestimonialForm(initialValues as TestimonialInput);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  function closeEditor() {
    if (!allowSelectionChange()) return;
    setActiveId(null);
    setPartnerForm(null);
    setTestimonialForm(null);
    setInitialValues(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin/supporting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id: activeId, values: form }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message || "Không thể lưu nội dung hỗ trợ.");
      }

      const wasCreating = !activeId;
      setActiveId(payload.id);
      setInitialValues(form);
      showToast(
        wasCreating
          ? kind === "partners"
            ? "Đã thêm đối tác."
            : "Đã thêm đánh giá."
          : "Đã lưu thay đổi.",
        "success",
      );
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể kết nối máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Nội dung thương hiệu</p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950">Đối tác và đánh giá</h2>
              <p className="mt-1 text-sm text-slate-600">Quản lý danh sách tại đây; form tạo và chỉnh sửa mở trong panel bên phải.</p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800"
              onClick={() => (kind === "partners" ? selectPartner() : selectTestimonial())}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              {kind === "partners" ? "Thêm đối tác" : "Thêm đánh giá"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div aria-label="Loại nội dung" className="flex flex-wrap gap-2" role="tablist">
              <TypeTab
                active={kind === "partners"}
                label={`Đối tác (${partners.length})`}
                onClick={() => changeKind("partners")}
              />
              <TypeTab
                active={kind === "testimonials"}
                label={`Đánh giá (${testimonials.length})`}
                onClick={() => changeKind("testimonials")}
              />
            </div>

            <div aria-label="Lọc trạng thái" className="flex flex-wrap gap-4">
              {(["all", "enabled", "disabled"] as const).map((value) => (
                <button
                  className={filter === value ? "text-sm font-bold text-blue-700" : "text-sm text-slate-500 hover:text-slate-800"}
                  key={value}
                  onClick={() => setFilter(value)}
                  type="button"
                >
                  {visibilityLabel[value]}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {kind === "partners"
            ? visiblePartners.map((item) => (
                <PartnerListItem
                  active={activeId === item.id}
                  item={item}
                  key={item.id}
                  onClick={() => selectPartner(item)}
                />
              ))
            : visibleTestimonials.map((item) => (
                <TestimonialListItem
                  active={activeId === item.id}
                  item={item}
                  key={item.id}
                  onClick={() => selectTestimonial(item)}
                />
              ))}
          {(kind === "partners" ? visiblePartners.length : visibleTestimonials.length) === 0 ? (
            <div className="col-span-full grid min-h-44 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <div>
                <strong className="text-sm text-slate-950">Chưa có {kind === "partners" ? "đối tác" : "đánh giá"} phù hợp</strong>
                <p className="mt-1 text-sm text-slate-600">Đổi bộ lọc hoặc tạo nội dung mới bằng nút phía trên.</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {form ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/25 backdrop-blur-[1px]">
          <section
            aria-labelledby="supporting-editor-title"
            aria-modal="true"
            className="absolute inset-y-0 right-0 w-full max-w-2xl border-l border-slate-200 bg-white shadow-2xl"
            role="dialog"
          >
            <form className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]" onSubmit={save}>
              <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{activeId ? "Chỉnh sửa" : "Tạo mới"}</p>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-950" id="supporting-editor-title">{kind === "partners" ? "Đối tác" : "Đánh giá khách hàng"}</h2>
                  <p className={dirty ? "mt-1 text-sm font-semibold text-amber-700" : "mt-1 text-sm text-slate-600"}>
                    {dirty ? "Có thay đổi chưa lưu." : "Mọi thay đổi đã được lưu."}
                  </p>
                </div>
                <button
                  aria-label="Đóng panel chỉnh sửa"
                  autoFocus
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                  onClick={closeEditor}
                  type="button"
                >
                  <X aria-hidden="true" size={19} />
                </button>
              </header>

              <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
                {kind === "partners" && partnerForm ? <PartnerForm form={partnerForm} onChange={setPartnerForm} /> : null}
                {kind === "testimonials" && testimonialForm ? <TestimonialForm form={testimonialForm} onChange={setTestimonialForm} /> : null}
              </div>

              <footer className="admin-editor-actions flex-wrap justify-between bg-white px-5 sm:px-6">
                <p className="text-xs text-slate-600">Ảnh được chọn từ thư viện media CMS.</p>
                <div className="flex gap-2">
                  {dirty ? <button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={discardChanges} type="button">Bỏ thay đổi</button> : null}
                  <button className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy || !dirty}>
                    {busy ? "Đang lưu…" : "Lưu thay đổi"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

const visibilityLabel = {
  all: "Tất cả",
  enabled: "Đang hiển thị",
  disabled: "Đang ẩn",
} satisfies Record<VisibilityFilter, string>;

function matchesVisibility(enabled: boolean, filter: VisibilityFilter) {
  return filter === "all" || (filter === "enabled" ? enabled : !enabled);
}

function TypeTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-selected={active}
      className={active ? "rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-800" : "rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200"}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

function PartnerListItem({ active, item, onClick }: { active: boolean; item: Partner; onClick: () => void }) {
  return (
    <button className={listItemClass(active)} onClick={onClick} type="button">
      <MediaThumbnail alt={item.logo?.altText || item.name} url={item.logo?.url} />
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <strong className="truncate text-sm text-slate-950">{item.name}</strong>
          <StatusBadge enabled={item.isEnabled} />
        </span>
        <span className="mt-1 block text-sm text-slate-600">{item.kind === "partner" ? "Đối tác" : "Khách hàng"} · Thứ tự {item.sortOrder}</span>
      </span>
    </button>
  );
}

function TestimonialListItem({ active, item, onClick }: { active: boolean; item: Testimonial; onClick: () => void }) {
  return (
    <button className={listItemClass(active)} onClick={onClick} type="button">
      <MediaThumbnail alt={item.avatar?.altText || item.authorName} url={item.avatar?.url} />
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <strong className="truncate text-sm text-slate-950">{item.authorName}</strong>
          <StatusBadge enabled={item.isEnabled} />
        </span>
        <span className="mt-1 block truncate text-sm text-slate-600">{item.company || item.authorRole || "Chưa có doanh nghiệp/chức danh"}</span>
      </span>
    </button>
  );
}

function listItemClass(active: boolean) {
  return active
    ? "grid w-full grid-cols-[3rem_1fr] gap-3 rounded-xl border border-blue-300 bg-blue-50 p-3 text-left"
    : "grid w-full grid-cols-[3rem_1fr] gap-3 rounded-xl border border-transparent p-3 text-left hover:bg-slate-50";
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return <span className={enabled ? "shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800" : "shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600"}>{enabled ? "Hiển thị" : "Đang ẩn"}</span>;
}

function MediaThumbnail({ alt, url }: { alt: string; url: string | undefined }) {
  return (
    <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-slate-100 text-sm font-bold text-slate-500">
      {url ? <Image alt={alt} className="object-cover" fill sizes="48px" src={url} unoptimized /> : alt.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PartnerForm({ form, onChange }: { form: PartnerInput; onChange: (next: PartnerInput) => void }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Loại">
          <select value={form.kind} onChange={(event) => onChange({ ...form, kind: event.target.value as PartnerInput["kind"] })}>
            <option value="partner">Đối tác</option>
            <option value="customer">Khách hàng</option>
          </select>
        </Field>
        <Field label="Thứ tự hiển thị">
          <input min={0} onChange={(event) => onChange({ ...form, sortOrder: Math.max(0, Number(event.target.value) || 0) })} type="number" value={form.sortOrder} />
        </Field>
      </div>
      <Field label="Tên đối tác"><input onChange={(event) => onChange({ ...form, name: event.target.value })} required value={form.name} /></Field>
      <Field label="Website"><input onChange={(event) => onChange({ ...form, websiteUrl: event.target.value.trim() || null })} placeholder="https://…" type="url" value={form.websiteUrl || ""} /></Field>
      <Field label="Mô tả"><textarea onChange={(event) => onChange({ ...form, description: event.target.value || null })} rows={4} value={form.description || ""} /></Field>
      <Toggle checked={form.isEnabled} label="Hiển thị trên website" onChange={(isEnabled) => onChange({ ...form, isEnabled })} />
      <Field label="Logo"><MediaPicker onChange={(logoMediaId) => onChange({ ...form, logoMediaId })} value={form.logoMediaId} /></Field>
    </div>
  );
}

function TestimonialForm({ form, onChange }: { form: TestimonialInput; onChange: (next: TestimonialInput) => void }) {
  return (
    <div className="grid gap-5">
      <Field label="Họ tên khách hàng"><input onChange={(event) => onChange({ ...form, authorName: event.target.value })} required value={form.authorName} /></Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Chức danh"><input onChange={(event) => onChange({ ...form, authorRole: event.target.value || null })} value={form.authorRole || ""} /></Field>
        <Field label="Doanh nghiệp"><input onChange={(event) => onChange({ ...form, company: event.target.value || null })} value={form.company || ""} /></Field>
      </div>
      <Field label="Nhận xét"><textarea onChange={(event) => onChange({ ...form, quote: event.target.value })} required rows={5} value={form.quote} /></Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Đánh giá">
          <select onChange={(event) => onChange({ ...form, rating: event.target.value ? Number(event.target.value) : null })} value={form.rating || ""}>
            <option value="">Không hiển thị</option>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}/5</option>)}
          </select>
        </Field>
        <Field label="Thứ tự hiển thị"><input min={0} onChange={(event) => onChange({ ...form, sortOrder: Math.max(0, Number(event.target.value) || 0) })} type="number" value={form.sortOrder} /></Field>
      </div>
      <Toggle checked={form.isEnabled} label="Hiển thị trên website" onChange={(isEnabled) => onChange({ ...form, isEnabled })} />
      <Field label="Ảnh đại diện"><MediaPicker onChange={(avatarMediaId) => onChange({ ...form, avatarMediaId })} value={form.avatarMediaId} /></Field>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      <span>{label}</span>
      <span className="[&_input]:block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-300 [&_input]:px-3 [&_input]:py-2 [&_select]:block [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2 [&_textarea]:block [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:px-3 [&_textarea]:py-2">
        {children}
      </span>
    </label>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition, type Dispatch, type SetStateAction, type FormEvent, type ReactNode } from "react";

import type {
  PartnerInput,
  PartnerListQuery,
  TestimonialInput,
} from "@iorder/core/server/supporting/supporting.contract";
import { partnerInputSchema, testimonialInputSchema, supportingSaveResponseSchema } from "@iorder/core/server/supporting/supporting.contract";

import { MediaPicker } from "./media-picker";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { useAdminToast } from "./ui/admin-feedback";
import { AdminFilterBar } from "./ui/admin-filter-bar";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { pageSizeOptions } from "./ui/page-size-options";
import { requestNavigationFocus } from "./ui/navigation-focus";
import { useNavigationGuard } from "./ui/use-navigation-guard";

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
type PartnerKindFilter = "all" | PartnerInput["kind"];

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
  initialKind,
  initialQuery,
  pagination,
}: {
  partners: Partner[];
  testimonials: Testimonial[];
  initialKind: SupportingKind;
  initialQuery: PartnerListQuery;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}) {
  const router = useRouter();
  const { show: showToast } = useAdminToast();
  const [kind, setKind] = useState<SupportingKind>(initialKind);
  const filter = initialQuery.visibility;
  const partnerKindFilter = initialQuery.partnerKind;
  const [search, setSearch] = useState(initialQuery.query);
  const [loading, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState<PartnerInput | null>(null);
  const [testimonialForm, setTestimonialForm] = useState<TestimonialInput | null>(null);
  const [initialValues, setInitialValues] = useState<PartnerInput | TestimonialInput | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const uploadPending = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const handleUploadingChange = useCallback((pending: boolean) => {
    uploadPending.current = pending;
    setIsUploading(pending);
  }, []);
  const processing = busy || isUploading;

  const form = kind === "partners" ? partnerForm : testimonialForm;
  const dirty = !equalValues(form, initialValues);
  useNavigationGuard(dirty || processing, processing ? () => showToast("Đang xử lý nội dung. Vui lòng chờ trước khi rời trang.", "info") : undefined);
  const visiblePartners = partners;
  const visibleTestimonials = testimonials;
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
    if (mutationPending.current || uploadPending.current || loading) {
      showToast("Đang xử lý nội dung. Vui lòng chờ trước khi đóng hoặc chuyển mục.", "info");
      return false;
    }
    if (!dirty) return true;
    showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc chọn “Bỏ thay đổi” trước khi chuyển mục.", "warning");
    return false;
  }

  function selectPartner(row?: Partner, defaultKind: PartnerInput["kind"] = "partner") {
    if (!allowSelectionChange()) return;
    const values = row ? partnerValues(row) : { ...blankPartner, kind: defaultKind };
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
    navigate({ page: 1, partnerKind: "all" }, nextKind);
  }

  function navigate(patch: Partial<PartnerListQuery>, nextKind = kind) {
    if (!allowSelectionChange()) return;
    const next = { ...initialQuery, ...patch };
    const params = new URLSearchParams({ kind: nextKind, page: String(next.page), pageSize: String(next.pageSize), query: next.query, visibility: next.visibility });
    if (nextKind === "partners") params.set("partnerKind", next.partnerKind);
    if (nextKind !== kind) requestNavigationFocus(`/admin/doi-tac?${params}`);
    startTransition(() => router.push(`/admin/doi-tac?${params}`, { scroll: false }));
  }

  function discardChanges() {
    if (mutationPending.current || uploadPending.current || !initialValues) return;
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

  function createCurrentKind() {
    if (kind === "testimonials") return selectTestimonial();
    return selectPartner(undefined, partnerKindFilter === "customer" ? "customer" : "partner");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !dirty || mutationPending.current || uploadPending.current) return;
    const submitted = (kind === "partners" ? partnerInputSchema : testimonialInputSchema).safeParse(form);
    if (!submitted.success) {
      showToast("Kiểm tra tên, nội dung, website, ảnh và thứ tự hiển thị trước khi lưu.", "warning");
      return;
    }

    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/supporting", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id: activeId, values: submitted.data }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message || "Không thể lưu nội dung hỗ trợ.");
      }
      const saved = supportingSaveResponseSchema.safeParse(payload);
      if (!saved.success || (activeId && saved.data.id !== activeId)) throw new Error("Phản hồi lưu nội dung không hợp lệ. Hãy kiểm tra danh sách trước khi thử lại.");

      const wasCreating = !activeId;
      setActiveId(saved.data.id);
      if (kind === "partners") setPartnerForm(submitted.data as PartnerInput);
      else setTestimonialForm(submitted.data as TestimonialInput);
      setInitialValues(submitted.data);
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
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function removeCurrent() {
    if (mutationPending.current || uploadPending.current) return;
    if (!activeId || !form || dirty) {
      if (dirty) showToast("Hãy lưu hoặc bỏ thay đổi trước khi xóa.", "warning");
      return;
    }
    if (form.isEnabled) {
      showToast("Hãy ẩn nội dung trước khi xóa khỏi CMS.", "warning");
      return;
    }
    const label = kind === "partners" ? "nội dung đối tác/khách hàng" : "đánh giá";
    if (!window.confirm(`Xóa ${label} này khỏi CMS? Thao tác không thể hoàn tác.`)) return;

    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/supporting?kind=${kind}&id=${activeId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || `Không thể xóa ${label}.`);
      if (payload.deletedId !== activeId) throw new Error("Phản hồi xóa nội dung không hợp lệ. Hãy tải lại danh sách để kiểm tra.");
      setActiveId(null);
      setPartnerForm(null);
      setTestimonialForm(null);
      setInitialValues(null);
      showToast(`Đã xóa ${label} khỏi CMS.`, "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  return (
    <AdminListPage>
      <AdminCard className="overflow-hidden">
        <div className="p-4 sm:p-5">
          <AdminListHeader actions={<AdminButton leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={createCurrentKind}>{kind === "testimonials" ? "Thêm đánh giá" : partnerKindFilter === "customer" ? "Thêm khách hàng" : "Thêm đối tác"}</AdminButton>} description="Quản lý danh sách tại đây; form tạo và chỉnh sửa mở trong panel bên phải." eyebrow="Nội dung thương hiệu" title="Đối tác và đánh giá" />
          <AdminFilterBar onSubmit={(event) => { event.preventDefault(); navigate({ page: 1, query: search.trim() }); }}>
            <AdminFilterTabs<SupportingKind> restoreNavigationFocus ariaLabel="Loại nội dung" disabled={processing || loading} items={[{ label: "Đối tác & khách hàng", value: "partners" }, { label: "Đánh giá", value: "testimonials" }]} value={kind} onValueChange={changeKind} />

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {kind === "partners" ? <div aria-label="Nhóm đối tác" className="flex flex-wrap gap-4">
                {(["all", "partner", "customer"] as const).map((value) => (
                  <button
                    className={partnerKindFilter === value ? "text-sm font-bold text-blue-700" : "text-sm text-[var(--cms-muted)] hover:text-[var(--cms-text)]"}
                    key={value}
                    disabled={processing || loading}
                    onClick={() => navigate({ page: 1, partnerKind: value })}
                    type="button"
                  >
                    {partnerKindFilterLabel[value]}
                  </button>
                ))}
              </div> : null}
              <div aria-label="Lọc trạng thái" className="flex flex-wrap gap-4">
              {(["all", "enabled", "disabled"] as const).map((value) => (
                <button
                  className={filter === value ? "text-sm font-bold text-blue-700" : "text-sm text-[var(--cms-muted)] hover:text-[var(--cms-text)]"}
                  key={value}
                  disabled={processing || loading}
                  onClick={() => navigate({ page: 1, visibility: value })}
                  type="button"
                >
                  {visibilityLabel[value]}
                </button>
              ))}
              </div>
            </div>
            <label className="grid gap-1 text-sm text-[var(--cms-muted)]">Tìm kiếm
              <input className="rounded-lg border border-[var(--cms-border)] px-3 py-2" disabled={processing || loading} value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên, doanh nghiệp hoặc nội dung…" />
            </label>
            <AdminButton type="submit" disabled={processing || loading}>Tìm kiếm</AdminButton>
          </AdminFilterBar>
          <p aria-live="polite" className="mt-3 text-sm text-[var(--cms-muted)]">{loading ? "Đang tải danh sách…" : `${pagination.total} kết quả · Trang ${pagination.page}/${pagination.totalPages}`}</p>
        </div>

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
            <div className="col-span-full grid min-h-44 place-items-center rounded-xl border border-dashed border-[var(--cms-border)] bg-[var(--cms-hover)] p-6 text-center">
              <div>
                <strong className="text-sm text-[var(--cms-text)]">Chưa có {kind === "testimonials" ? "đánh giá" : partnerKindFilter === "customer" ? "khách hàng" : partnerKindFilter === "partner" ? "đối tác" : "nội dung"} phù hợp</strong>
                <p className="mt-1 text-sm text-[var(--cms-muted)]">Đổi bộ lọc hoặc tạo nội dung mới bằng nút phía trên.</p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--cms-border)] p-4">
          <label className="flex items-center gap-2 text-sm">Số mục mỗi trang
            <select disabled={processing || loading} value={pagination.pageSize} onChange={event => navigate({ page: 1, pageSize: Number(event.target.value) })}>
              {pageSizeOptions(pagination.pageSize).map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <AdminButton variant="secondary" disabled={processing || loading || pagination.page <= 1} onClick={() => navigate({ page: pagination.page - 1 })}>Trang trước</AdminButton>
            <AdminButton variant="secondary" disabled={processing || loading || pagination.page >= pagination.totalPages} onClick={() => navigate({ page: pagination.page + 1 })}>Trang sau</AdminButton>
          </div>
        </div>
      </AdminCard>

      {form ? (
        <AdminSidePanel
          isOpen={editorOpen}
          label={kind === "partners" ? "Biên tập đối tác" : "Biên tập đánh giá khách hàng"}
          onClose={closeEditor}
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--cms-muted)]">Ảnh được chọn từ thư viện media CMS.</p>
              <div className="flex flex-wrap justify-end gap-2">
                {activeId ? <AdminButton variant="danger" disabled={processing || dirty || form.isEnabled} onClick={removeCurrent} title={form.isEnabled ? "Ẩn nội dung trước khi xóa" : "Xóa khỏi CMS"} type="button">Xóa</AdminButton> : null}
                {dirty ? <AdminButton variant="secondary" disabled={processing} onClick={discardChanges} type="button">Bỏ thay đổi</AdminButton> : null}
                <AdminButton disabled={processing || !dirty} form="supporting-editor" type="submit">{isUploading ? "Đang tải ảnh…" : busy ? "Đang lưu…" : "Lưu thay đổi"}</AdminButton>
              </div>
            </div>
          }
        >
            <form id="supporting-editor" onSubmit={save}>
              <header className="border-b border-[var(--cms-border)] py-4 pl-5 pr-14 sm:pl-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{activeId ? "Chỉnh sửa" : "Tạo mới"}</p>
                  <h2 className="mt-1 text-xl font-extrabold text-[var(--cms-text)]" id="supporting-editor-title">{kind === "partners" ? "Đối tác" : "Đánh giá khách hàng"}</h2>
                  <p className={dirty ? "mt-1 text-sm font-semibold text-amber-700" : "mt-1 text-sm text-[var(--cms-muted)]"}>
                    {processing ? "Đang xử lý nội dung…" : dirty ? "Có thay đổi chưa lưu." : activeId ? "Không có thay đổi chưa lưu." : "Nhập thông tin để tạo nội dung mới."}
                  </p>
                </div>
              </header>

              <div className="px-5 py-5 sm:px-6">
                <fieldset className="min-w-0 border-0 p-0 disabled:opacity-70" disabled={processing}>
                {kind === "partners" && partnerForm ? <PartnerForm form={partnerForm} onChange={setPartnerForm} onUploadingChange={handleUploadingChange} /> : null}
                {kind === "testimonials" && testimonialForm ? <TestimonialForm form={testimonialForm} onChange={setTestimonialForm} onUploadingChange={handleUploadingChange} /> : null}
                </fieldset>
              </div>

            </form>
        </AdminSidePanel>
      ) : null}
    </AdminListPage>
  );
}

const visibilityLabel = {
  all: "Tất cả",
  enabled: "Đang hiển thị",
  disabled: "Đang ẩn",
} satisfies Record<VisibilityFilter, string>;

const partnerKindFilterLabel = {
  all: "Tất cả",
  partner: "Đối tác",
  customer: "Khách hàng",
} satisfies Record<PartnerKindFilter, string>;

function PartnerListItem({ active, item, onClick }: { active: boolean; item: Partner; onClick: () => void }) {
  return (
    <button className={listItemClass(active)} onClick={onClick} type="button">
      <MediaThumbnail alt={item.logo?.altText || item.name} url={item.logo?.url} />
      <span className="min-w-0">
        <span className="flex items-center justify-between gap-2">
          <strong className="truncate text-sm text-[var(--cms-text)]">{item.name}</strong>
          <StatusBadge enabled={item.isEnabled} />
        </span>
        <span className="mt-1 block text-sm text-[var(--cms-muted)]">{item.kind === "partner" ? "Đối tác" : "Khách hàng"} · Thứ tự {item.sortOrder}</span>
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
          <strong className="truncate text-sm text-[var(--cms-text)]">{item.authorName}</strong>
          <StatusBadge enabled={item.isEnabled} />
        </span>
        <span className="mt-1 block truncate text-sm text-[var(--cms-muted)]">{item.company || item.authorRole || "Chưa có doanh nghiệp/chức danh"}</span>
      </span>
    </button>
  );
}

function listItemClass(active: boolean) {
  return active
    ? "grid w-full grid-cols-[3rem_1fr] gap-3 rounded-xl border border-blue-300 bg-blue-50 p-3 text-left"
    : "grid w-full grid-cols-[3rem_1fr] gap-3 rounded-xl border border-transparent p-3 text-left hover:bg-[var(--cms-hover)]";
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return <span className={enabled ? "shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800" : "shrink-0 rounded-full bg-[var(--cms-hover)] px-2 py-0.5 text-xs font-bold text-[var(--cms-muted)]"}>{enabled ? "Hiển thị" : "Đang ẩn"}</span>;
}

function MediaThumbnail({ alt, url }: { alt: string; url: string | undefined }) {
  return (
    <span className="relative grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-[var(--cms-hover)] text-sm font-bold text-[var(--cms-muted)]">
      {url ? <Image alt={alt} className="object-cover" fill sizes="48px" src={url} unoptimized /> : alt.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PartnerForm({ form, onChange, onUploadingChange }: { form: PartnerInput; onChange: Dispatch<SetStateAction<PartnerInput | null>>; onUploadingChange: (pending: boolean) => void }) {
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
      <Field label="Website"><input onChange={(event) => onChange({ ...form, websiteUrl: event.target.value || null })} placeholder="https://…" type="url" value={form.websiteUrl || ""} /></Field>
      <Field label="Mô tả"><textarea onChange={(event) => onChange({ ...form, description: event.target.value || null })} rows={4} value={form.description || ""} /></Field>
      <Toggle checked={form.isEnabled} label="Hiển thị trên website" onChange={(isEnabled) => onChange({ ...form, isEnabled })} />
      <Field label="Logo"><MediaPicker onChange={(logoMediaId) => onChange((current) => current ? { ...current, logoMediaId } : current)} onUploadingChange={onUploadingChange} value={form.logoMediaId} /></Field>
    </div>
  );
}

function TestimonialForm({ form, onChange, onUploadingChange }: { form: TestimonialInput; onChange: Dispatch<SetStateAction<TestimonialInput | null>>; onUploadingChange: (pending: boolean) => void }) {
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
      <Field label="Ảnh đại diện"><MediaPicker onChange={(avatarMediaId) => onChange((current) => current ? { ...current, avatarMediaId } : current)} onUploadingChange={onUploadingChange} value={form.avatarMediaId} /></Field>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[var(--cms-text)]">
      <span>{label}</span>
      <span className="[&_input]:block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-[var(--cms-border)] [&_input]:px-3 [&_input]:py-2 [&_select]:block [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[var(--cms-border)] [&_select]:bg-[var(--cms-card)] [&_select]:px-3 [&_select]:py-2 [&_textarea]:block [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[var(--cms-border)] [&_textarea]:px-3 [&_textarea]:py-2">
        {children}
      </span>
    </label>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-lg bg-[var(--cms-hover)] p-3 text-sm font-bold text-[var(--cms-text)]">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

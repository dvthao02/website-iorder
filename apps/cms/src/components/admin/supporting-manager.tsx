"use client";

import { adminApiError } from "@/lib/admin-api";
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
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminFilterBar, type AdminFilterChip } from "./ui/admin-filter-bar";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { pageSizeOptions } from "./ui/page-size-options";
import { requestNavigationFocus } from "./ui/navigation-focus";
import { useNavigationGuard } from "./ui/use-navigation-guard";

type Partner = PartnerInput & {
  id: string;
  version: number;
  logo: { url: string; altText: string | null } | null;
};

type Testimonial = TestimonialInput & {
  id: string;
  version: number;
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
  const { confirm } = useAdminConfirm();
  const { show: showToast } = useAdminToast();
  const [kind, setKind] = useState<SupportingKind>(initialKind);
  const filter = initialQuery.visibility;
  const partnerKindFilter = initialQuery.partnerKind;
  const [search, setSearch] = useState(initialQuery.query);
  const chips: AdminFilterChip[] = [
    ...(initialQuery.query ? [{ key: "query", label: `Từ khóa: “${initialQuery.query}”`, onRemove: () => { setSearch(""); navigate({ page: 1, query: "" }); } }] : []),
    ...(kind === "partners" && partnerKindFilter !== "all" ? [{ key: "partnerKind", label: `Nhóm: ${partnerKindFilterLabel[partnerKindFilter]}`, onRemove: () => navigate({ page: 1, partnerKind: "all" }) }] : []),
    ...(filter !== "all" ? [{ key: "visibility", label: `Trạng thái: ${visibilityLabel[filter]}`, onRemove: () => navigate({ page: 1, visibility: "all" }) }] : []),
  ];
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

  // Version vừa lưu được nhớ cục bộ vì props chỉ cập nhật sau khi router.refresh() xong;
  // lấy giá trị lớn hơn để không gửi version cũ khi lưu liên tiếp hoặc ngay sau khi tạo mới.
  const [savedVersions, setSavedVersions] = useState<Record<string, number>>({});
  const propVersion = activeId ? (kind === "partners" ? partners : testimonials).find((item) => item.id === activeId)?.version : undefined;
  const localVersion = activeId ? savedVersions[activeId] : undefined;
  const activeVersion = propVersion === undefined ? localVersion : localVersion === undefined ? propVersion : Math.max(propVersion, localVersion);

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
        body: JSON.stringify({ kind, id: activeId, values: submitted.data, ...(activeVersion !== undefined ? { expectedVersion: activeVersion } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw adminApiError(payload, "Không thể lưu nội dung hỗ trợ.");
      }
      const saved = supportingSaveResponseSchema.safeParse(payload);
      if (!saved.success || (activeId && saved.data.id !== activeId)) throw new Error("Phản hồi lưu nội dung không hợp lệ. Hãy kiểm tra danh sách trước khi thử lại.");

      const wasCreating = !activeId;
      const savedId = saved.data.id;
      setSavedVersions((current) => ({ ...current, [savedId]: activeVersion === undefined ? 0 : activeVersion + 1 }));
      setActiveId(savedId);
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
    if (!await confirm({ title: "Xác nhận xóa nội dung", message: `Xóa ${label} này khỏi CMS? Thao tác không thể hoàn tác.`, confirmLabel: "Xóa", tone: "danger" })) return;

    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/supporting?kind=${kind}&id=${activeId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw adminApiError(payload, `Không thể xóa ${label}.`);
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
      <AdminCard>
        <AdminListHeader actions={<AdminButton hideWithoutPermission permission="supporting.create" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={createCurrentKind}>{kind === "testimonials" ? "Thêm đánh giá" : partnerKindFilter === "customer" ? "Thêm khách hàng" : "Thêm đối tác"}</AdminButton>} description={loading ? "Đang tải danh sách…" : `${pagination.total} ${kind === "testimonials" ? "đánh giá" : "mục"}`} title="Đối tác & Đánh giá" />
        <AdminFilterTabs<SupportingKind> restoreNavigationFocus ariaLabel="Loại nội dung" disabled={processing || loading} items={[{ label: "Đối tác & khách hàng", value: "partners" }, { label: "Đánh giá", value: "testimonials" }]} value={kind} onValueChange={changeKind} />
        <AdminFilterBar onSubmit={(event) => { event.preventDefault(); navigate({ page: 1, query: search.trim() }); }} chips={chips} onClearAll={() => { setSearch(""); navigate({ page: 1, query: "", partnerKind: "all", visibility: "all" }); }} search={<AdminSearchField disabled={processing || loading} label="Tìm kiếm" onChange={event => setSearch(event.target.value)} placeholder="Tên, doanh nghiệp hoặc nội dung" value={search} />}>

          {kind === "partners" ? <select aria-label="Nhóm đối tác" disabled={processing || loading} onChange={(event) => navigate({ page: 1, partnerKind: event.target.value as PartnerKindFilter })} value={partnerKindFilter}>
            {(["all", "partner", "customer"] as const).map((value) => <option key={value} value={value}>{value === "all" ? "Tất cả nhóm" : partnerKindFilterLabel[value]}</option>)}
          </select> : null}
          <select aria-label="Lọc trạng thái" disabled={processing || loading} onChange={(event) => navigate({ page: 1, visibility: event.target.value as VisibilityFilter })} value={filter}>
            {(["all", "enabled", "disabled"] as const).map((value) => <option key={value} value={value}>{value === "all" ? "Tất cả trạng thái" : visibilityLabel[value]}</option>)}
          </select>
        </AdminFilterBar>
        <div aria-live="polite" className="admin-tile-grid">
          {kind === "partners"
            ? visiblePartners.map((item) => <PartnerListItem active={activeId === item.id} item={item} key={item.id} onClick={() => selectPartner(item)} />)
            : visibleTestimonials.map((item) => <TestimonialListItem active={activeId === item.id} item={item} key={item.id} onClick={() => selectTestimonial(item)} />)}
          {(kind === "partners" ? visiblePartners.length : visibleTestimonials.length) === 0 ? <div className="col-span-full"><AdminEmptyState description="Đổi bộ lọc hoặc tạo nội dung mới bằng nút phía trên." title={`Chưa có ${kind === "testimonials" ? "đánh giá" : partnerKindFilter === "customer" ? "khách hàng" : partnerKindFilter === "partner" ? "đối tác" : "nội dung"} phù hợp`} /></div> : null}
        </div>
        <nav aria-label="Phân trang" className="admin-pagination">
          <label className="admin-check">Mỗi trang
            <select disabled={processing || loading} value={pagination.pageSize} onChange={event => navigate({ page: 1, pageSize: Number(event.target.value) })}>
              {pageSizeOptions(pagination.pageSize).map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <div>
            <AdminButton size="sm" variant="secondary" disabled={processing || loading || pagination.page <= 1} onClick={() => navigate({ page: pagination.page - 1 })}>Trang trước</AdminButton>
            <span className="admin-pagination__page">{pagination.page}/{Math.max(pagination.totalPages, 1)}</span>
            <AdminButton size="sm" variant="secondary" disabled={processing || loading || pagination.page >= pagination.totalPages} onClick={() => navigate({ page: pagination.page + 1 })}>Trang sau</AdminButton>
          </div>
        </nav>
      </AdminCard>

      {form ? (
        <AdminSidePanel
          isOpen={editorOpen}
          label={kind === "partners" ? "Biên tập đối tác" : "Biên tập đánh giá khách hàng"}
          onClose={closeEditor}
          footer={<>
            <span className="admin-list-manager__footer-start">{activeId ? <AdminButton variant="danger" disabled={processing || dirty || form.isEnabled} hideWithoutPermission onClick={removeCurrent} permission="supporting.delete" title={form.isEnabled ? "Ẩn nội dung trước khi xóa" : "Xóa khỏi CMS"} type="button">Xóa</AdminButton> : null}</span>
            {dirty ? <AdminButton variant="secondary" disabled={processing} onClick={discardChanges} type="button">Bỏ thay đổi</AdminButton> : null}
            <AdminButton disabled={processing || !dirty} form="supporting-editor" permission={activeId ? "supporting.update" : "supporting.create"} type="submit">{isUploading ? "Đang tải ảnh…" : busy ? "Đang lưu…" : "Lưu thay đổi"}</AdminButton>
          </>}
        >
          <form id="supporting-editor" onSubmit={save}>
            <header className="admin-list-manager__panel-header">
              <p>{activeId ? "Chỉnh sửa" : "Tạo mới"}</p>
              <h2 id="supporting-editor-title">{kind === "partners" ? "Đối tác" : "Đánh giá khách hàng"}</h2>
              <small className={dirty ? "admin-list-manager__dirty" : undefined}>{processing ? "Đang xử lý nội dung…" : dirty ? "Có thay đổi chưa lưu." : activeId ? "Không có thay đổi chưa lưu." : "Nhập thông tin để tạo nội dung mới."}</small>
            </header>
            <fieldset className="admin-list-manager__form" disabled={processing}>
              {kind === "partners" && partnerForm ? <PartnerForm form={partnerForm} onChange={setPartnerForm} onUploadingChange={handleUploadingChange} /> : null}
              {kind === "testimonials" && testimonialForm ? <TestimonialForm form={testimonialForm} onChange={setTestimonialForm} onUploadingChange={handleUploadingChange} /> : null}
            </fieldset>
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
    <button aria-pressed={active} className="admin-tile" onClick={onClick} type="button">
      <MediaThumbnail alt={item.logo?.altText || item.name} url={item.logo?.url} />
      <span><strong>{item.name}</strong><small>{item.kind === "partner" ? "Đối tác" : "Khách hàng"} · Thứ tự {item.sortOrder}</small></span>
      <StatusBadge enabled={item.isEnabled} />
    </button>
  );
}

function TestimonialListItem({ active, item, onClick }: { active: boolean; item: Testimonial; onClick: () => void }) {
  return (
    <button aria-pressed={active} className="admin-tile" onClick={onClick} type="button">
      <MediaThumbnail alt={item.avatar?.altText || item.authorName} url={item.avatar?.url} />
      <span><strong>{item.authorName}</strong><small>{item.company || item.authorRole || "Chưa có doanh nghiệp/chức danh"}</small></span>
      <StatusBadge enabled={item.isEnabled} />
    </button>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return <AdminStatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "Hiển thị" : "Đang ẩn"}</AdminStatusBadge>;
}

function MediaThumbnail({ alt, url }: { alt: string; url: string | undefined }) {
  return (
    <span className="admin-tile__media">
      {url ? <Image alt={alt} className="object-cover" fill sizes="48px" src={url} unoptimized /> : alt.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PartnerForm({ form, onChange, onUploadingChange }: { form: PartnerInput; onChange: Dispatch<SetStateAction<PartnerInput | null>>; onUploadingChange: (pending: boolean) => void }) {
  return (
    <div className="grid gap-4">
      <div className="admin-form-grid">
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
    <div className="grid gap-4">
      <Field label="Họ tên khách hàng"><input onChange={(event) => onChange({ ...form, authorName: event.target.value })} required value={form.authorName} /></Field>
      <div className="admin-form-grid">
        <Field label="Chức danh"><input onChange={(event) => onChange({ ...form, authorRole: event.target.value || null })} value={form.authorRole || ""} /></Field>
        <Field label="Doanh nghiệp"><input onChange={(event) => onChange({ ...form, company: event.target.value || null })} value={form.company || ""} /></Field>
      </div>
      <Field label="Nhận xét"><textarea onChange={(event) => onChange({ ...form, quote: event.target.value })} required rows={5} value={form.quote} /></Field>
      <div className="admin-form-grid">
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
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="admin-check">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

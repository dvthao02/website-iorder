"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition, type Dispatch, type SetStateAction, type FormEvent, type ReactNode } from "react";

import type {
  PartnerInput,
  PartnerListQuery,
  TestimonialInput,
} from "@iorder/core/server/supporting/supporting.contract";
import { partnerInputSchema, testimonialInputSchema, supportingSaveResponseSchema } from "@iorder/core/server/supporting/supporting.contract";

import { MediaPicker } from "./media-picker";
import { AdminBulkBar } from "./ui/admin-bulk-bar";
import { AdminBulkMenu, type AdminBulkMenuAction } from "./ui/admin-bulk-menu";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminFileIcon } from "./ui/admin-file-icon";
import { AdminRowEditIcon } from "./ui/admin-row-title";
import { useAdminPermissions } from "./ui/admin-permissions";
import { useRowSelection } from "./ui/content-bulk-bar";
import { useBulkAction } from "./ui/use-bulk-action";
import { AdminFilterBar, type AdminFilterChip } from "./ui/admin-filter-bar";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { AdminSearchField } from "./ui/admin-search-field";
import { DataTransferActions } from "./data-transfer-actions";
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
  // Chọn nhiều dòng: tự bỏ chọn khi đổi loại, bộ lọc, từ khóa hoặc trang.
  const { can } = useAdminPermissions();
  const selection = useRowSelection(`${kind}|${initialQuery.query}|${filter}|${partnerKindFilter}|${pagination.page}|${pagination.pageSize}`);
  const { busy: bulkBusy, run: runBulk } = useBulkAction();
  const bulkItems: (Partner | Testimonial)[] = kind === "partners" ? visiblePartners : visibleTestimonials;
  const chosen = bulkItems.filter((item) => selection.selectedIds.includes(item.id));
  const hiddenChosen = chosen.filter((item) => !item.isEnabled);
  const shownChosen = chosen.filter((item) => item.isEnabled);
  const bulkNoun = kind === "partners" ? "mục" : "đánh giá";
  const visibilityDenied = can("supporting.update") && can("supporting.publish") ? undefined : "Cần quyền sửa và xuất bản.";
  const setVisibility = (items: (Partner | Testimonial)[], isEnabled: boolean) => () => void runBulk({
    items, verb: isEnabled ? "Hiện" : "Ẩn", noun: bulkNoun, onDone: selection.clear,
    confirmMessage: isEnabled ? undefined : "Các mục sẽ không còn hiện trên website; bật lại được bất cứ lúc nào.",
    request: (item) => ({ method: "POST", url: "/api/admin/supporting", body: { kind, id: item.id, values: { ...supportingValues(kind, item), isEnabled }, expectedVersion: item.version } }),
  });
  const bulkActions: AdminBulkMenuAction[] = [
    { key: "show", label: "Hiện trên website", icon: <Eye aria-hidden="true" />, count: hiddenChosen.length, disabledReason: visibilityDenied, onSelect: setVisibility(hiddenChosen, true) },
    { key: "hide", label: "Ẩn khỏi website", icon: <EyeOff aria-hidden="true" />, count: shownChosen.length, disabledReason: visibilityDenied, onSelect: setVisibility(shownChosen, false) },
    { key: "export", label: "Xuất Excel", icon: <AdminFileIcon action="export" kind="excel" size="sm" />, count: chosen.length, href: `/api/admin/data-transfer/${kind}?format=xlsx&ids=${chosen.map((item) => item.id).join(",")}` },
    { key: "delete", label: "Xóa", icon: <Trash2 aria-hidden="true" />, count: hiddenChosen.length, tone: "danger", disabledReason: !can("supporting.delete") ? "Cần quyền xóa." : hiddenChosen.length ? undefined : "Chỉ xóa được mục đang ẩn.", onSelect: () => void runBulk({ items: hiddenChosen, verb: "Xóa", noun: bulkNoun, confirmMessage: "Các mục đang ẩn sẽ bị xóa khỏi CMS. Thao tác không thể hoàn tác.", tone: "danger", onDone: selection.clear, request: (item) => ({ method: "DELETE", url: `/api/admin/supporting?kind=${kind}&id=${item.id}` }) }) },
  ];

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
    if (nextKind !== kind) requestNavigationFocus(`/admin/partners?${params}`);
    startTransition(() => router.push(`/admin/partners?${params}`, { scroll: false }));
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
      const payload = await readAdminJson(response);
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
      const payload = await readAdminJson(response);
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
        <AdminListHeader actions={<><DataTransferActions dataset={kind} key={kind} label={kind === "testimonials" ? "Đánh giá" : "Đối tác & khách hàng"} module="supporting" /><AdminButton hideWithoutPermission permission="supporting.create" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={createCurrentKind}>{kind === "testimonials" ? "Thêm đánh giá" : partnerKindFilter === "customer" ? "Thêm khách hàng" : "Thêm đối tác"}</AdminButton></>} description={loading ? "Đang tải danh sách…" : `${pagination.total} ${kind === "testimonials" ? "đánh giá" : "mục"}`} title="Đối tác & Đánh giá" />
        <AdminFilterTabs<SupportingKind> restoreNavigationFocus ariaLabel="Loại nội dung" disabled={processing || loading} items={[{ label: "Đối tác & khách hàng", value: "partners" }, { label: "Đánh giá", value: "testimonials" }]} value={kind} onValueChange={changeKind} />
        <AdminFilterBar onSubmit={(event) => { event.preventDefault(); navigate({ page: 1, query: search.trim() }); }} chips={chips} onClearAll={() => { setSearch(""); navigate({ page: 1, query: "", partnerKind: "all", visibility: "all" }); }} search={<AdminSearchField disabled={processing || loading} label="Tìm kiếm" onChange={event => setSearch(event.target.value)} placeholder="Tên, doanh nghiệp hoặc nội dung" value={search} />}>

          {kind === "partners" ? <select aria-label="Nhóm đối tác" disabled={processing || loading} onChange={(event) => navigate({ page: 1, partnerKind: event.target.value as PartnerKindFilter })} value={partnerKindFilter}>
            {(["all", "partner", "customer"] as const).map((value) => <option key={value} value={value}>{value === "all" ? "Tất cả nhóm" : partnerKindFilterLabel[value]}</option>)}
          </select> : null}
          <select aria-label="Lọc trạng thái" disabled={processing || loading} onChange={(event) => navigate({ page: 1, visibility: event.target.value as VisibilityFilter })} value={filter}>
            {(["all", "enabled", "disabled"] as const).map((value) => <option key={value} value={value}>{value === "all" ? "Tất cả trạng thái" : visibilityLabel[value]}</option>)}
          </select>
        </AdminFilterBar>
        <AdminBulkBar count={chosen.length} onClear={selection.clear}><AdminBulkMenu actions={bulkActions} busy={bulkBusy} /></AdminBulkBar>
        <div aria-live="polite">
          {(kind === "partners" ? visiblePartners.length : visibleTestimonials.length) === 0
            ? <AdminEmptyState description="Đổi bộ lọc hoặc tạo nội dung mới bằng nút phía trên." title={`Chưa có ${kind === "testimonials" ? "đánh giá" : partnerKindFilter === "customer" ? "khách hàng" : partnerKindFilter === "partner" ? "đối tác" : "nội dung"} phù hợp`} />
            : kind === "partners"
              ? <AdminDataTable columns={partnerColumns} emptyMessage="Chưa có đối tác." getRowId={(item) => item.id} onRowClick={selectPartner} onSelectionChange={selection.setSelectedIds} rows={visiblePartners} selectedIds={selection.selectedIds} tableId="cms-partners" />
              : <AdminDataTable columns={testimonialColumns} emptyMessage="Chưa có đánh giá." getRowId={(item) => item.id} onRowClick={selectTestimonial} onSelectionChange={selection.setSelectedIds} rows={visibleTestimonials} selectedIds={selection.selectedIds} tableId="cms-testimonials" />}
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

// Bảng như các màn danh sách khác (bấm dòng để sửa trong khung trượt); cột chỉnh được ở "Cài đặt bảng".
const partnerColumns: AdminDataTableColumn<Partner>[] = [
  { id: "name", label: "Tên", defaultWidth: 280, minWidth: 180, sortValue: (item) => item.name, cell: (item) => <NameCell imageUrl={item.logo?.url} name={item.name} /> },
  { id: "kind", label: "Loại", defaultWidth: 130, minWidth: 110, sortValue: (item) => item.kind, cell: (item) => <span className="admin-text-muted">{partnerKindFilterLabel[item.kind]}</span> },
  { id: "website", label: "Website", defaultWidth: 240, minWidth: 140, sortValue: (item) => item.websiteUrl ?? "", cell: (item) => item.websiteUrl ? <span className="admin-text-muted block truncate" title={item.websiteUrl}>{item.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}</span> : <span className="admin-text-muted">—</span> },
  { id: "sortOrder", label: "Thứ tự", defaultWidth: 100, minWidth: 100, align: "right", sortValue: (item) => item.sortOrder, cell: (item) => <span className="admin-text-muted">{item.sortOrder}</span> },
  { id: "status", label: "Trạng thái", defaultWidth: 130, minWidth: 110, sortValue: (item) => (item.isEnabled ? 0 : 1), cell: (item) => <StatusBadge enabled={item.isEnabled} /> },
  { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: () => <AdminRowEditIcon /> },
];

const testimonialColumns: AdminDataTableColumn<Testimonial>[] = [
  { id: "author", label: "Người đánh giá", defaultWidth: 210, minWidth: 160, sortValue: (item) => item.authorName, cell: (item) => <NameCell imageUrl={item.avatar?.url} name={item.authorName} /> },
  { id: "company", label: "Công ty · chức vụ", defaultWidth: 200, minWidth: 140, sortValue: (item) => item.company ?? item.authorRole ?? "", cell: (item) => <span className="admin-text-muted block truncate">{[item.company, item.authorRole].filter(Boolean).join(" · ") || "—"}</span> },
  { id: "quote", label: "Nội dung", defaultWidth: 240, minWidth: 160, cell: (item) => <span className="admin-text-muted block truncate" title={item.quote}>{item.quote}</span> },
  { id: "rating", label: "Số sao", defaultWidth: 100, minWidth: 100, align: "right", sortValue: (item) => item.rating ?? 0, cell: (item) => <span className="admin-text-muted">{item.rating ? `${item.rating}/5` : "—"}</span> },
  { id: "sortOrder", label: "Thứ tự", defaultWidth: 100, minWidth: 100, align: "right", sortValue: (item) => item.sortOrder, cell: (item) => <span className="admin-text-muted">{item.sortOrder}</span> },
  { id: "status", label: "Trạng thái", defaultWidth: 130, minWidth: 110, sortValue: (item) => (item.isEnabled ? 0 : 1), cell: (item) => <StatusBadge enabled={item.isEnabled} /> },
  { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: () => <AdminRowEditIcon /> },
];

// Giá trị gửi lại khi bật/tắt hàng loạt: giữ nguyên mọi trường, chỉ đổi "Hiển thị trên website".
function supportingValues(kind: SupportingKind, item: Partner | Testimonial): PartnerInput | TestimonialInput {
  if (kind === "partners") { const { logoMediaId, kind: partnerKind, name, description, websiteUrl, sortOrder, isEnabled } = item as Partner; return { logoMediaId, kind: partnerKind, name, description, websiteUrl, sortOrder, isEnabled }; }
  const { avatarMediaId, authorName, authorRole, company, quote, rating, sortOrder, isEnabled } = item as Testimonial;
  return { avatarMediaId, authorName, authorRole, company, quote, rating, sortOrder, isEnabled };
}


function StatusBadge({ enabled }: { enabled: boolean }) {
  return <AdminStatusBadge tone={enabled ? "success" : "neutral"}>{enabled ? "Hiển thị" : "Đang ẩn"}</AdminStatusBadge>;
}

function NameCell({ imageUrl, name }: { imageUrl: string | undefined; name: string }) {
  return <span className="admin-row-title">
    <span className="admin-row-title__thumb">{imageUrl ? <Image alt="" className="object-contain" fill sizes="40px" src={imageUrl} /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}</span>
    <span className="admin-row-title__text">{name}</span>
  </span>;
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

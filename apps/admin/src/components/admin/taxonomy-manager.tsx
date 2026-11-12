"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { FolderTree, Plus, Tags, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { AdminBulkBar } from "./ui/admin-bulk-bar";
import { AdminBulkMenu, type AdminBulkMenuAction } from "./ui/admin-bulk-menu";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminFileIcon } from "./ui/admin-file-icon";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminRowEditIcon } from "./ui/admin-row-title";
import { useRowSelection } from "./ui/content-bulk-bar";
import { useBulkAction } from "./ui/use-bulk-action";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminNotice, useAdminToast } from "./ui/admin-feedback";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminListHeader } from "./ui/admin-list-header";
import { DataTransferActions } from "./data-transfer-actions";
import { AdminListPage } from "./ui/admin-list-page";
import { categoryInputSchema, tagInputSchema } from "@iorder/shared/server/taxonomy/taxonomy.contract";
import { toSlug } from "@/lib/slug";
import { useAdminClientReady } from "./ui/use-admin-client-ready";
import { AdminFormField } from "./ui/admin-form-field";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useNavigationGuard } from "./ui/use-navigation-guard";

type Category = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  version: number;
};
type Tag = { id: string; name: string; slug: string; version: number };
type CategoryForm = Omit<Category, "id" | "version">;
type TagForm = Omit<Tag, "id" | "version">;
type TaxonomyKind = "categories" | "tags";

const blankCategory: CategoryForm = { parentId: null, name: "", slug: "", description: null, sortOrder: 0 };
const blankTag: TagForm = { name: "", slug: "" };

function descendantIds(categories: Category[], ancestorId: string) {
  const result = new Set([ancestorId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        changed = true;
      }
    }
  }
  return result;
}

function categoryDepth(categories: Category[], item: Category) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const seen = new Set<string>();
  let parentId = item.parentId;
  let depth = 0;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    depth += 1;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return depth;
}

function equalValues(first: CategoryForm | TagForm | null, second: CategoryForm | TagForm | null) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function TaxonomyManager({ categories, tags }: { categories: Category[]; tags: Tag[] }) {
  const router = useRouter();
  const ready = useAdminClientReady();
  const { confirm } = useAdminConfirm();
  const { show: showToast } = useAdminToast();
  const [kind, setKind] = useState<TaxonomyKind>("categories");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null);
  const [tagForm, setTagForm] = useState<TagForm | null>(null);
  const [initialValues, setInitialValues] = useState<CategoryForm | TagForm | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const validation = useAdminFormValidation("taxonomy", {
    name: { label: "Tên", message: kind === "categories" ? "Nhập tên chuyên mục từ 1 đến 160 ký tự." : "Nhập tên thẻ từ 1 đến 120 ký tự." },
    slug: { label: "Đường dẫn", message: kind === "categories" ? "Đường dẫn tối đa 180 ký tự, chỉ gồm chữ không dấu viết thường, số và dấu gạch ngang giữa các từ." : "Đường dẫn tối đa 140 ký tự, chỉ gồm chữ không dấu viết thường, số và dấu gạch ngang giữa các từ." },
    parentId: { label: "Chuyên mục cha", message: "Chọn chuyên mục cha hợp lệ hoặc để ở cấp cao." },
    description: { label: "Mô tả", message: "Mô tả không vượt quá 10.000 ký tự." },
    sortOrder: { label: "Thứ tự hiển thị", message: "Nhập số nguyên từ 0 đến 1.000.000." },
  });

  const form = kind === "categories" ? categoryForm : tagForm;
  // Version vừa lưu được nhớ cục bộ vì props chỉ cập nhật sau khi router.refresh() xong;
  // lấy giá trị lớn hơn để không gửi version cũ khi lưu liên tiếp hoặc ngay sau khi tạo mới.
  const [savedVersions, setSavedVersions] = useState<Record<string, number>>({});
  const propVersion = activeId ? (kind === "categories" ? categories : tags).find((item) => item.id === activeId)?.version : undefined;
  const localVersion = activeId ? savedVersions[activeId] : undefined;
  const activeVersion = propVersion === undefined ? localVersion : localVersion === undefined ? propVersion : Math.max(propVersion, localVersion);
  const dirty = !equalValues(form, initialValues);
  useNavigationGuard(dirty || busy, busy ? () => showToast("Đang xử lý phân loại. Vui lòng chờ trước khi rời trang.", "info") : undefined);
  const invalidParentIds = activeId && kind === "categories" ? descendantIds(categories, activeId) : new Set<string>();
  // Chọn nhiều dòng (bỏ chọn khi đổi tab): xuất Excel các mục đã chọn, xóa hàng loạt.
  const { can } = useAdminPermissions();
  const canEdit = can(activeId ? "taxonomy.update" : "taxonomy.create");
  const selection = useRowSelection(kind);
  const { busy: bulkBusy, run: runBulk } = useBulkAction();
  const chosen = (kind === "categories" ? categories : tags).filter((item) => selection.selectedIds.includes(item.id));
  const bulkNoun = kind === "categories" ? "chuyên mục" : "thẻ";
  const bulkActions: AdminBulkMenuAction[] = [
    { key: "export", label: "Xuất Excel", icon: <AdminFileIcon action="export" kind="excel" size="sm" />, count: chosen.length, href: `/api/v1/admin/data-transfer/${kind}?format=xlsx&ids=${chosen.map((item) => item.id).join(",")}` },
    { key: "delete", label: "Xóa", icon: <Trash2 aria-hidden="true" />, count: chosen.length, tone: "danger", disabledReason: can("taxonomy.delete") ? undefined : "Cần quyền xóa phân loại.", onSelect: () => void runBulk({ items: chosen, verb: "Xóa", noun: bulkNoun, confirmMessage: "Các mục đã chọn sẽ bị xóa khỏi CMS. Thao tác không thể hoàn tác.", tone: "danger", onDone: selection.clear, request: (item) => ({ method: "DELETE", url: `/api/v1/admin/taxonomy?kind=${kind}&id=${item.id}` }) }) },
  ];
  const categoryColumns: AdminDataTableColumn<Category>[] = [
    { id: "name", label: "Tên", defaultWidth: 320, minWidth: 180, cell: (item) => <span className="block truncate" style={{ paddingLeft: `${Math.min(categoryDepth(categories, item), 3) * 16}px` }}>{item.name}</span> },
    { id: "slug", label: "Đường dẫn", defaultWidth: 260, minWidth: 140, sortValue: (item) => item.slug, cell: (item) => <span className="admin-text-muted block truncate">/{item.slug}</span> },
    { id: "sortOrder", label: "Thứ tự", defaultWidth: 100, minWidth: 100, align: "right", sortValue: (item) => item.sortOrder, cell: (item) => <span className="admin-text-muted">{item.sortOrder}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: () => <AdminRowEditIcon /> },
  ];
  const tagColumns: AdminDataTableColumn<Tag>[] = [
    { id: "name", label: "Tên", defaultWidth: 320, minWidth: 180, sortValue: (item) => item.name, cell: (item) => <span className="block truncate">{item.name}</span> },
    { id: "slug", label: "Đường dẫn", defaultWidth: 260, minWidth: 140, sortValue: (item) => item.slug, cell: (item) => <span className="admin-text-muted block truncate">/{item.slug}</span> },
    { id: "actions", label: "Thao tác", defaultWidth: 120, minWidth: 120, align: "right", cell: () => <AdminRowEditIcon /> },
  ];

  function allowSelectionChange() {
    if (mutationPending.current) {
      showToast("Đang xử lý phân loại. Vui lòng chờ trước khi chuyển mục.", "info");
      return false;
    }
    if (!dirty) return true;
    showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi chuyển mục.", "warning");
    return false;
  }

  function selectCategory(item?: Category) {
    if (!allowSelectionChange()) return;
    const values: CategoryForm = item
      ? { parentId: item.parentId, name: item.name, slug: item.slug, description: item.description, sortOrder: item.sortOrder }
      : { ...blankCategory };
    validation.reset();
    setSaveError("");
    setSlugTouched(Boolean(item));
    setKind("categories");
    setActiveId(item?.id ?? null);
    setCategoryForm(values);
    setTagForm(null);
    setInitialValues(values);
  }

  function selectTag(item?: Tag) {
    if (!allowSelectionChange()) return;
    const values: TagForm = item ? { name: item.name, slug: item.slug } : { ...blankTag };
    validation.reset();
    setSaveError("");
    setSlugTouched(Boolean(item));
    setKind("tags");
    setActiveId(item?.id ?? null);
    setCategoryForm(null);
    setTagForm(values);
    setInitialValues(values);
  }

  function changeKind(nextKind: TaxonomyKind) {
    if (nextKind === kind || !allowSelectionChange()) return;
    setKind(nextKind);
    setActiveId(null);
    setCategoryForm(null);
    setTagForm(null);
    setInitialValues(null);
  }

  function closeEditor() {
    if (!allowSelectionChange()) return;
    setActiveId(null);
    setCategoryForm(null);
    setTagForm(null);
    setInitialValues(null);
  }

  function discardChanges() {
    if (mutationPending.current || !initialValues) return;
    validation.reset();
    setSaveError("");
    setSlugTouched(Boolean(activeId));
    if (kind === "categories") setCategoryForm(initialValues as CategoryForm);
    else setTagForm(initialValues as TagForm);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = kind === "categories" ? categoryForm : tagForm;
    if (!values || !canEdit || !dirty || mutationPending.current) return;

    setSaveError("");
    const parsed = (kind === "categories" ? categoryInputSchema : tagInputSchema).safeParse(values);
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/admin/taxonomy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id: activeId, values: parsed.data, ...(activeVersion !== undefined ? { expectedVersion: activeVersion } : {}) }),
      });
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu phân loại.");
      if (typeof body.id !== "string" || !body.id || (activeId && body.id !== activeId)) throw new Error("Phản hồi lưu phân loại không hợp lệ. Hãy kiểm tra lại dữ liệu trước khi thử lại.");

      const wasCreating = !activeId;
      const savedId: string = body.id;
      setSavedVersions((current) => ({ ...current, [savedId]: activeVersion === undefined ? 0 : activeVersion + 1 }));
      setActiveId(savedId);
      if (kind === "categories") setCategoryForm(parsed.data as CategoryForm);
      else setTagForm(parsed.data as TagForm);
      setInitialValues(parsed.data);
      showToast(wasCreating ? (kind === "categories" ? "Đã tạo chuyên mục." : "Đã tạo thẻ.") : "Đã lưu thay đổi.", "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setSaveError(message);
      showToast(message, "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function removeCurrent() {
    if (mutationPending.current) return;
    if (!activeId || dirty) {
      if (dirty) showToast("Hãy lưu hoặc bỏ thay đổi trước khi xóa.", "warning");
      return;
    }
    const label = kind === "categories" ? "chuyên mục" : "thẻ";
    if (!await confirm({ title: "Xác nhận xóa phân loại", message: `Xóa ${label} này khỏi CMS? Thao tác không thể hoàn tác.`, confirmLabel: "Xóa", tone: "danger" })) return;

    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/taxonomy?kind=${kind}&id=${activeId}`, { method: "DELETE" });
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, `Không thể xóa ${label}.`);
      if (body.deletedId !== activeId) throw new Error("Phản hồi xóa phân loại không hợp lệ. Hãy tải lại danh sách để kiểm tra.");
      setActiveId(null);
      setCategoryForm(null);
      setTagForm(null);
      setInitialValues(null);
      showToast(`Đã xóa ${label} khỏi CMS.`, "success");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không kết nối được máy chủ.";
      setSaveError(message);
      showToast(message, "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  return (
    <AdminListPage>
      <AdminCard>
          <AdminListHeader actions={<><DataTransferActions dataset={kind} key={kind} label={kind === "categories" ? "Chuyên mục" : "Thẻ"} module="taxonomy" /><AdminButton hideWithoutPermission permission="taxonomy.create" disabled={busy || !ready} leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => (kind === "categories" ? selectCategory() : selectTag())}>{kind === "categories" ? "Thêm chuyên mục" : "Thêm thẻ"}</AdminButton></>} description={`${categories.length} chuyên mục · ${tags.length} thẻ`} title="Chuyên mục & Thẻ" />
          <AdminFilterTabs ariaLabel="Loại phân loại" disabled={busy} items={[{ label: `Chuyên mục (${categories.length})`, value: "categories" }, { label: `Thẻ (${tags.length})`, value: "tags" }]} onValueChange={changeKind} value={kind} />

        <AdminBulkBar count={chosen.length} onClear={selection.clear}><AdminBulkMenu actions={bulkActions} busy={bulkBusy} /></AdminBulkBar>
        <div>
          {kind === "categories"
            ? categories.length ? <AdminDataTable columns={categoryColumns} emptyMessage="Chưa có chuyên mục." getRowId={(item) => item.id} getRowLabel={(item) => item.name} onRowClick={selectCategory} onSelectionChange={selection.setSelectedIds} rows={categories} selectedIds={selection.selectedIds} tableId="cms-categories" /> : null
            : tags.length ? <AdminDataTable columns={tagColumns} emptyMessage="Chưa có thẻ." getRowId={(item) => item.id} getRowLabel={(item) => item.name} onRowClick={selectTag} onSelectionChange={selection.setSelectedIds} rows={tags} selectedIds={selection.selectedIds} tableId="cms-tags" /> : null}
          {(kind === "categories" ? categories.length : tags.length) === 0 ? (
            <AdminEmptyState
              action={<AdminButton hideWithoutPermission permission="taxonomy.create" disabled={busy || !ready} onClick={() => (kind === "categories" ? selectCategory() : selectTag())}>{kind === "categories" ? "Tạo chuyên mục đầu tiên" : "Tạo thẻ đầu tiên"}</AdminButton>}
              description={kind === "categories" ? "Chuyên mục dùng cho điều hướng và trang danh sách bài viết." : "Thẻ giúp liên kết các bài viết có chủ đề liên quan."}
              icon={kind === "categories" ? <FolderTree aria-hidden="true" size={20} /> : <Tags aria-hidden="true" size={20} />}
              title={kind === "categories" ? "Chưa có chuyên mục" : "Chưa có thẻ"}
            />
          ) : null}
        </div>
      </AdminCard>

      <AdminSidePanel
        footer={form ? <>
          <span className="admin-list-manager__footer-start">{activeId ? <AdminButton disabled={busy} hideWithoutPermission onClick={removeCurrent} permission="taxonomy.delete" variant="danger">Xóa {kind === "categories" ? "chuyên mục" : "thẻ"}</AdminButton> : null}</span>
          {dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary">Bỏ thay đổi</AdminButton> : null}
          <AdminButton disabled={busy || !dirty} form="taxonomy-editor" permission={activeId ? "taxonomy.update" : "taxonomy.create"} type="submit">{busy ? "Đang lưu…" : "Lưu phân loại"}</AdminButton>
        </> : null}
        isOpen={form !== null}
        label={kind === "categories" ? "Biên tập chuyên mục" : "Biên tập thẻ"}
        onClose={closeEditor}
      >
        {form ? (
          <form id="taxonomy-editor" noValidate onSubmit={save}>
            <header className="admin-list-manager__panel-header">
              <p>{activeId ? "Chỉnh sửa" : "Tạo mới"}</p>
              <h2>{kind === "categories" ? "Chuyên mục" : "Thẻ bài viết"}</h2>
              <small className={dirty ? "admin-list-manager__dirty" : undefined}>{busy ? "Đang xử lý phân loại…" : dirty ? "Có thay đổi chưa lưu." : activeId ? "Không có thay đổi chưa lưu." : "Nhập thông tin để tạo phân loại mới."}</small>
            </header>

            <fieldset className="admin-list-manager__form" disabled={busy || !canEdit}>
            {!canEdit ? <AdminNotice tone="info">Bạn đang xem nội dung. Cần quyền sửa để lưu thay đổi.</AdminNotice> : null}
            {validation.summary}
            {saveError ? <AdminNotice tone="error">{saveError}</AdminNotice> : null}
            {kind === "categories" && categoryForm ? (
              <>
                <AdminFormField id="taxonomy-name" label="Tên chuyên mục" error={validation.message("name")}><input {...validation.props("name")} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value, ...(!activeId && !slugTouched ? { slug: toSlug(event.target.value) } : {}) })} required value={categoryForm.name} /></AdminFormField>
                <div className="admin-form-grid">
                  <AdminFormField id="taxonomy-slug" label="Đường dẫn" error={validation.message("slug")}><input {...validation.props("slug")} onChange={(event) => { setSlugTouched(true); setCategoryForm({ ...categoryForm, slug: event.target.value }); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="tin-cong-nghe" required value={categoryForm.slug} /></AdminFormField>
                  <AdminFormField id="taxonomy-sortOrder" label="Thứ tự hiển thị" error={validation.message("sortOrder")}><input {...validation.props("sortOrder")} min={0} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: Math.max(0, Number(event.target.value) || 0) })} type="number" value={categoryForm.sortOrder} /></AdminFormField>
                </div>
                <AdminFormField id="taxonomy-parentId" label="Chuyên mục cha" error={validation.message("parentId")}><select {...validation.props("parentId")} onChange={(event) => setCategoryForm({ ...categoryForm, parentId: event.target.value || null })} value={categoryForm.parentId ?? ""}><option value="">Không có — chuyên mục cấp cao</option>{categories.filter((item) => !invalidParentIds.has(item.id)).map((item) => <option key={item.id} value={item.id}>{"— ".repeat(categoryDepth(categories, item))}{item.name}</option>)}</select></AdminFormField>
                <AdminFormField id="taxonomy-description" label="Mô tả" error={validation.message("description")}><textarea {...validation.props("description")} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value || null })} rows={5} value={categoryForm.description ?? ""} /></AdminFormField>
              </>
            ) : null}

            {kind === "tags" && tagForm ? (
              <>
                <AdminFormField id="taxonomy-name" label="Tên thẻ" error={validation.message("name")}><input {...validation.props("name")} onChange={(event) => setTagForm({ ...tagForm, name: event.target.value, ...(!activeId && !slugTouched ? { slug: toSlug(event.target.value) } : {}) })} required value={tagForm.name} /></AdminFormField>
                <AdminFormField id="taxonomy-slug" label="Đường dẫn" error={validation.message("slug")}><input {...validation.props("slug")} onChange={(event) => { setSlugTouched(true); setTagForm({ ...tagForm, slug: event.target.value }); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="quan-ly-ban-hang" required value={tagForm.slug} /></AdminFormField>
              </>
            ) : null}

            </fieldset>
          </form>
        ) : null}
      </AdminSidePanel>
    </AdminListPage>
  );
}

"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { FolderTree, Plus, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { useAdminToast } from "./ui/admin-feedback";
import { AdminFilterTabs } from "./ui/admin-filter-tabs";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
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
  const { confirm } = useAdminConfirm();
  const { show: showToast } = useAdminToast();
  const [kind, setKind] = useState<TaxonomyKind>("categories");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null);
  const [tagForm, setTagForm] = useState<TagForm | null>(null);
  const [initialValues, setInitialValues] = useState<CategoryForm | TagForm | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationPending = useRef(false);

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
    setKind("categories");
    setActiveId(item?.id ?? null);
    setCategoryForm(values);
    setTagForm(null);
    setInitialValues(values);
  }

  function selectTag(item?: Tag) {
    if (!allowSelectionChange()) return;
    const values: TagForm = item ? { name: item.name, slug: item.slug } : { ...blankTag };
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
    if (kind === "categories") setCategoryForm(initialValues as CategoryForm);
    else setTagForm(initialValues as TagForm);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = kind === "categories" ? categoryForm : tagForm;
    if (!values || !dirty || mutationPending.current) return;

    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/taxonomy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id: activeId, values, ...(activeVersion !== undefined ? { expectedVersion: activeVersion } : {}) }),
      });
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu phân loại.");
      if (typeof body.id !== "string" || !body.id || (activeId && body.id !== activeId)) throw new Error("Phản hồi lưu phân loại không hợp lệ. Hãy kiểm tra lại dữ liệu trước khi thử lại.");

      const wasCreating = !activeId;
      const savedId: string = body.id;
      setSavedVersions((current) => ({ ...current, [savedId]: activeVersion === undefined ? 0 : activeVersion + 1 }));
      setActiveId(savedId);
      setInitialValues(values);
      showToast(wasCreating ? (kind === "categories" ? "Đã tạo chuyên mục." : "Đã tạo thẻ.") : "Đã lưu thay đổi.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
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
      const response = await fetch(`/api/admin/taxonomy?kind=${kind}&id=${activeId}`, { method: "DELETE" });
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
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  return (
    <AdminListPage>
      <AdminCard>
          <AdminListHeader actions={<AdminButton hideWithoutPermission permission="taxonomy.create" leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => (kind === "categories" ? selectCategory() : selectTag())}>{kind === "categories" ? "Thêm chuyên mục" : "Thêm thẻ"}</AdminButton>} description={`${categories.length} chuyên mục · ${tags.length} thẻ`} title="Chuyên mục & Thẻ" />
          <AdminFilterTabs ariaLabel="Loại phân loại" disabled={busy} items={[{ label: `Chuyên mục (${categories.length})`, value: "categories" }, { label: `Thẻ (${tags.length})`, value: "tags" }]} onValueChange={changeKind} value={kind} />

        <div className="admin-select-list">
          {kind === "categories" ? categories.map((item) => (
            <button
              className={item.id === activeId ? "admin-select-list__item admin-select-list__item--active" : "admin-select-list__item"}
              key={item.id}
              onClick={() => selectCategory(item)}
              style={{ paddingLeft: `calc(var(--cms-card-padding) + ${Math.min(categoryDepth(categories, item), 3) * 16}px)` }}
              type="button"
            >
              <strong>{item.name}</strong>
              <small>/{item.slug} · Thứ tự {item.sortOrder}</small>
            </button>
          )) : tags.map((item) => (
            <button className={item.id === activeId ? "admin-select-list__item admin-select-list__item--active" : "admin-select-list__item"} key={item.id} onClick={() => selectTag(item)} type="button">
              <strong>{item.name}</strong>
              <small>/{item.slug}</small>
            </button>
          ))}
          {(kind === "categories" ? categories.length : tags.length) === 0 ? (
            <AdminEmptyState
              action={<AdminButton onClick={() => (kind === "categories" ? selectCategory() : selectTag())}>{kind === "categories" ? "Tạo chuyên mục đầu tiên" : "Tạo thẻ đầu tiên"}</AdminButton>}
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
          <form id="taxonomy-editor" onSubmit={save}>
            <header className="admin-list-manager__panel-header">
              <p>{activeId ? "Chỉnh sửa" : "Tạo mới"}</p>
              <h2>{kind === "categories" ? "Chuyên mục" : "Thẻ bài viết"}</h2>
              <small className={dirty ? "admin-list-manager__dirty" : undefined}>{busy ? "Đang xử lý phân loại…" : dirty ? "Có thay đổi chưa lưu." : activeId ? "Không có thay đổi chưa lưu." : "Nhập thông tin để tạo phân loại mới."}</small>
            </header>

            <fieldset className="admin-list-manager__form" disabled={busy}>
            {kind === "categories" && categoryForm ? (
              <>
                <Field label="Tên chuyên mục"><input onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required value={categoryForm.name} /></Field>
                <div className="admin-form-grid">
                  <Field label="Slug"><input onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="tin-cong-nghe" required value={categoryForm.slug} /></Field>
                  <Field label="Thứ tự hiển thị"><input min={0} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: Math.max(0, Number(event.target.value) || 0) })} type="number" value={categoryForm.sortOrder} /></Field>
                </div>
                <Field label="Chuyên mục cha"><select onChange={(event) => setCategoryForm({ ...categoryForm, parentId: event.target.value || null })} value={categoryForm.parentId ?? ""}><option value="">Không có — chuyên mục cấp cao</option>{categories.filter((item) => !invalidParentIds.has(item.id)).map((item) => <option key={item.id} value={item.id}>{"— ".repeat(categoryDepth(categories, item))}{item.name}</option>)}</select></Field>
                <Field label="Mô tả"><textarea onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value || null })} rows={5} value={categoryForm.description ?? ""} /></Field>
              </>
            ) : null}

            {kind === "tags" && tagForm ? (
              <>
                <Field label="Tên thẻ"><input onChange={(event) => setTagForm({ ...tagForm, name: event.target.value })} required value={tagForm.name} /></Field>
                <Field label="Slug"><input onChange={(event) => setTagForm({ ...tagForm, slug: event.target.value })} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="quan-ly-ban-hang" required value={tagForm.slug} /></Field>
              </>
            ) : null}

            </fieldset>
          </form>
        ) : null}
      </AdminSidePanel>
    </AdminListPage>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}

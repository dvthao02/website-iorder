"use client";

import { FolderTree, Plus, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { useAdminToast } from "./ui/admin-feedback";

type Category = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};
type Tag = { id: string; name: string; slug: string };
type CategoryForm = Omit<Category, "id">;
type TagForm = Omit<Tag, "id">;
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
  const { show: showToast } = useAdminToast();
  const [kind, setKind] = useState<TaxonomyKind>("categories");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null);
  const [tagForm, setTagForm] = useState<TagForm | null>(null);
  const [initialValues, setInitialValues] = useState<CategoryForm | TagForm | null>(null);
  const [busy, setBusy] = useState(false);

  const form = kind === "categories" ? categoryForm : tagForm;
  const dirty = !equalValues(form, initialValues);
  const invalidParentIds = activeId && kind === "categories" ? descendantIds(categories, activeId) : new Set<string>();

  function allowSelectionChange() {
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

  function discardChanges() {
    if (!initialValues) return;
    if (kind === "categories") setCategoryForm(initialValues as CategoryForm);
    else setTagForm(initialValues as TagForm);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = kind === "categories" ? categoryForm : tagForm;
    if (!values) return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin/taxonomy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id: activeId, values }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Không thể lưu phân loại.");

      const wasCreating = !activeId;
      setActiveId(body.id);
      setInitialValues(values);
      showToast(wasCreating ? (kind === "categories" ? "Đã tạo chuyên mục." : "Đã tạo thẻ.") : "Đã lưu thay đổi.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]">
      <AdminCard className="overflow-hidden p-0">
        <header className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Cấu trúc phân loại</h2>
              <p className="mt-1 text-sm text-slate-600">Tổ chức bài viết để người đọc tìm nội dung nhanh hơn.</p>
            </div>
            <AdminButton onClick={() => (kind === "categories" ? selectCategory() : selectTag())}>
              <Plus aria-hidden="true" size={16} /> {kind === "categories" ? "Thêm chuyên mục" : "Thêm thẻ"}
            </AdminButton>
          </div>
          <div aria-label="Loại phân loại" className="mt-5 flex gap-2" role="tablist">
            <KindTab active={kind === "categories"} label={`Chuyên mục (${categories.length})`} onClick={() => changeKind("categories")} />
            <KindTab active={kind === "tags"} label={`Thẻ (${tags.length})`} onClick={() => changeKind("tags")} />
          </div>
        </header>

        <div className="grid gap-2 p-3">
          {kind === "categories" ? categories.map((item) => (
            <button
              className={item.id === activeId ? "rounded-xl border border-blue-300 bg-blue-50 p-3 text-left" : "rounded-xl border border-transparent p-3 text-left hover:bg-slate-50"}
              key={item.id}
              onClick={() => selectCategory(item)}
              style={{ marginLeft: `${Math.min(categoryDepth(categories, item), 3) * 14}px` }}
              type="button"
            >
              <span className="flex items-center gap-2"><FolderTree aria-hidden="true" className="text-blue-700" size={16} /><strong className="text-sm text-slate-950">{item.name}</strong></span>
              <span className="mt-1 block text-xs text-slate-500">/{item.slug} · Thứ tự {item.sortOrder}</span>
            </button>
          )) : tags.map((item) => (
            <button className={item.id === activeId ? "rounded-xl border border-blue-300 bg-blue-50 p-3 text-left" : "rounded-xl border border-transparent p-3 text-left hover:bg-slate-50"} key={item.id} onClick={() => selectTag(item)} type="button">
              <span className="flex items-center gap-2"><Tags aria-hidden="true" className="text-blue-700" size={16} /><strong className="text-sm text-slate-950">{item.name}</strong></span>
              <span className="mt-1 block text-xs text-slate-500">/{item.slug}</span>
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

      <AdminCard className="p-5 sm:p-7">
        {form ? (
          <form className="grid gap-6" onSubmit={save}>
            <header className="border-b border-slate-200 pb-5">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">{activeId ? "Chỉnh sửa" : "Tạo mới"}</p>
              <h2 className="mt-1 text-2xl font-extrabold text-slate-950">{kind === "categories" ? "Chuyên mục" : "Thẻ bài viết"}</h2>
              <p className={dirty ? "mt-1 text-sm font-semibold text-amber-700" : "mt-1 text-sm text-slate-600"}>{dirty ? "Có thay đổi chưa lưu." : "Mọi thay đổi đã được lưu."}</p>
            </header>

            {kind === "categories" && categoryForm ? (
              <>
                <Field label="Tên chuyên mục"><input onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required value={categoryForm.name} /></Field>
                <div className="grid gap-4 md:grid-cols-2">
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

            <footer className="admin-editor-actions flex-wrap">
              {dirty ? <AdminButton onClick={discardChanges} variant="secondary">Bỏ thay đổi</AdminButton> : null}
              <AdminButton disabled={busy || !dirty} type="submit">{busy ? "Đang lưu…" : "Lưu phân loại"}</AdminButton>
            </footer>
          </form>
        ) : (
          <AdminEmptyState
            action={<AdminButton onClick={() => (kind === "categories" ? selectCategory() : selectTag())}>{kind === "categories" ? "Thêm chuyên mục" : "Thêm thẻ"}</AdminButton>}
            description="Chọn một mục ở danh sách bên trái để chỉnh sửa hoặc tạo nội dung mới."
            icon={kind === "categories" ? <FolderTree aria-hidden="true" size={20} /> : <Tags aria-hidden="true" size={20} />}
            title="Chưa chọn nội dung"
          />
        )}
      </AdminCard>
    </div>
  );
}

function KindTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button aria-selected={active} className={active ? "rounded-full bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-800" : "rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200"} onClick={onClick} role="tab" type="button">{label}</button>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-bold text-slate-700"><span>{label}</span><span className="[&_input]:block [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-slate-300 [&_input]:px-3 [&_input]:py-2 [&_select]:block [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2 [&_textarea]:block [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:px-3 [&_textarea]:py-2">{children}</span></label>;
}

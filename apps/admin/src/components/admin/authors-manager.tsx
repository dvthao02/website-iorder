"use client";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { useWebsiteUrl } from "./website-origin-context";
import { toSlug } from "@/lib/slug";
import { authorInputSchema, authorPublicPath, type AdminAuthor } from "@iorder/shared/server/authors/authors.contract";
import { Plus, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { PostsSectionTabs } from "./posts-section-tabs";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminDataTable, type AdminDataTableColumn } from "./ui/admin-data-table";
import { AdminPagination } from "./ui/admin-pagination";
import { useClientPagination } from "./ui/use-client-pagination";
import { AdminEmptyState } from "./ui/admin-empty-state";
import { AdminFormField } from "./ui/admin-form-field";
import { useAdminConfirm } from "./ui/admin-confirm-dialog";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminListHeader } from "./ui/admin-list-header";
import { AdminListPage } from "./ui/admin-list-page";
import { useAdminPermissions } from "./ui/admin-permissions";
import { AdminRowEditIcon } from "./ui/admin-row-title";
import { AdminSidePanel } from "./ui/admin-side-panel";
import { useAdminClientReady } from "./ui/use-admin-client-ready";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { MediaPicker } from "./media-picker";

type AuthorForm = { name: string; slug: string; jobTitle: string; bio: string; avatarMediaId: string | null; profileUrl: string; isEnabled: boolean };

const blankForm: AuthorForm = { name: "", slug: "", jobTitle: "", bio: "", avatarMediaId: null, profileUrl: "", isEnabled: false };
const bioLimit = 2000;

function toForm(author: AdminAuthor): AuthorForm {
  return { name: author.name, slug: author.slug, jobTitle: author.jobTitle ?? "", bio: author.bio ?? "", avatarMediaId: author.avatarMediaId, profileUrl: author.profileUrl ?? "", isEnabled: author.isEnabled };
}

// Ô trống là "không có" (null) khi gửi lên.
function toPayload(form: AuthorForm) {
  return { name: form.name, slug: form.slug, jobTitle: form.jobTitle.trim() || null, bio: form.bio.trim() || null, avatarMediaId: form.avatarMediaId, profileUrl: form.profileUrl.trim() || null, isEnabled: form.isEnabled };
}

const equalForms = (first: AuthorForm | null, second: AuthorForm | null) => JSON.stringify(first) === JSON.stringify(second);

/**
 * Tác giả bài viết: hồ sơ công khai (tên, chức danh, tiểu sử, ảnh, trang cá nhân). Bài viết chọn tác giả từ đây; khi bật "Hiển thị trang tác giả"
 * và có bài đã xuất bản, website có trang riêng /author/<đường dẫn> liệt kê các bài của họ.
 */
export function AuthorsManager({ authors }: { authors: AdminAuthor[] }) {
  const router = useRouter();
  const ready = useAdminClientReady();
  const { confirm } = useAdminConfirm();
  const { show: showToast } = useAdminToast();
  const { can } = useAdminPermissions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<AuthorForm | null>(null);
  const [initialForm, setInitialForm] = useState<AuthorForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const mutationPending = useRef(false);
  // Phiên bản vừa lưu nhớ cục bộ vì props chỉ cập nhật sau router.refresh(); lấy giá trị lớn hơn để lưu liên tiếp không gửi version cũ.
  const [savedVersions, setSavedVersions] = useState<Record<string, number>>({});
  const active = activeId ? authors.find((item) => item.id === activeId) : undefined;
  const propVersion = active?.version;
  const localVersion = activeId ? savedVersions[activeId] : undefined;
  const activeVersion = propVersion === undefined ? localVersion : localVersion === undefined ? propVersion : Math.max(propVersion, localVersion);
  const dirty = !equalForms(form, initialForm);
  useNavigationGuard(dirty || busy, busy ? () => showToast("Đang xử lý tác giả. Vui lòng chờ trước khi rời trang.", "info") : undefined);

  const validation = useAdminFormValidation("authors", {
    name: { label: "Tên tác giả", message: "Nhập tên tác giả từ 1 đến 120 ký tự." },
    slug: { label: "Đường dẫn", message: "Đường dẫn tối đa 140 ký tự, chỉ gồm chữ không dấu viết thường, số và dấu gạch ngang giữa các từ." },
    jobTitle: { label: "Chức danh", message: "Chức danh không vượt quá 120 ký tự." },
    bio: { label: "Giới thiệu", message: `Giới thiệu không vượt quá ${bioLimit} ký tự.` },
    avatarMediaId: { label: "Ảnh đại diện", message: "Chọn lại ảnh đại diện." },
    profileUrl: { label: "Trang cá nhân", message: "Nhập địa chỉ bắt đầu bằng http:// hoặc https://." },
  });

  // Tác giả đang hiển thị cần quyền xuất bản để sửa hoặc xóa, như mọi nội dung đang hiện trên website.
  const lockedByLive = Boolean(active?.isEnabled) && !can("posts.publish");
  const canEdit = can(activeId ? "posts.update" : "posts.create") && !lockedByLive;
  const canToggleVisible = can("posts.publish");

  function allowSelectionChange() {
    if (mutationPending.current) { showToast("Đang xử lý tác giả. Vui lòng chờ trước khi chuyển mục.", "info"); return false; }
    if (dirty) { showToast("Bạn có thay đổi chưa lưu. Hãy lưu hoặc bỏ thay đổi trước khi chuyển mục.", "warning"); return false; }
    return true;
  }

  function select(author?: AdminAuthor) {
    if (!allowSelectionChange()) return;
    const values = author ? toForm(author) : { ...blankForm };
    validation.reset();
    setSaveError("");
    setSlugTouched(Boolean(author));
    setActiveId(author?.id ?? null);
    setForm(values);
    setInitialForm(values);
  }

  function closeEditor() {
    if (!allowSelectionChange()) return;
    setActiveId(null); setForm(null); setInitialForm(null);
  }

  function discardChanges() {
    if (mutationPending.current || !initialForm) return;
    validation.reset();
    setSaveError("");
    setSlugTouched(Boolean(activeId));
    setForm(initialForm);
    showToast("Đã bỏ các thay đổi chưa lưu.", "info");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !canEdit || !dirty || uploading || mutationPending.current) return;
    setSaveError("");
    const parsed = authorInputSchema.safeParse(toPayload(form));
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset();
    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/v1/admin/authors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: activeId, values: parsed.data, ...(activeVersion !== undefined ? { expectedVersion: activeVersion } : {}) }),
      });
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể lưu tác giả.");
      if (typeof body.id !== "string" || !body.id || (activeId && body.id !== activeId)) throw new Error("Phản hồi lưu tác giả không hợp lệ. Hãy kiểm tra lại dữ liệu trước khi thử lại.");
      const wasCreating = !activeId;
      const savedId: string = body.id;
      setSavedVersions((current) => ({ ...current, [savedId]: activeVersion === undefined ? 0 : activeVersion + 1 }));
      setActiveId(savedId);
      const saved: AuthorForm = { ...form, jobTitle: form.jobTitle.trim(), bio: form.bio.trim(), profileUrl: form.profileUrl.trim() };
      setForm(saved);
      setInitialForm(saved);
      showToast(wasCreating ? "Đã tạo tác giả." : "Đã lưu thay đổi.", "success");
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
    if (mutationPending.current || !activeId) return;
    if (dirty) { showToast("Hãy lưu hoặc bỏ thay đổi trước khi xóa.", "warning"); return; }
    if (!await confirm({ title: "Xác nhận xóa tác giả", message: "Xóa tác giả này khỏi CMS? Chỉ xóa được khi không còn bài viết nào dùng tác giả này. Thao tác không thể hoàn tác.", confirmLabel: "Xóa", tone: "danger" })) return;
    mutationPending.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/authors?id=${activeId}`, { method: "DELETE" });
      const body = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, "Không thể xóa tác giả.");
      if (body.deletedId !== activeId) throw new Error("Phản hồi xóa tác giả không hợp lệ. Hãy tải lại danh sách để kiểm tra.");
      setActiveId(null); setForm(null); setInitialForm(null);
      showToast("Đã xóa tác giả khỏi CMS.", "success");
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

  const columns: AdminDataTableColumn<AdminAuthor>[] = [
    { id: "name", label: "Tác giả", defaultWidth: 280, minWidth: 180, sortValue: (item) => item.name, cell: (item) => <span className="block truncate font-semibold">{item.name}</span> },
    { id: "jobTitle", label: "Chức danh", defaultWidth: 260, minWidth: 140, sortValue: (item) => item.jobTitle ?? "", cell: (item) => <span className="admin-text-muted block truncate">{item.jobTitle ?? "—"}</span> },
    { id: "posts", label: "Số bài", defaultWidth: 90, minWidth: 80, align: "right", sortValue: (item) => item.postCount, cell: (item) => <span className="admin-text-muted">{item.postCount}</span> },
    { id: "page", label: "Trang riêng", defaultWidth: 140, minWidth: 120, sortValue: (item) => Number(item.isEnabled), cell: (item) => <AdminStatusBadge tone={item.isEnabled ? "success" : "neutral"}>{item.isEnabled ? "Hiển thị" : "Đang ẩn"}</AdminStatusBadge> },
    { id: "actions", label: "Thao tác", defaultWidth: 110, minWidth: 100, align: "right", cell: () => <AdminRowEditIcon /> },
  ];

  const paged = useClientPagination(authors, "authors");
  const websiteUrl = useWebsiteUrl();
  const publicUrl = active && form?.slug ? websiteUrl(authorPublicPath(active.slug)) : null;

  return (
    <AdminListPage>
      <AdminCard>
        <AdminListHeader actions={<AdminButton hideWithoutPermission permission="posts.create" disabled={busy || !ready} leadingIcon={<Plus aria-hidden="true" size={16} />} onClick={() => select()}>Thêm tác giả</AdminButton>} description={`${authors.length} tác giả`} title="Tác giả" />
        <PostsSectionTabs active="authors" disabled={busy} />
        <>
          {authors.length ? <><AdminDataTable columns={columns} emptyMessage="Chưa có tác giả." getRowId={(item) => item.id} getRowLabel={(item) => item.name} onRowClick={select} rows={paged.rows} tableId="cms-authors" /><AdminPagination label="Phân trang tác giả" unit="tác giả" {...paged.pagination} /></> : (
            <AdminEmptyState
              action={<AdminButton hideWithoutPermission permission="posts.create" disabled={busy || !ready} onClick={() => select()}>Tạo tác giả đầu tiên</AdminButton>}
              description="Tác giả là người thật viết bài: có tên, chức danh, ảnh và trang riêng liệt kê các bài của họ. Bài viết có tác giả thật đáng tin hơn với người đọc và Google."
              icon={<UserRound aria-hidden="true" size={20} />}
              title="Chưa có tác giả"
            />
          )}
        </>
      </AdminCard>

      <AdminSidePanel
        footer={form ? <>
          <span className="admin-list-manager__footer-start">{activeId ? <AdminButton disabled={busy} hideWithoutPermission onClick={removeCurrent} permission="posts.delete" variant="danger">Xóa tác giả</AdminButton> : null}</span>
          {dirty ? <AdminButton disabled={busy} onClick={discardChanges} variant="secondary">Bỏ thay đổi</AdminButton> : null}
          <AdminButton disabled={busy || uploading || !dirty || !canEdit} form="authors-editor" type="submit">{busy ? "Đang lưu…" : "Lưu tác giả"}</AdminButton>
        </> : null}
        isOpen={form !== null}
        label="Biên tập tác giả"
        onClose={closeEditor}
      >
        {form ? (
          <form id="authors-editor" noValidate onSubmit={save}>
            <header className="admin-list-manager__panel-header">
              <p>{activeId ? "Chỉnh sửa" : "Tạo mới"}</p>
              <h2>Tác giả</h2>
              <small className={dirty ? "admin-list-manager__dirty" : undefined}>{busy ? "Đang xử lý tác giả…" : dirty ? "Có thay đổi chưa lưu." : activeId ? "Không có thay đổi chưa lưu." : "Nhập thông tin để tạo tác giả mới."}</small>
            </header>

            <fieldset className="admin-list-manager__form" disabled={busy || !canEdit}>
              {lockedByLive ? <AdminNotice tone="info">Trang tác giả đang hiển thị trên website: cần thêm quyền xuất bản để sửa.</AdminNotice> : !canEdit ? <AdminNotice tone="info">Bạn đang xem nội dung. Cần quyền sửa để lưu thay đổi.</AdminNotice> : null}
              {validation.summary}
              {saveError ? <AdminNotice tone="error">{saveError}</AdminNotice> : null}
              <AdminFormField id="authors-name" label="Tên tác giả" error={validation.message("name")}><input {...validation.props("name")} maxLength={120} onChange={(event) => setForm({ ...form, name: event.target.value, ...(!activeId && !slugTouched ? { slug: toSlug(event.target.value) } : {}) })} placeholder="Ví dụ: Nguyễn Văn An" required value={form.name} /></AdminFormField>
              <div className="admin-form-grid">
                <AdminFormField id="authors-jobTitle" label="Chức danh" error={validation.message("jobTitle")}><input {...validation.props("jobTitle")} maxLength={120} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} placeholder="Ví dụ: Chuyên viên triển khai iOrder" value={form.jobTitle} /></AdminFormField>
                <AdminFormField id="authors-slug" hint={`Địa chỉ trang tác giả: ${authorPublicPath(form.slug || "duong-dan")}. Đổi đường dẫn thì liên kết cũ không còn dùng được.`} label="Đường dẫn" error={validation.message("slug")}><input {...validation.props("slug")} maxLength={140} onChange={(event) => { setSlugTouched(true); setForm({ ...form, slug: event.target.value }); }} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="nguyen-van-an" required value={form.slug} /></AdminFormField>
              </div>
              <AdminFormField id="authors-bio" hint="2–4 câu về kinh nghiệm của người viết: làm gì, bao lâu, chuyên về mảng nào. Hiện ở đầu trang tác giả và giúp Google hiểu đây là một chuyên gia thật." label="Giới thiệu" error={validation.message("bio")}><textarea {...validation.props("bio")} maxLength={bioLimit} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={6} value={form.bio} /></AdminFormField>
              <div {...validation.props("avatarMediaId")} tabIndex={-1}><MediaPicker disabled={busy || !canEdit} label="Ảnh đại diện" onChange={(avatarMediaId) => setForm((current) => current ? { ...current, avatarMediaId } : current)} onUploadingChange={setUploading} value={form.avatarMediaId} />{validation.message("avatarMediaId")}</div>
              <AdminFormField id="authors-profileUrl" hint="Hồ sơ nghề nghiệp hoặc mạng xã hội của tác giả (LinkedIn, Facebook…). Giúp Google nhận ra đây là một người thật." label="Trang cá nhân (tùy chọn)" error={validation.message("profileUrl")}><input {...validation.props("profileUrl")} maxLength={2000} onChange={(event) => setForm({ ...form, profileUrl: event.target.value })} placeholder="https://www.linkedin.com/in/…" type="url" value={form.profileUrl} /></AdminFormField>
              <AdminFormField id="authors-isEnabled" hint={canToggleVisible ? "Trang riêng chỉ hiện khi tác giả có ít nhất một bài đã xuất bản. Đang ẩn thì bài vẫn ghi tên tác giả nhưng không có liên kết tới trang." : "Cần quyền xuất bản để bật hoặc tắt trang riêng của tác giả."} label="Trang riêng của tác giả"><select disabled={!canToggleVisible} onChange={(event) => setForm({ ...form, isEnabled: event.target.value === "yes" })} value={form.isEnabled ? "yes" : "no"}><option value="no">Đang ẩn</option><option value="yes">Hiển thị trên website</option></select></AdminFormField>
              {publicUrl && active?.isEnabled ? <p className="admin-help"><a href={publicUrl} rel="noreferrer" target="_blank">Xem trang tác giả trên website</a></p> : null}
            </fieldset>
          </form>
        ) : null}
      </AdminSidePanel>
    </AdminListPage>
  );
}

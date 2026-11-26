"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import type { ErrorLogItem, LogError } from "@iorder/shared/server/error-log/error-log.contract";
import { requestAdminJson } from "@/lib/admin-api";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";
import { AdminFilterBar, type AdminFilterChip } from "@/components/admin/ui/admin-filter-bar";
import { AdminPagination } from "@/components/admin/ui/admin-pagination";
import { AdminSearchField } from "@/components/admin/ui/admin-search-field";
import { AdminSidePanel } from "@/components/admin/ui/admin-side-panel";
import { AdminTypedConfirmDialog } from "@/components/admin/ui/admin-typed-confirm-dialog";
import { useAdminToast } from "@/components/admin/ui/admin-feedback";
import { useListNavigation } from "@/components/admin/ui/use-list-navigation";

const formatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });
const hint = "block break-all text-[length:var(--cms-text-xs)] font-normal text-[var(--cms-muted)]";
const count = (value: number) => value.toLocaleString("vi-VN");

/** Chuỗi lỗi từ lỗi bên ngoài tới lỗi gốc (logger giữ tối đa vài tầng `cause`): lỗi gốc thường là câu có ích nhất (ví dụ lỗi của PostgreSQL). */
function errorChain(error: LogError | undefined) {
  const chain: LogError[] = [];
  for (let current = error; current && chain.length < 6; current = current.cause) chain.push(current);
  return chain;
}

const place = (item: Pick<ErrorLogItem, "method" | "path">) => item.path ? `${item.method ?? ""} ${item.path}`.trim() : null;

function contextEntries(item: ErrorLogItem) {
  return Object.entries(item.details.context).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)] as const);
}

function ErrorLogDetail({ item, canManage, onDeleted }: { item: ErrorLogItem; canManage: boolean; onDeleted: () => void }) {
  const { show } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const chain = errorChain(item.details.error);
  const where = place(item);
  const context = contextEntries(item);

  async function remove() {
    setBusy(true);
    try {
      await requestAdminJson("/api/v1/admin/error-logs", "DELETE", { mode: "one", id: item.id }, "Không xóa được dòng này lúc này.");
      show("Đã xóa dòng khỏi nhật ký lỗi.", "success");
      onDeleted();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <dl className="admin-description-list grid-cols-1">
      <div><dt>Lỗi</dt><dd>{item.message}</dd></div>
      <div><dt>Xảy ra</dt><dd>{count(item.occurrences)} lần · lần đầu {formatter.format(item.firstSeenAt)} · gần nhất {formatter.format(item.lastSeenAt)}</dd></div>
      {where ? <div><dt>Nơi xảy ra</dt><dd><code className="break-all">{where}</code></dd></div> : null}
      <div><dt>Mã request (lần gần nhất)</dt><dd>{item.requestId ? <><code className="break-all">{item.requestId}</code><span className={hint}>Dùng để tra log máy chủ khi cần điều tra sâu hơn.</span></> : <span className="font-normal text-[var(--cms-muted)]">Không ghi nhận</span>}</dd></div>
      {item.errorMessage && !chain.length ? <div><dt>Chi tiết</dt><dd>{item.errorMessage}</dd></div> : null}
      {chain.map((error, index) => <div key={index}>
        <dt>{index === 0 ? "Lỗi kỹ thuật" : index === chain.length - 1 ? "Nguyên nhân gốc" : "Nguyên nhân"}</dt>
        <dd>{[error.name, error.code !== undefined ? `mã ${error.code}` : null].filter(Boolean).join(" · ")}{error.message ? <span className={hint}>{error.message}</span> : null}
          {error.constraint_name || error.table_name ? <span className={hint}>{[error.table_name ? `bảng ${error.table_name}` : null, error.column_name ? `cột ${error.column_name}` : null, error.constraint_name ? `ràng buộc ${error.constraint_name}` : null].filter(Boolean).join(" · ")}</span> : null}
          {error.stack?.length ? <pre className="admin-error-log__stack">{error.stack.join("\n")}</pre> : null}</dd>
      </div>)}
      {context.length ? <div><dt>Thông tin kèm theo</dt><dd>{context.map(([key, value]) => <span className={hint} key={key}><strong>{key}</strong>: {value}</span>)}</dd></div> : null}
    </dl>
    {canManage ? <div className="admin-status-tags"><AdminButton disabled={busy} leadingIcon={<Trash2 aria-hidden="true" size={16} />} onClick={() => void remove()} variant="secondary">{busy ? "Đang xóa…" : "Đã xử lý, xóa dòng này"}</AdminButton></div> : null}
  </>;
}

export function ErrorLogTable({ canManage, items, emptyMessage }: { canManage: boolean; items: ErrorLogItem[]; emptyMessage: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ErrorLogItem | null>(null);
  const { setSort, sort } = useListNavigation();
  const columns = useMemo<AdminDataTableColumn<ErrorLogItem>[]>(() => [
    { id: "lastSeenAt", label: "Lần gần nhất", defaultWidth: 150, minWidth: 140, sortKey: "lastSeenAt", sortFirst: "desc", cell: (item) => <span className="whitespace-nowrap text-[var(--cms-muted)]">{formatter.format(item.lastSeenAt)}</span> },
    { id: "message", label: "Lỗi", defaultWidth: 420, minWidth: 220, cell: (item) => <span className="text-sm"><span className="admin-error-log__summary">{item.message}</span>{item.errorMessage ? <span className="admin-error-log__path" title={item.errorMessage}>{item.errorMessage}</span> : null}</span> },
    { id: "place", label: "Nơi xảy ra", defaultWidth: 240, minWidth: 140, cell: (item) => <span className="admin-error-log__path" title={place(item) ?? undefined}>{place(item) ?? "—"}</span> },
    { id: "occurrences", label: "Số lần", defaultWidth: 90, minWidth: 80, align: "right", sortKey: "occurrences", cell: (item) => <span className="text-sm">{count(item.occurrences)}</span> },
  ], []);

  return <>
    <AdminDataTable columns={columns} emptyMessage={emptyMessage} getRowId={(item) => item.id} getRowLabel={(item) => `${item.message} lúc ${formatter.format(item.lastSeenAt)}`} onRowClick={setSelected} onSortChange={setSort} rows={items} sort={sort} tableId="error-log" />
    <AdminSidePanel isOpen={selected !== null} label="Chi tiết lỗi" onClose={() => setSelected(null)}>
      {selected ? <>
        <header className="admin-list-manager__panel-header">
          <p>Nhật ký lỗi</p>
          <h2>{selected.message}</h2>
        </header>
        <div className="admin-list-manager__form"><ErrorLogDetail canManage={canManage} item={selected} onDeleted={() => { setSelected(null); router.refresh(); }} /></div>
      </> : null}
    </AdminSidePanel>
  </>;
}

export function ErrorLogFilters({ initialQuery }: { initialQuery: string }) {
  const { navigate, setFilter } = useListNavigation();
  const [query, setQuery] = useState(initialQuery);
  const chips: AdminFilterChip[] = initialQuery ? [{ key: "query", label: `Từ khóa: “${initialQuery}”`, onRemove: () => { setQuery(""); setFilter("query", undefined); } }] : [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ page: undefined, query: query.trim() || undefined });
  }
  return <AdminFilterBar chips={chips} onClearAll={() => { setQuery(""); navigate({ page: undefined, query: undefined }); }} onSubmit={submit} search={<AdminSearchField label="Tìm lỗi, đường dẫn hoặc mã request" maxLength={160} onChange={(event) => setQuery(event.target.value)} placeholder="Lỗi, đường dẫn, mã request" value={query} />} />;
}

export function ErrorLogPagination({ page, pageSize, total, totalPages }: { page: number; pageSize: number; total: number; totalPages: number }) {
  const { pagination } = useListNavigation();
  return <AdminPagination unit="lỗi" label="Phân trang nhật ký lỗi" page={page} pageSize={pageSize} total={total} totalPages={totalPages} {...pagination} />;
}

/** Nút "Xóa nhật ký lỗi" (chỉ Super Admin): xóa toàn bộ để bắt đầu lại sau khi đã sửa lỗi; có ghi một dòng vào Nhật ký hoạt động. */
export function ErrorLogClearButton({ total }: { total: number }) {
  const router = useRouter();
  const { show } = useAdminToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const result = await requestAdminJson("/api/v1/admin/error-logs", "DELETE", { mode: "all" }, "Không xóa được nhật ký lỗi lúc này.") as { affected?: number } | null;
      show(`Đã xóa ${count(result?.affected ?? 0)} lỗi khỏi nhật ký.`, "success");
      setOpen(false);
      router.refresh();
    } catch (error) {
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <AdminButton disabled={total === 0} leadingIcon={<Trash2 aria-hidden="true" size={16} />} onClick={() => setOpen(true)} variant="secondary">Xóa nhật ký lỗi</AdminButton>
    {open ? <AdminTypedConfirmDialog busy={busy} confirmLabel={`Xóa ${count(total)} lỗi`} onClose={() => !busy && setOpen(false)} onConfirm={() => void confirm()} title="Xóa toàn bộ nhật ký lỗi?" word="xóa">
      <p className="admin-purge__count">Sẽ xóa <strong>{count(total)}</strong> lỗi đã ghi. Không hoàn tác được; lỗi nào còn xảy ra sẽ được ghi lại từ đầu.</p>
      <p className="admin-help">Việc xóa được ghi vào Nhật ký hoạt động (ai xóa, lúc nào, bao nhiêu lỗi).</p>
    </AdminTypedConfirmDialog> : null}
  </>;
}

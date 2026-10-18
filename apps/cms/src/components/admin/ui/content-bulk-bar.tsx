"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";

import type { CmsModuleKey, CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import { AdminBulkBar } from "./admin-bulk-bar";
import { AdminButton } from "./admin-button";
import { useAdminPermissions } from "./admin-permissions";
import { useBulkAction } from "./use-bulk-action";

type BulkRequest = { url: string; method: "PATCH" | "DELETE" | "POST"; body?: unknown };

/** Lựa chọn dòng tự xóa khi đổi trang/bộ lọc/sắp xếp (resetKey đổi), không cần effect. */
export function useRowSelection(resetKey: string) {
  const [state, setState] = useState<{ key: string; ids: string[] }>({ key: resetKey, ids: [] });
  const selectedIds = state.key === resetKey ? state.ids : [];
  return { selectedIds, setSelectedIds: (ids: string[]) => setState({ key: resetKey, ids }), clear: () => setState({ key: resetKey, ids: [] }) };
}

/** Lưu trữ/khôi phục hàng loạt cho nội dung có vòng đời (bài viết, sản phẩm, thiết bị, trang). */
export function ContentBulkBar<Item extends { id: string; status: string }>({ items, selectedIds, onClear, module, noun, request }: {
  items: Item[];
  selectedIds: readonly string[];
  onClear: () => void;
  module: CmsModuleKey;
  noun: string;
  request: (item: Item, action: "archive" | "restore") => BulkRequest;
}) {
  const { can } = useAdminPermissions();
  const { busy, run } = useBulkAction();
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const archivable = selected.filter((item) => item.status !== "archived");
  const restorable = selected.filter((item) => item.status === "archived");
  // Khớp API: đổi trạng thái cần cả quyền sửa lẫn quyền xuất bản.
  const allowed = can(`${module}.update` as CmsPermissionCode) && can(`${module}.publish` as CmsPermissionCode);

  return <AdminBulkBar count={selected.length} onClear={onClear}>
    {allowed ? <>
      <AdminButton disabled={busy || archivable.length === 0} leadingIcon={<Archive aria-hidden="true" size={15} />} onClick={() => run({ items: archivable, request: (item) => request(item, "archive"), verb: "Lưu trữ", noun, confirmMessage: "Nội dung lưu trữ sẽ ẩn khỏi website; có thể khôi phục lại bất cứ lúc nào.", onDone: onClear })} size="sm" variant="secondary">Lưu trữ{archivable.length ? ` (${archivable.length})` : ""}</AdminButton>
      <AdminButton disabled={busy || restorable.length === 0} leadingIcon={<ArchiveRestore aria-hidden="true" size={15} />} onClick={() => run({ items: restorable, request: (item) => request(item, "restore"), verb: "Khôi phục", noun, onDone: onClear })} size="sm" variant="secondary">Khôi phục{restorable.length ? ` (${restorable.length})` : ""}</AdminButton>
      {busy ? <span className="admin-text-muted">Đang xử lý…</span> : null}
    </> : <span className="admin-text-muted">Cần quyền sửa và xuất bản để lưu trữ hoặc khôi phục hàng loạt.</span>}
  </AdminBulkBar>;
}

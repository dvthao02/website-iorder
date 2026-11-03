"use client";

import { Archive, ArchiveRestore, Send, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";

import type { CmsModuleKey, CmsPermissionCode } from "@iorder/core/server/auth/permissions";
import type { TransferDatasetId } from "@iorder/core/server/data-transfer/data-transfer.contract";
import type { ContentStateAction } from "@iorder/core/server/shared/content-version";
import { AdminBulkBar } from "./admin-bulk-bar";
import { AdminBulkMenu, type AdminBulkMenuAction } from "./admin-bulk-menu";
import { AdminFileIcon } from "./admin-file-icon";
import { useAdminPermissions } from "./admin-permissions";
import { useBulkAction } from "./use-bulk-action";

type BulkRequest = { url: string; method: "PATCH" | "DELETE" | "POST"; body?: unknown };

/** Lựa chọn dòng tự xóa khi đổi trang/bộ lọc/sắp xếp (resetKey đổi), không cần effect. */
export function useRowSelection(resetKey: string) {
  const [state, setState] = useState<{ key: string; ids: string[] }>({ key: resetKey, ids: [] });
  const selectedIds = state.key === resetKey ? state.ids : [];
  return { selectedIds, setSelectedIds: (ids: string[]) => setState({ key: resetKey, ids }), clear: () => setState({ key: resetKey, ids: [] }) };
}

/** Thao tác hàng loạt cho nội dung có vòng đời (bài viết, sản phẩm, thiết bị, trang): menu "Thao tác" gồm xuất bản,
 * chuyển về nháp, lưu trữ, khôi phục, xuất Excel các mục đã chọn và xóa mục đã lưu trữ. */
export function ContentBulkBar<Item extends { id: string; status: string }>({ items, selectedIds, onClear, module, noun, request, deleteRequest, exportDataset, exportUnavailable }: {
  items: Item[];
  selectedIds: readonly string[];
  onClear: () => void;
  module: CmsModuleKey;
  noun: string;
  request: (item: Item, action: ContentStateAction) => BulkRequest;
  /** Xóa vĩnh viễn (chỉ mục đã lưu trữ), như nút thùng rác trên từng dòng. */
  deleteRequest?: (item: Item) => BulkRequest;
  /** Bảng xuất/nhập của màn này: thêm "Xuất Excel các mục đã chọn". */
  exportDataset?: TransferDatasetId;
  /** Khi màn trộn nhiều bảng (ví dụ tab "Tất cả" sản phẩm): lý do chưa xuất được. */
  exportUnavailable?: string;
}) {
  const { can } = useAdminPermissions();
  const { busy, run } = useBulkAction();
  const selected = items.filter((item) => selectedIds.includes(item.id));
  const archivable = selected.filter((item) => item.status !== "archived");
  const restorable = selected.filter((item) => item.status === "archived");
  // Xuất bản ngay: chỉ mục đang nháp/chờ duyệt/hẹn giờ; mục lưu trữ phải khôi phục trước.
  const publishable = selected.filter((item) => item.status === "draft" || item.status === "review" || item.status === "scheduled");
  const unpublishable = selected.filter((item) => item.status === "published" || item.status === "scheduled" || item.status === "review");
  // Khớp API: đổi trạng thái cần cả quyền sửa lẫn quyền xuất bản; xóa cần quyền xóa.
  const stateDenied = can(`${module}.update` as CmsPermissionCode) && can(`${module}.publish` as CmsPermissionCode) ? undefined : "Cần quyền sửa và xuất bản.";
  const deleteDenied = can(`${module}.delete` as CmsPermissionCode) ? undefined : "Cần quyền xóa.";
  const state = (action: ContentStateAction, list: Item[], verb: string, confirmMessage?: string) => () => void run({ items: list, request: (item) => request(item, action), verb, noun, confirmMessage, onDone: onClear });

  const actions: AdminBulkMenuAction[] = [
    { key: "publish", label: "Xuất bản", icon: <Send aria-hidden="true" />, count: publishable.length, disabledReason: stateDenied, onSelect: state("publish", publishable, "Xuất bản", "Các mục sẽ hiện ngay trên website với nội dung đã lưu. Mục hẹn giờ sẽ được xuất bản luôn, không chờ tới giờ hẹn.") },
    { key: "unpublish", label: "Chuyển về nháp", icon: <Undo2 aria-hidden="true" />, count: unpublishable.length, disabledReason: stateDenied, onSelect: state("unpublish", unpublishable, "Chuyển về nháp", "Các mục đang hiển thị sẽ ẩn khỏi website và trở về bản nháp; mục hẹn giờ sẽ không tự đăng nữa.") },
    { key: "archive", label: "Lưu trữ", icon: <Archive aria-hidden="true" />, count: archivable.length, disabledReason: stateDenied, onSelect: state("archive", archivable, "Lưu trữ", "Nội dung lưu trữ sẽ ẩn khỏi website; có thể khôi phục lại bất cứ lúc nào.") },
    { key: "restore", label: "Khôi phục", icon: <ArchiveRestore aria-hidden="true" />, count: restorable.length, disabledReason: stateDenied, onSelect: state("restore", restorable, "Khôi phục") },
  ];
  if (exportDataset || exportUnavailable) actions.push({ key: "export", label: "Xuất Excel", icon: <AdminFileIcon action="export" kind="excel" size="sm" />, count: selected.length, disabledReason: exportDataset ? undefined : exportUnavailable, href: exportDataset ? `/api/admin/data-transfer/${exportDataset}?format=xlsx&ids=${selected.map((item) => item.id).join(",")}` : undefined });
  if (deleteRequest) actions.push({ key: "delete", label: "Xóa vĩnh viễn", icon: <Trash2 aria-hidden="true" />, count: restorable.length, disabledReason: deleteDenied ?? (restorable.length ? undefined : "Chỉ xóa được mục đã lưu trữ."), tone: "danger", onSelect: () => void run({ items: restorable, request: deleteRequest, verb: "Xóa vĩnh viễn", noun, confirmMessage: "Các mục đã lưu trữ sẽ bị xóa khỏi CMS. Thao tác không thể hoàn tác.", tone: "danger", onDone: onClear }) });

  return <AdminBulkBar count={selected.length} onClear={onClear}><AdminBulkMenu actions={actions} busy={busy} /></AdminBulkBar>;
}

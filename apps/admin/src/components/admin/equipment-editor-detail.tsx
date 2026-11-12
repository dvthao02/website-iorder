"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EquipmentEditor, type EquipmentGroup, type EquipmentItem } from "@/components/admin/equipment-editor";
import { AdminDetailPanel } from "@/components/admin/ui/admin-detail-panel";
import { AdminNotice, useAdminToast } from "@/components/admin/ui/admin-feedback";
import { contentSavedMessage } from "@/components/admin/ui/content-status-choice";

type EquipmentEditorDetailProps = {
  groups: EquipmentGroup[];
  item?: EquipmentItem;
};

export function EquipmentEditorDetail({ groups, item }: EquipmentEditorDetailProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { show: showToast } = useAdminToast();
  const title = item?.name ?? "Thêm thiết bị";
  const description = item ? "Chỉnh sửa thông tin, thông số kỹ thuật, xuất bản và SEO của thiết bị." : "Hoàn thiện thông tin rồi lưu để tạo thiết bị mới.";

  return <AdminDetailPanel backHref="/admin/equipment" description={description} eyebrow="Thiết bị" hasUnsavedChanges={hasUnsavedChanges} notice={notice ? <AdminNotice tone="error">{notice}</AdminNotice> : undefined} title={title}><EquipmentEditor groups={groups} item={item} key={item?.id ?? "new"} onDirtyChange={setHasUnsavedChanges} onError={(message) => { setNotice(message); showToast(message, "error"); }} onSaved={(savedId, created, status) => { setNotice(undefined); showToast(contentSavedMessage(status, item?.status, "thiết bị"), "success"); if (created) router.replace(`/admin/equipment/${savedId}`); router.refresh(); }} /></AdminDetailPanel>;
}

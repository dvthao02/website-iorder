"use client";

import { EquipmentManager, type EquipmentGroup, type EquipmentItem } from "@/components/admin/equipment-manager";
import { PublishedPreviewLink } from "@/components/admin/published-preview-link";
import { AdminDetailPanel } from "@/components/admin/ui/admin-detail-panel";

type EquipmentEditorDetailProps = {
  groups: EquipmentGroup[];
  item?: EquipmentItem;
  startCreatingItem?: boolean;
};

export function EquipmentEditorDetail({ groups, item, startCreatingItem = false }: EquipmentEditorDetailProps) {
  const title = item?.name ?? "Thêm thiết bị";
  const description = item ? "Chỉnh sửa thông tin, thông số kỹ thuật, xuất bản và SEO của thiết bị." : "Hoàn thiện thông tin rồi lưu để tạo thiết bị mới.";

  return <AdminDetailPanel actions={<PublishedPreviewLink kind="equipment" slug={item?.slug} status={item?.status} />} backHref="/admin/thiet-bi" description={description} eyebrow="Thiết bị" title={title}><EquipmentManager groups={groups} hideEditorHeader hideNavigation initialItemId={item?.id} items={item ? [item] : []} startCreatingItem={startCreatingItem} /></AdminDetailPanel>;
}

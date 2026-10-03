"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { OfferingEditor } from "@/components/admin/cms-content-manager";
import { PublishedPreviewLink } from "@/components/admin/published-preview-link";
import type { AdminOffering, PublicOfferingType } from "@iorder/core/server/offerings/offering-content.contract";
import { AdminDetailPanel } from "@/components/admin/ui/admin-detail-panel";
import { AdminNotice, useAdminToast } from "@/components/admin/ui/admin-feedback";

type OfferingEditorDetailProps = {
  backHref: string;
  offering?: AdminOffering;
  offeringType: PublicOfferingType;
  offeringTypeLabel: string;
};

export function OfferingEditorDetail({ backHref, offering, offeringType, offeringTypeLabel }: OfferingEditorDetailProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string>();
  const { show: showToast } = useAdminToast();

  const editorTitle = offering?.title ?? `Tạo ${offeringTypeLabel.toLocaleLowerCase("vi")}`;
  const editorDescription = offering ? `Chỉnh sửa nội dung, xuất bản và SEO của ${offeringTypeLabel.toLocaleLowerCase("vi")}.` : `Hoàn thiện thông tin rồi lưu để tạo ${offeringTypeLabel.toLocaleLowerCase("vi")}.`;

  return <AdminDetailPanel actions={<PublishedPreviewLink contentType={offering?.type} kind="offering" slug={offering?.slug} status={offering?.status} />} backHref={backHref} description={editorDescription} eyebrow={offeringTypeLabel} notice={notice ? <AdminNotice tone="error">{notice}</AdminNotice> : undefined} title={editorTitle}><OfferingEditor offering={offering} offeringType={offeringType} offeringTypeLabel={offeringTypeLabel} onError={(message) => { setNotice(message); showToast(message, "error"); }} onSaved={(saved) => { setNotice(undefined); showToast(offering ? "Đã lưu thay đổi." : "Đã tạo nội dung mới.", "success"); router.replace(`${backHref}/${saved.id}`); router.refresh(); }} /></AdminDetailPanel>;
}

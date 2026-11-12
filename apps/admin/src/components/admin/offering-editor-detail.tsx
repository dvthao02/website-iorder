"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { OfferingEditor } from "@/components/admin/cms-content-manager";
import type { AdminOffering, PublicOfferingType } from "@iorder/shared/server/offerings/offering-content.contract";
import { AdminDetailPanel } from "@/components/admin/ui/admin-detail-panel";
import { AdminNotice, useAdminToast } from "@/components/admin/ui/admin-feedback";
import { contentSavedMessage } from "@/components/admin/ui/content-status-choice";

type OfferingEditorDetailProps = {
  backHref: string;
  offering?: AdminOffering;
  offeringType: PublicOfferingType;
  offeringTypeLabel: string;
};

export function OfferingEditorDetail({ backHref, offering, offeringType, offeringTypeLabel }: OfferingEditorDetailProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { show: showToast } = useAdminToast();

  const editorTitle = offering?.title ?? `Tạo ${offeringTypeLabel.toLocaleLowerCase("vi")}`;
  const editorDescription = offering ? `Chỉnh sửa nội dung, xuất bản và SEO của ${offeringTypeLabel.toLocaleLowerCase("vi")}.` : `Hoàn thiện thông tin rồi lưu để tạo ${offeringTypeLabel.toLocaleLowerCase("vi")}.`;

  return <AdminDetailPanel backHref={backHref} description={editorDescription} eyebrow={offeringTypeLabel} hasUnsavedChanges={hasUnsavedChanges} notice={notice ? <AdminNotice tone="error">{notice}</AdminNotice> : undefined} title={editorTitle}><OfferingEditor key={`${offeringType}:${offering?.id ?? "new"}`} offering={offering} offeringType={offeringType} offeringTypeLabel={offeringTypeLabel} onDirtyChange={setHasUnsavedChanges} onError={(message) => { setNotice(message); showToast(message, "error"); }} onSaved={(saved) => { setNotice(undefined); showToast(contentSavedMessage(saved.status, offering?.status, offeringTypeLabel.toLocaleLowerCase("vi")), "success"); router.replace(`${backHref}/${saved.id}`); router.refresh(); }} /></AdminDetailPanel>;
}

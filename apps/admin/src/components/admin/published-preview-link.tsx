"use client";

import { useState } from "react";

import { getFixedWebsitePage } from "@iorder/shared/server/pages/pages.contract";
import { requestAdminJson } from "@/lib/admin-api";
import { useWebsiteUrl } from "./website-origin-context";
import { useAdminToast } from "./ui/admin-feedback";

type PublishedPreviewLinkProps = {
  kind: "page" | "post" | "offering" | "equipment";
  status: string | undefined;
  slug: string | undefined;
  contentType?: string | undefined;
  /** Có id thì xem trước được bản nháp (trang, bài viết, sản phẩm/giải pháp/dịch vụ). */
  id?: string | undefined;
};

export const offeringCatalogPaths: Record<string, string> = {
  software: "/software",
  solution: "/solutions",
};

function getPublicPath({ kind, slug, contentType }: Omit<PublishedPreviewLinkProps, "status" | "id">) {
  if (!slug) return null;
  if (kind === "page") return getFixedWebsitePage(slug)?.publicPath ?? `/pages/${slug}`;
  if (kind === "post") return contentType === "guide" ? `/support/guides/${slug}` : `/news/${slug}`;
  if (kind === "equipment") return `/equipment/${slug}`;
  const catalogPath = contentType ? offeringCatalogPaths[contentType] : undefined;
  return catalogPath ? `${catalogPath}/${slug}` : null;
}

/** Nội dung đã xuất bản: mở trang công khai. Chưa xuất bản: xem trước bản đã lưu qua liên kết ký tạm (1 giờ). */
export function PublishedPreviewLink({ kind, status, slug, contentType, id }: PublishedPreviewLinkProps) {
  const { show } = useAdminToast();
  const websiteUrl = useWebsiteUrl();
  const [busy, setBusy] = useState(false);
  const path = getPublicPath({ kind, slug, contentType });

  if (status === "published") {
    return path ? <a className="published-preview-link" href={websiteUrl(path)} rel="noreferrer" target="_blank">Mở trang đã xuất bản ↗</a> : null;
  }
  if (!id || kind === "equipment") return null;

  async function openPreview() {
    if (busy) return;
    // Mở tab ngay trong sự kiện bấm để trình duyệt không chặn cửa sổ bật lên, rồi mới gán địa chỉ.
    const tab = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const payload = await requestAdminJson("/api/v1/admin/preview", "POST", { kind, id }, "Không tạo được liên kết xem trước.") as { token?: string } | null;
      if (!payload?.token) throw new Error("Không tạo được liên kết xem trước.");
      const url = websiteUrl(`/api/preview?token=${encodeURIComponent(payload.token)}`);
      if (tab) { tab.opener = null; tab.location.href = url; } else window.open(url, "_blank", "noopener");
    } catch (error) {
      tab?.close();
      show(error instanceof Error ? error.message : "Không kết nối được máy chủ.", "error");
    } finally {
      setBusy(false);
    }
  }

  return <button className="published-preview-link" disabled={busy} onClick={() => void openPreview()} title="Xem bản đã lưu trên website như khách sẽ thấy; liên kết hết hạn sau 1 giờ" type="button">{busy ? "Đang mở…" : "Xem trước bản nháp ↗"}</button>;
}

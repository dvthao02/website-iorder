"use client";

import { useState } from "react";

import { getFixedWebsitePage } from "@iorder/core/server/pages/pages.contract";
import { adminApiError } from "@/lib/admin-api";
import { publishedPublicUrl } from "@/lib/published-public-url";
import { useAdminToast } from "./ui/admin-feedback";

type PublishedPreviewLinkProps = {
  kind: "page" | "post" | "offering" | "equipment";
  status: string | undefined;
  slug: string | undefined;
  contentType?: string | undefined;
  /** Có id thì xem trước được bản nháp (trang, bài viết, sản phẩm/giải pháp/dịch vụ). */
  id?: string | undefined;
};

const offeringCatalogPaths: Record<string, string> = {
  software: "/phan-mem",
  solution: "/giai-phap",
  service: "/dich-vu",
};

function getPublicPath({ kind, slug, contentType }: Omit<PublishedPreviewLinkProps, "status" | "id">) {
  if (!slug) return null;
  if (kind === "page") return getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}`;
  if (kind === "post") return contentType === "guide" ? `/ho-tro/cai-dat/${slug}` : `/tin-tuc/${slug}`;
  if (kind === "equipment") return `/thiet-bi/${slug}`;
  const catalogPath = contentType ? offeringCatalogPaths[contentType] : undefined;
  return catalogPath ? `${catalogPath}/${slug}` : null;
}

/** Nội dung đã xuất bản: mở trang công khai. Chưa xuất bản: xem trước bản đã lưu qua liên kết ký tạm (1 giờ). */
export function PublishedPreviewLink({ kind, status, slug, contentType, id }: PublishedPreviewLinkProps) {
  const { show } = useAdminToast();
  const [busy, setBusy] = useState(false);
  const path = getPublicPath({ kind, slug, contentType });

  if (status === "published") {
    return path ? <a className="published-preview-link" href={publishedPublicUrl(path)} rel="noreferrer" target="_blank">Mở trang đã xuất bản ↗</a> : null;
  }
  if (!id || kind === "equipment") return null;

  async function openPreview() {
    if (busy) return;
    // Mở tab ngay trong sự kiện bấm để trình duyệt không chặn cửa sổ bật lên, rồi mới gán địa chỉ.
    const tab = window.open("about:blank", "_blank");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id }) });
      const payload = await response.json().catch(() => null) as { token?: string } | null;
      if (!response.ok || !payload?.token) throw adminApiError(payload, "Không tạo được liên kết xem trước.");
      const url = publishedPublicUrl(`/api/preview?token=${encodeURIComponent(payload.token)}`);
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

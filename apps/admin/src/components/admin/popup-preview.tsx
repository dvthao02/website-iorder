"use client";

import { ArrowRight, ExternalLink, ImageOff, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

import { readAdminJson } from "@/lib/admin-api";
import { mediaAssetSchema } from "@iorder/shared/server/media/media.contract";
import { isPopupExternalLink, type ConsultFormSettings, type PromotionPopupSettings } from "@iorder/shared/server/settings/consult-popup.contract";
import { consultPopupPromoLayout, consultPopupPromoPresentation } from "@iorder/shared/server/settings/consult-popup.presentation";

// Mô phỏng cách website hiển thị hộp (consult-popup-dialog.tsx). Việc "ảnh nào hiện, nút nào hiện" dùng chung hàm với website
// nên không lệch; phần màu và cỡ chữ cố ý giữ theo giao diện website (nền trắng, xanh thương hiệu), không theo giao diện CMS.

type PreviewImage = { url: string; width: number | null; height: number | null };
type FetchedImage = { id: string; image: PreviewImage | null };

/** Ảnh của một tệp trong Thư viện; null khi chưa chọn, đang tải hoặc không tải được. */
function usePreviewImage(mediaId: string | null) {
  const [fetched, setFetched] = useState<FetchedImage | null>(null);
  useEffect(() => {
    if (!mediaId) return;
    const controller = new AbortController();
    fetch(`/api/v1/admin/media/${encodeURIComponent(mediaId)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await readAdminJson(response);
        const asset = mediaAssetSchema.safeParse(response.ok ? payload?.asset : null);
        setFetched({ id: mediaId, image: asset.success && asset.data.mimeType.startsWith("image/") ? { url: asset.data.url, width: asset.data.width ?? null, height: asset.data.height ?? null } : null });
      })
      .catch(() => { if (!controller.signal.aborted) setFetched({ id: mediaId, image: null }); });
    return () => controller.abort();
  }, [mediaId]);
  return mediaId && fetched?.id === mediaId ? fetched.image : null;
}

function Stage({ bar = false, children, label }: { bar?: boolean; children: ReactNode; label: string }) {
  return <figure className="popup-preview" data-testid="popup-preview">
    <figcaption><strong>Xem trước</strong><span>Mô phỏng trên máy tính, cập nhật ngay khi bạn nhập.</span></figcaption>
    <div aria-label={label} className="popup-preview__stage" data-bar={bar ? "true" : "false"} role="img">
      <span aria-hidden="true" className="popup-preview__page"><i /><i /><i /><i /></span>
      {children}
    </div>
  </figure>;
}

const closeButton = <span aria-hidden="true" className="popup-preview__close"><X size={11} /></span>;

function Copy({ description, title }: { description: string | null; title: string }) {
  return <div className="popup-preview__copy"><strong>{title}</strong>{description ? <p>{description}</p> : null}</div>;
}

export function PromotionPreview({ value }: { value: PromotionPopupSettings }) {
  const image = usePreviewImage(value.mediaId);
  const layout = consultPopupPromoLayout(value.layout, image !== null);
  const actionLabel = consultPopupPromoPresentation(value).actionLabel;
  const title = value.title.trim() || "Tiêu đề quảng cáo";
  const description = value.description?.trim() || null;
  const external = value.actionUrl ? isPopupExternalLink(value.actionUrl) : false;
  const label = `Quảng cáo kiểu ${value.layout}: ${title}`;

  if (value.layout === "image") {
    return <Stage label={label}>
      <div className="popup-preview__banner" style={image?.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}>
        {image ? <Image alt="" className="popup-preview__banner-image" fill sizes="260px" src={image.url} /> : <span className="popup-preview__empty"><ImageOff aria-hidden="true" size={22} />Chọn ảnh quảng cáo để xem trước</span>}
        {closeButton}
      </div>
    </Stage>;
  }

  // Bố cục chia đôi cần ảnh: chưa chọn thì vẫn chừa chỗ và nhắc, để người dùng thấy ngay bố cục thiếu gì.
  const showMedia = layout.showImage || (value.layout === "split" && !image);
  return <Stage bar={layout.bar} label={label}>
    <div className={`popup-preview__panel popup-preview__panel--${value.layout}`}>
      {closeButton}
      {showMedia ? <div className="popup-preview__media">{image
        ? <Image alt="" className="popup-preview__media-image" fill sizes="200px" src={image.url} />
        : <span className="popup-preview__empty"><ImageOff aria-hidden="true" size={18} />Chưa chọn ảnh</span>}</div> : null}
      <div className="popup-preview__body">
        <Copy description={description} title={title} />
        <div className="popup-preview__actions">
          <span className="popup-preview__button">{actionLabel}{external ? <ExternalLink aria-hidden="true" size={10} /> : <ArrowRight aria-hidden="true" size={10} />}</span>
          {layout.bar ? null : <span className="popup-preview__ghost">Để sau</span>}
        </div>
      </div>
    </div>
  </Stage>;
}

export function ConsultFormPreview({ value }: { value: ConsultFormSettings }) {
  const title = value.title.trim() || "Tiêu đề biểu mẫu";
  const description = value.description?.trim() || null;
  const needs = value.needOptions.map((option) => option.trim()).filter(Boolean);
  return <Stage label={`Biểu mẫu tư vấn: ${title}`}>
    <div className="popup-preview__panel popup-preview__panel--form">
      {closeButton}
      <div className="popup-preview__body">
        <small className="popup-preview__eyebrow">Tư vấn iOrder</small>
        <Copy description={description} title={title} />
        <span className="popup-preview__field"><small>Họ và tên</small><i>Nguyễn Văn A</i></span>
        <span className="popup-preview__field"><small>Số điện thoại</small><i>09xx xxx xxx</i></span>
        {needs.length ? <span className="popup-preview__field"><small>Nhu cầu chính</small><i>Chọn nhu cầu <em>({needs.length} lựa chọn)</em></i></span> : null}
        <span className="popup-preview__button popup-preview__button--block">{value.submitLabel.trim() || "Gửi"}</span>
      </div>
    </div>
  </Stage>;
}

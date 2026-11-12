import { SiteHeader } from "@/components/site/site-header";
import { SiteStatusMessage } from "@/components/site/site-status-message";

export default function PublicNotFound() {
  return <><SiteHeader /><SiteStatusMessage description="Trang bạn tìm có thể đã được đổi địa chỉ, ngừng xuất bản hoặc chưa từng tồn tại." eyebrow="Lỗi 404" title="Không tìm thấy trang" /></>;
}

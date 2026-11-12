import { SiteStatusMessage } from "@/components/site/site-status-message";

// URL không khớp route nào nằm ngoài nhóm (web); vẫn trả trang 404 tiếng Việt thay vì trang mặc định.
export default function RootNotFound() {
  return <SiteStatusMessage description="Trang bạn tìm có thể đã được đổi địa chỉ, ngừng xuất bản hoặc chưa từng tồn tại." eyebrow="Lỗi 404" title="Không tìm thấy trang" />;
}

import { permanentRedirect } from "next/navigation";

// Hướng dẫn sử dụng đã tách khỏi trang Hỗ trợ cài đặt: giữ liên kết cũ đã được chia sẻ/Google index.
export default async function LegacySupportGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  permanentRedirect(`/ho-tro/huong-dan/${encodeURIComponent((await params).slug)}`);
}

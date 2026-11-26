import type { PageBlock } from "@iorder/shared/server/pages/pages.contract";
import { getBuilderPreviewContext } from "@/lib/builder-preview";
import { DocumentGrid, type DocumentCard } from "./document-grid";
import { loadBlockImages } from "./section-blocks";

type DocumentItem = Extract<PageBlock, { type: "features" | "industries" | "ecosystem" | "process" }>["data"]["items"][number];

// Kiểu thẻ "Giấy tờ, chứng nhận": mỗi thẻ dùng ảnh đầu tiên (bản chụp giấy tờ), tiêu đề và dòng mô tả ngắn. Thẻ chưa có ảnh vẫn hiện
// (khung trống kèm biểu tượng tệp) để người soạn thấy thẻ khi mới thêm.
export async function DocumentCards({ items, first = false }: { items: DocumentItem[]; first?: boolean }) {
  const photos = await Promise.all(items.map(async item => (await loadBlockImages([item.mediaId]))[0] ?? null));
  // Khối ở màn hình đầu tiên (và khung xem trước CMS, cuộn thẳng tới khối đang chọn) tải ảnh ngay thay vì lazy.
  const eager = first || Boolean(await getBuilderPreviewContext());
  const cards: DocumentCard[] = items.map((item, index) => {
    const photo = photos[index];
    return { title: item.title, caption: item.description || null, href: item.href, image: photo ? { url: photo.url, alt: photo.altText ?? item.title, width: photo.width ?? null, height: photo.height ?? null } : null };
  });
  return <DocumentGrid cards={cards} eager={eager} />;
}

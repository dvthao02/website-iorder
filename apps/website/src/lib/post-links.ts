import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";

// Phần thuần của lib/news (không đụng Backend) để component và test đơn vị dùng được mà không kéo theo next/headers.

export const newsPostPath = (post: Pick<PublicPostSummary, "slug" | "type">) => post.type === "guide" ? `/support/guides/${post.slug}` : `/news/${post.slug}`;

const typeLabels: Record<PublicPostSummary["type"], string> = { announcement: "Thông báo", case_study: "Câu chuyện khách hàng", guide: "Hướng dẫn", news: "Tin tức", promotion: "Khuyến mãi" };
/** Nhãn của bài trên thẻ: chuyên mục đầu tiên; chưa có chuyên mục thì loại bài. */
export const newsLabel = (post: PublicPostSummary) => post.categories[0]?.name ?? typeLabels[post.type];

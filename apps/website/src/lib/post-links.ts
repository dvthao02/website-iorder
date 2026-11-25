import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
import type { UiMessageKey } from "@iorder/shared/server/translations/ui-messages";
import { createTranslate, type Translate } from "./translate";

// Phần thuần của lib/news (không đụng Backend) để component và test đơn vị dùng được mà không kéo theo next/headers.

export const newsPostPath = (post: Pick<PublicPostSummary, "slug" | "type">) => post.type === "guide" ? `/support/guides/${post.slug}` : `/news/${post.slug}`;

// Khóa nhãn loại bài trong danh mục chữ cố định (dịch được); bài có chuyên mục thì dùng tên chuyên mục từ CMS.
const typeLabelKeys = { announcement: "postType.announcement", case_study: "postType.caseStudy", guide: "postType.guide", news: "postType.news", promotion: "postType.promotion" } as const satisfies Record<PublicPostSummary["type"], UiMessageKey>;
/** Nhãn của bài trên thẻ: chuyên mục đầu tiên; chưa có chuyên mục thì loại bài. */
export const newsLabel = (post: PublicPostSummary, t: Translate = createTranslate()) => post.categories[0]?.name ?? t(typeLabelKeys[post.type]);

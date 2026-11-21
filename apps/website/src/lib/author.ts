import { authorPublicPath, type PostAuthorProfile } from "@iorder/shared/server/authors/authors.contract";

/** Tác giả hiển thị trên một bài viết, đã gộp từ hồ sơ tác giả (ưu tiên) hoặc tác giả khách nhập tay. */
export type PostAuthor = {
  name: string;
  jobTitle: string | null;
  /** Trang riêng trên website (/tac-gia/...) khi tác giả đã bật trang; null: không có trang để liên kết. */
  pagePath: string | null;
  /** Hồ sơ bên ngoài (LinkedIn, Facebook…). */
  profileUrl: string | null;
};

type PostWithAuthor = { authorProfile?: PostAuthorProfile | null; authorName?: string | null; authorTitle?: string | null; authorUrl?: string | null };

const clean = (value: string | null | undefined) => value?.trim() || null;

/**
 * Chọn tác giả của bài: hồ sơ được chọn trong CMS (có thể có trang riêng) thắng ba ô nhập tay (tác giả khách, không có trang riêng).
 * Không có tên nào thì null: website không ghi dòng "Tác giả" và tác giả trong dữ liệu cấu trúc là tổ chức.
 */
export function resolvePostAuthor(post: PostWithAuthor): PostAuthor | null {
  const profile = post.authorProfile;
  if (profile?.name.trim()) return { name: profile.name.trim(), jobTitle: clean(profile.jobTitle), pagePath: profile.pageEnabled ? authorPublicPath(profile.slug) : null, profileUrl: clean(profile.profileUrl) };
  const name = clean(post.authorName);
  return name ? { name, jobTitle: clean(post.authorTitle), pagePath: null, profileUrl: clean(post.authorUrl) } : null;
}

/** Địa chỉ gắn với tên tác giả trong thẻ meta author: trang riêng (tuyệt đối) nếu có, không thì hồ sơ ngoài. */
export function authorMetaUrl(author: PostAuthor, siteUrl: string | undefined) {
  if (author.pagePath && siteUrl) return new URL(author.pagePath, siteUrl).toString();
  return author.profileUrl;
}

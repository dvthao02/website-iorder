export type PostsSectionTab = "posts" | "categories" | "tags" | "authors";

/** Nhóm Bài viết & Tin tức: danh sách bài viết, Chuyên mục, Thẻ và Tác giả là các tab của cùng một mục. */
export function postsSectionLabel(tab: PostsSectionTab) {
  return tab === "posts" ? "Bài viết" : tab === "categories" ? "Chuyên mục" : tab === "tags" ? "Thẻ" : "Tác giả";
}

export function postsSectionHref(tab: PostsSectionTab) {
  return tab === "posts" ? "/admin/news" : tab === "authors" ? "/admin/authors" : tab === "tags" ? "/admin/taxonomy?kind=tags" : "/admin/taxonomy";
}

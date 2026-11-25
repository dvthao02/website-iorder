import React from "react";

import { SiteLink as Link } from "./site-link";
import type { PostAuthor } from "@/lib/author";
import { createTranslate, type Translate } from "../../lib/translate";

// Dòng "Tác giả" hiện trên bài viết: Google yêu cầu tác giả khai trong dữ liệu cấu trúc phải đọc được trên trang.
// Có trang riêng trên website thì tên là liên kết nội bộ tới đó (rel="author"); không thì tên là liên kết tới hồ sơ ngoài (nếu có).
export function AuthorByline({ author, t = createTranslate() }: { author: PostAuthor | null; t?: Translate }) {
  if (!author?.name.trim()) return null;
  const linkClass = "font-semibold text-brand-700 hover:underline";
  const name = author.pagePath
    ? <Link className={linkClass} href={author.pagePath} rel="author">{author.name}</Link>
    : author.profileUrl
      ? <a className={linkClass} href={author.profileUrl} rel="author noopener" target="_blank">{author.name}</a>
      : <strong className="font-semibold text-ink">{author.name}</strong>;
  return <span className="article-byline" data-builder-field="authorName">
    {t("article.byline")} {name}{author.jobTitle ? <span>, {author.jobTitle}</span> : null}
  </span>;
}

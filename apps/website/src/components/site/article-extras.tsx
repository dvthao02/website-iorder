import { ArrowLeft, ArrowRight, ListChecks } from "lucide-react";
import React from "react";

import type { PublicPostSummary } from "@iorder/shared/server/posts/posts.contract";
// Đường dẫn tương đối (không dùng @/) để thành phần này chạy được trong test đơn vị.
import type { PostAuthor } from "../../lib/author";
import type { SummaryPoint } from "../../lib/article-summary";
import { newsPostPath } from "../../lib/post-links";
import { createTranslate, type Translate } from "../../lib/translate";
import { SiteLink as Link } from "./site-link";

/** "Tóm tắt nhanh" đầu bài: vài ý chính, mỗi ý bấm để nhảy tới đúng phần (neo trùng mục lục). Không có ý nào thì không vẽ gì. */
export function ArticleSummary({ points, t = createTranslate() }: { points: SummaryPoint[] | null; t?: Translate }) {
  if (!points?.length) return null;
  return <aside aria-labelledby="tom-tat-nhanh" className="article-summary">
    <p className="article-summary__title" id="tom-tat-nhanh"><ListChecks aria-hidden="true" size={18} />{t("article.quickSummary")}</p>
    <ul>{points.map((point) => <li key={point.id}>
      <a href={`#${point.id}`}><strong>{point.heading}</strong><span>{point.text}</span></a>
    </li>)}</ul>
  </aside>;
}

/** Hộp tác giả cuối bài: chữ cái đầu, tên (liên kết tới trang riêng nếu có), chức danh. Không bịa tiểu sử: chỉ hiện những gì có trong hồ sơ. */
export function ArticleAuthorBox({ author, t = createTranslate() }: { author: PostAuthor | null; t?: Translate }) {
  if (!author?.name.trim()) return null;
  const name = author.pagePath
    ? <Link className="article-author__name" href={author.pagePath} rel="author">{author.name}</Link>
    : author.profileUrl
      ? <a className="article-author__name" href={author.profileUrl} rel="author noopener" target="_blank">{author.name}</a>
      : <strong className="article-author__name">{author.name}</strong>;
  return <aside aria-label={t("article.authorBox")} className="article-author">
    <span aria-hidden="true" className="article-author__avatar">{author.name.trim().charAt(0).toLocaleUpperCase("vi")}</span>
    <p className="article-author__text"><span>{t("article.editedBy")}</span>{name}{author.jobTitle ? <span>{author.jobTitle}</span> : null}</p>
  </aside>;
}

/** Bài cũ hơn (trái) / mới hơn (phải), theo thứ tự đăng, để người đọc đi tiếp trong tin tức; thiếu một phía thì chỉ hiện phía còn lại (bài mới hơn luôn nằm bên phải). */
export function ArticlePager({ newer, older, t = createTranslate() }: { newer: PublicPostSummary | null; older: PublicPostSummary | null; t?: Translate }) {
  if (!newer && !older) return null;
  return <nav aria-label={t("article.otherPosts")} className="article-pager">
    {older ? <Link className="guide-pager group" href={newsPostPath(older)} rel="prev" title={older.title}><span className="guide-pager__label"><ArrowLeft aria-hidden="true" size={16} />{t("article.older")}</span><span className="guide-pager__title">{older.title}</span></Link> : <span aria-hidden="true" className="hidden sm:block" />}
    {newer ? <Link className="guide-pager guide-pager--next group" href={newsPostPath(newer)} rel="next" title={newer.title}><span className="guide-pager__label">{t("article.newer")}<ArrowRight aria-hidden="true" size={16} /></span><span className="guide-pager__title">{newer.title}</span></Link> : null}
  </nav>;
}
